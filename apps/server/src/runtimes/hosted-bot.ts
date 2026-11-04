import {
  HostedBotJsRuntime,
  HostedBotStatus,
  ServerEvents,
  type THostedBotLogEntry,
  type THostedBotLogStream,
  type THostedBotState
} from '@sandshark/shared';
import type { Subprocess } from 'bun';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { getHostedBot } from '../db/queries/hosted-bots';
import { writeNewBotToken } from '../helpers/bot-tokens';
import {
  resolveHostedBotEntry,
  type THostedBotEntry
} from '../helpers/hosted-bot-entry';
import { buildHostedBotEnv, buildInstallEnv } from '../helpers/hosted-bot-env';
import { getHostedBotInstallSteps } from '../helpers/hosted-bot-install';
import {
  findHostedBotInterpreter,
  getMissingInterpreterMessage
} from '../helpers/hosted-bot-interpreter';
import { writeHostedBotPythonShim } from '../helpers/hosted-bot-python-shim';
import { writeHostedBotShim } from '../helpers/hosted-bot-shim';
import { HOSTED_BOT_LOGS_PATH, HOSTED_BOTS_PATH } from '../helpers/paths';
import { closeBotGatewaySessions } from '../http/bot-api/gateway';
import { logger } from '../logger';
import { pubsub } from '../utils/pubsub';

const MAX_LOG_LINES = 2000;
const MAX_LINE_LENGTH = 4000;
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024;

// a run shorter than this counts as a failure to start, and enough of them in a row mean
// the bot cannot run as it is, so it is left crashed instead of restarted forever
const FAST_FAILURE_MS = 30_000;
const MAX_FAST_FAILURES = 5;
const MAX_RESTART_DELAY_MS = 60_000;
const STOP_GRACE_MS = 5_000;

const getHostedBotPath = (botId: number) =>
  path.join(HOSTED_BOTS_PATH, String(botId));

const getHostedBotLogPath = (botId: number) =>
  path.join(HOSTED_BOT_LOGS_PATH, `${botId}.log`);

// what runs the bot's entry, with the shim for its language loaded before it. undefined when
// the program it runs on is not installed on this server
const buildHostedBotCommand = async (
  botPath: string,
  entry: THostedBotEntry,
  jsRuntime: HostedBotJsRuntime
) => {
  const interpreter = await findHostedBotInterpreter(botPath, entry, jsRuntime);

  if (!interpreter) return undefined;

  if (entry.language === 'python') {
    await writeHostedBotPythonShim();

    return [interpreter, entry.file];
  }

  const shimPath = await writeHostedBotShim();

  if (jsRuntime === HostedBotJsRuntime.NODE) {
    // node only takes a module to import as a url, a windows path reads as a url scheme
    return [interpreter, '--import', pathToFileURL(shimPath).href, entry.file];
  }

  return [interpreter, '--preload', shimPath, entry.file];
};

class HostedBotRuntime {
  private static runtimes = new Map<number, HostedBotRuntime>();

  // the first restart's delay, doubled on every fast failure after it. tests shorten it
  public static restartBaseDelayMs = 1000;

  private process: Subprocess<'ignore', 'pipe', 'pipe'> | undefined;
  private installer: Subprocess<'ignore', 'pipe', 'pipe'> | undefined;
  // a start asked for while dependencies install, run once they are in
  private startAfterInstall = false;
  private status = HostedBotStatus.STOPPED;
  private startedAt: number | null = null;
  private restarts = 0;
  private fastFailures = 0;
  // whether the bot should be running, which decides if an exit is restarted
  private wanted = false;
  private restartTimer: ReturnType<typeof setTimeout> | undefined;
  private logs: THostedBotLogEntry[] = [];
  private logFileBytes: number | undefined;
  private logFileWrite = Promise.resolve();

  private constructor(private botId: number) {}

  private static get = (botId: number) => {
    let runtime = HostedBotRuntime.runtimes.get(botId);

    if (!runtime) {
      runtime = new HostedBotRuntime(botId);
      HostedBotRuntime.runtimes.set(botId, runtime);
    }

    return runtime;
  };

  public static start = (botId: number) => HostedBotRuntime.get(botId).start();

  public static install = (botId: number) =>
    HostedBotRuntime.get(botId).install();

  public static stop = async (botId: number) => {
    const runtime = HostedBotRuntime.runtimes.get(botId);

    if (runtime) await runtime.stop();
  };

  public static stopAll = async () => {
    await Promise.all(
      [...HostedBotRuntime.runtimes.values()].map((runtime) => runtime.stop())
    );
  };

  // stops the bot and forgets it, for a bot that was deleted
  public static remove = async (botId: number) => {
    const runtime = HostedBotRuntime.runtimes.get(botId);

    if (!runtime) return;

    runtime.installer?.kill('SIGKILL');
    await runtime.stop();
    HostedBotRuntime.runtimes.delete(botId);
  };

  public static clearForTests = async () => {
    await HostedBotRuntime.stopAll();
    HostedBotRuntime.runtimes.clear();
  };

  public static getState = (botId: number): THostedBotState => {
    const runtime = HostedBotRuntime.runtimes.get(botId);

    if (!runtime) {
      return {
        botId,
        status: HostedBotStatus.STOPPED,
        startedAt: null,
        restarts: 0
      };
    }

    return runtime.getState();
  };

  // a line from the server about the bot, written to its log only if it is hosted here
  public static note = (botId: number, message: string) => {
    const runtime = HostedBotRuntime.runtimes.get(botId);

    if (runtime) runtime.log('system', message);
  };

  public static getLogs = (botId: number) => {
    const runtime = HostedBotRuntime.runtimes.get(botId);

    if (!runtime) return [];

    return runtime.logs;
  };

  // a process left running would outlive the server and keep its token, so every exit path
  // takes the bots with it
  public static killAllSync = () => {
    for (const runtime of HostedBotRuntime.runtimes.values()) {
      runtime.wanted = false;
      runtime.process?.kill('SIGKILL');
      runtime.installer?.kill('SIGKILL');
    }
  };

  private getState = (): THostedBotState => ({
    botId: this.botId,
    status: this.status,
    startedAt: this.startedAt,
    restarts: this.restarts
  });

  private setStatus = (status: HostedBotStatus) => {
    this.status = status;
    pubsub.publish(ServerEvents.HOSTED_BOT_UPDATE, this.getState());
  };

  private start = async () => {
    if (this.status === HostedBotStatus.INSTALLING) {
      this.startAfterInstall = true;
      return;
    }

    if (this.wanted) return;

    this.wanted = true;
    this.fastFailures = 0;
    this.restarts = 0;

    await this.spawn();
  };

  // the bot is stopped for the install, so it never runs against half installed packages,
  // and started again after if it was running or was asked to start meanwhile
  private install = async () => {
    if (this.status === HostedBotStatus.INSTALLING) return;

    this.startAfterInstall = this.wanted;
    await this.stop();
    this.setStatus(HostedBotStatus.INSTALLING);
    this.log('system', 'installing dependencies');

    let code: number | null = null;

    try {
      const botPath = getHostedBotPath(this.botId);
      const steps = await getHostedBotInstallSteps(botPath);

      code = 0;

      for (const cmd of steps) {
        const installer = Bun.spawn({
          cmd,
          cwd: botPath,
          env: buildInstallEnv(),
          stdin: 'ignore',
          stdout: 'pipe',
          stderr: 'pipe'
        });

        this.installer = installer;
        await Promise.all([
          this.pipe(installer.stdout, 'stdout'),
          this.pipe(installer.stderr, 'stderr')
        ]);
        code = await installer.exited;

        if (code !== 0) break;
      }
    } catch (error) {
      this.log('system', `could not install: ${String(error)}`);
    } finally {
      this.installer = undefined;
    }

    const startAfter = this.startAfterInstall;

    this.startAfterInstall = false;
    this.setStatus(HostedBotStatus.STOPPED);

    if (code !== 0) {
      this.log('system', `installing dependencies failed with code ${code}`);
      return;
    }

    this.log('system', 'dependencies installed');

    if (startAfter) await this.start();
  };

  private spawn = async () => {
    this.restartTimer = undefined;
    this.setStatus(HostedBotStatus.STARTING);

    const botPath = getHostedBotPath(this.botId);
    const [row, entry] = await Promise.all([
      getHostedBot(this.botId),
      resolveHostedBotEntry(botPath)
    ]);

    // stopped while the files were being read
    if (!this.wanted) {
      this.setStatus(HostedBotStatus.STOPPED);
      return;
    }

    if (!entry) {
      this.wanted = false;
      this.log(
        'system',
        'nothing to run: no start script, main, index, main.py or bot.py file'
      );
      this.setStatus(HostedBotStatus.CRASHED);
      return;
    }

    const cmd = await buildHostedBotCommand(
      botPath,
      entry,
      row?.jsRuntime ?? HostedBotJsRuntime.BUN
    );

    if (!cmd) {
      this.wanted = false;
      this.log('system', getMissingInterpreterMessage(entry));
      this.setStatus(HostedBotStatus.CRASHED);
      return;
    }

    // a fresh token on every start, which also ends any copy of the bot running elsewhere
    // on the old one
    const token = await writeNewBotToken(this.botId);

    closeBotGatewaySessions(this.botId);

    if (!this.wanted) {
      this.setStatus(HostedBotStatus.STOPPED);
      return;
    }

    const env = buildHostedBotEnv({
      token,
      env: row?.env ?? {},
      tokenEnvNames: row?.tokenEnvNames ?? []
    });

    let child: Subprocess<'ignore', 'pipe', 'pipe'>;

    try {
      child = Bun.spawn({
        cmd,
        cwd: botPath,
        env,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe'
      });
    } catch (error) {
      this.wanted = false;
      this.log('system', `could not start: ${String(error)}`);
      this.setStatus(HostedBotStatus.CRASHED);
      return;
    }

    const spawnedAt = Date.now();

    this.process = child;
    this.startedAt = spawnedAt;
    this.log('system', `started ${path.relative(botPath, entry.file)}`);
    this.setStatus(HostedBotStatus.RUNNING);

    const output = Promise.all([
      this.pipe(child.stdout, 'stdout'),
      this.pipe(child.stderr, 'stderr')
    ]);

    child.exited
      .then(async (code) => {
        // the last lines a crashing bot prints are the ones that say why
        await output;
        this.onExit(code, spawnedAt);
      })
      .catch((error) => {
        logger.error('hosted bot %d: exit handling failed', this.botId, error);
      });
  };

  private onExit = (code: number | null, spawnedAt: number) => {
    this.process = undefined;
    this.startedAt = null;
    this.log('system', `exited with code ${code}`);

    if (!this.wanted) {
      this.setStatus(HostedBotStatus.STOPPED);
      return;
    }

    if (Date.now() - spawnedAt < FAST_FAILURE_MS) {
      this.fastFailures += 1;
    } else {
      this.fastFailures = 0;
    }

    if (this.fastFailures >= MAX_FAST_FAILURES) {
      this.wanted = false;
      this.log(
        'system',
        `gave up after ${MAX_FAST_FAILURES} exits in a row within ${FAST_FAILURE_MS / 1000}s of starting`
      );
      this.setStatus(HostedBotStatus.CRASHED);
      return;
    }

    const delay = Math.min(
      HostedBotRuntime.restartBaseDelayMs * 2 ** this.fastFailures,
      MAX_RESTART_DELAY_MS
    );

    this.restarts += 1;
    this.log('system', `restarting in ${delay}ms`);
    this.setStatus(HostedBotStatus.STARTING);
    this.restartTimer = setTimeout(() => {
      this.spawn().catch((error) => {
        logger.error('hosted bot %d: restart failed', this.botId, error);
      });
    }, delay);
  };

  private stop = async () => {
    this.wanted = false;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = undefined;
    }

    const child = this.process;

    if (!child) {
      this.setStatus(HostedBotStatus.STOPPED);
      return;
    }

    child.kill();

    const exitedInTime = await Promise.race([
      child.exited.then(() => true),
      Bun.sleep(STOP_GRACE_MS).then(() => false)
    ]);

    if (!exitedInTime) {
      this.log('system', 'did not stop in time, killed');
      child.kill('SIGKILL');
      await child.exited;
    }
  };

  private pipe = async (
    stream: ReadableStream<Uint8Array>,
    name: THostedBotLogStream
  ) => {
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    let pending = '';

    let chunk = await reader.read();

    while (!chunk.done) {
      pending += decoder.decode(chunk.value, { stream: true });

      const lines = pending.split(/\r?\n/);

      pending = lines.pop() ?? '';

      for (const line of lines) this.log(name, line);

      chunk = await reader.read();
    }

    pending += decoder.decode();

    if (pending) this.log(name, pending);
  };

  private log = (stream: THostedBotLogStream, line: string) => {
    const entry: THostedBotLogEntry = {
      botId: this.botId,
      stream,
      timestamp: Date.now(),
      message: line.slice(0, MAX_LINE_LENGTH)
    };

    this.logs.push(entry);

    if (this.logs.length > MAX_LOG_LINES) this.logs.shift();

    pubsub.publish(ServerEvents.HOSTED_BOT_LOG, entry);

    const text = `${new Date(entry.timestamp).toISOString()} [${stream}] ${entry.message}\n`;

    this.logFileWrite = this.logFileWrite
      .then(() => this.appendToLogFile(text))
      .catch((error) => {
        logger.error('hosted bot %d: log file write failed', this.botId, error);
      });
  };

  // the file keeps what the memory buffer has dropped, capped by rolling the full file over
  // to a single older one
  private appendToLogFile = async (text: string) => {
    const file = getHostedBotLogPath(this.botId);

    if (this.logFileBytes === undefined) {
      await fs.mkdir(HOSTED_BOT_LOGS_PATH, { recursive: true });

      try {
        const stat = await fs.stat(file);

        this.logFileBytes = stat.size;
      } catch {
        this.logFileBytes = 0;
      }
    }

    if (this.logFileBytes + text.length > MAX_LOG_FILE_BYTES) {
      await fs.rename(file, `${file}.1`).catch(() => undefined);
      this.logFileBytes = 0;
    }

    await fs.appendFile(file, text);
    this.logFileBytes += text.length;
  };
}

export { getHostedBotLogPath, getHostedBotPath, HostedBotRuntime };

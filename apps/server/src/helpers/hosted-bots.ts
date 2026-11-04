import {
  ActivityLogType,
  HOSTED_BOT_MAX_ENV_VARS,
  HostedBotJsRuntime,
  type THostedBot
} from '@sandshark/shared';
import fs from 'fs/promises';
import { upsertHostedBot } from '../db/mutations/hosted-bots';
import {
  getEnabledHostedBotIds,
  getHostedBot
} from '../db/queries/hosted-bots';
import { getSettings } from '../db/queries/server';
import { logger } from '../logger';
import { enqueueActivityLog } from '../queues/activity-log';
import {
  getHostedBotLogPath,
  getHostedBotPath,
  HostedBotRuntime
} from '../runtimes/hosted-bot';
import { invariant } from '../utils/invariant';
import {
  clearUnsupportedCalls,
  getUnsupportedCalls
} from './bot-compat-report';
import { resolveHostedBotEntry } from './hosted-bot-entry';
import {
  findHostedBotInterpreter,
  getMissingInterpreterMessage
} from './hosted-bot-interpreter';
import { findNode, NODE_MISSING_MESSAGE } from './hosted-bot-node';

// the bot an admin acts on, named in the activity log so an entry still reads after the
// bot is deleted
type THostedBotRef = {
  id: number;
  name: string;
};

const getHostedBotView = async (botId: number): Promise<THostedBot> => {
  const row = await getHostedBot(botId);

  return {
    ...HostedBotRuntime.getState(botId),
    enabled: row?.enabled ?? false,
    envNames: Object.keys(row?.env ?? {}).sort(),
    tokenEnvNames: row?.tokenEnvNames ?? [],
    jsRuntime: row?.jsRuntime ?? HostedBotJsRuntime.BUN,
    source: row?.sourceType
      ? { type: row.sourceType, url: row.sourceUrl, ref: row.sourceRef }
      : null,
    codeUpdatedAt: row?.codeUpdatedAt ?? null,
    unsupported: getUnsupportedCalls(botId)
  };
};

const assertCanRun = async (botId: number) => {
  const botPath = getHostedBotPath(botId);
  const [entry, row] = await Promise.all([
    resolveHostedBotEntry(botPath),
    getHostedBot(botId)
  ]);

  invariant(entry, {
    code: 'BAD_REQUEST',
    message: 'This bot has no code to run yet.'
  });

  const interpreter = await findHostedBotInterpreter(
    botPath,
    entry,
    row?.jsRuntime ?? HostedBotJsRuntime.BUN
  );

  invariant(interpreter, {
    code: 'BAD_REQUEST',
    message: getMissingInterpreterMessage(entry)
  });
};

// enabled is what survives a server restart: an enabled bot is started again at boot
const enableAndStart = async (botId: number) => {
  await upsertHostedBot(botId, { enabled: true });
  await HostedBotRuntime.start(botId);
};

const startHostedBot = async (bot: THostedBotRef, actorUserId: number) => {
  await assertCanRun(bot.id);
  await enableAndStart(bot.id);

  enqueueActivityLog({
    type: ActivityLogType.STARTED_HOSTED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name }
  });
};

const stopHostedBot = async (bot: THostedBotRef, actorUserId: number) => {
  await upsertHostedBot(bot.id, { enabled: false });
  await HostedBotRuntime.stop(bot.id);

  enqueueActivityLog({
    type: ActivityLogType.STOPPED_HOSTED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name }
  });
};

// the check runs before the stop, so a bot that could not run is not stopped either
const restartHostedBot = async (bot: THostedBotRef, actorUserId: number) => {
  await assertCanRun(bot.id);

  await HostedBotRuntime.stop(bot.id);
  await enableAndStart(bot.id);

  enqueueActivityLog({
    type: ActivityLogType.RESTARTED_HOSTED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name }
  });
};

// a value of null removes the variable. the bot sees the change on its next start. the log
// names the variable and never its value, which is often a secret
const setHostedBotEnvVar = async (
  bot: THostedBotRef,
  actorUserId: number,
  name: string,
  value: string | null
) => {
  const botId = bot.id;
  const row = await getHostedBot(botId);
  const env = { ...row?.env };

  invariant(
    value === null ||
      name in env ||
      Object.keys(env).length < HOSTED_BOT_MAX_ENV_VARS,
    {
      code: 'BAD_REQUEST',
      message: `A bot can have at most ${HOSTED_BOT_MAX_ENV_VARS} variables.`
    }
  );

  if (value === null) {
    delete env[name];
  } else {
    env[name] = value;
  }

  await upsertHostedBot(botId, { env });

  enqueueActivityLog({
    type: ActivityLogType.UPDATED_HOSTED_BOT_ENV,
    userId: actorUserId,
    details: {
      botId,
      name: bot.name,
      envName: name,
      removed: value === null
    }
  });
};

const setHostedBotTokenEnvNames = async (
  bot: THostedBotRef,
  actorUserId: number,
  names: string[]
) => {
  const tokenEnvNames = [...new Set(names)];

  await upsertHostedBot(bot.id, { tokenEnvNames });

  enqueueActivityLog({
    type: ActivityLogType.UPDATED_HOSTED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name, tokenEnvNames }
  });
};

// the bot runs on it from its next start. node has to be there to be chosen, so a bot is
// never left set to a runtime it cannot start on
const setHostedBotJsRuntime = async (
  bot: THostedBotRef,
  actorUserId: number,
  jsRuntime: HostedBotJsRuntime
) => {
  if (jsRuntime === HostedBotJsRuntime.NODE) {
    invariant(await findNode(), {
      code: 'BAD_REQUEST',
      message: NODE_MISSING_MESSAGE
    });
  }

  await upsertHostedBot(bot.id, { jsRuntime });

  enqueueActivityLog({
    type: ActivityLogType.UPDATED_HOSTED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name, jsRuntime }
  });
};

// the bots row and the hosted row go with the user through the cascade, the files do not
const removeHostedBot = async (botId: number) => {
  await HostedBotRuntime.remove(botId);
  clearUnsupportedCalls(botId);

  const logPath = getHostedBotLogPath(botId);

  await Promise.all([
    fs.rm(getHostedBotPath(botId), { recursive: true, force: true }),
    fs.rm(logPath, { force: true }),
    fs.rm(`${logPath}.1`, { force: true })
  ]);
};

const startEnabledHostedBots = async () => {
  const { enableBotHosting } = await getSettings();

  if (!enableBotHosting) return;

  const botIds = await getEnabledHostedBotIds();

  await Promise.all(
    botIds.map((botId) =>
      HostedBotRuntime.start(botId).catch((error) => {
        logger.error('hosted bot %d: could not start', botId, error);
      })
    )
  );
};

let shutdownRegistered = false;

// bun leaves child processes running when the server is killed, and a bot that outlives
// the server keeps its token. a signal stops the bots first, then exits as it would have
const registerHostedBotShutdown = () => {
  if (shutdownRegistered) return;

  shutdownRegistered = true;

  process.once('exit', HostedBotRuntime.killAllSync);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      HostedBotRuntime.stopAll()
        .catch((error) => {
          logger.error('could not stop hosted bots', error);
        })
        .finally(() => process.exit(0));
    });
  }
};

export {
  getHostedBotView,
  registerHostedBotShutdown,
  removeHostedBot,
  restartHostedBot,
  setHostedBotEnvVar,
  setHostedBotJsRuntime,
  setHostedBotTokenEnvNames,
  startEnabledHostedBots,
  startHostedBot,
  stopHostedBot,
  type THostedBotRef
};

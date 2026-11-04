import { HOSTED_BOT_MAX_ENV_VARS, type THostedBot } from '@sandshark/shared';
import fs from 'fs/promises';
import { upsertHostedBot } from '../db/mutations/hosted-bots';
import {
  getEnabledHostedBotIds,
  getHostedBot
} from '../db/queries/hosted-bots';
import { getSettings } from '../db/queries/server';
import { logger } from '../logger';
import {
  getHostedBotLogPath,
  getHostedBotPath,
  HostedBotRuntime
} from '../runtimes/hosted-bot';
import { invariant } from '../utils/invariant';
import { resolveHostedBotEntry } from './hosted-bot-entry';

const getHostedBotView = async (botId: number): Promise<THostedBot> => {
  const row = await getHostedBot(botId);

  return {
    ...HostedBotRuntime.getState(botId),
    enabled: row?.enabled ?? false,
    envNames: Object.keys(row?.env ?? {}).sort(),
    tokenEnvNames: row?.tokenEnvNames ?? []
  };
};

const assertHasCode = async (botId: number) => {
  const entry = await resolveHostedBotEntry(getHostedBotPath(botId));

  invariant(entry, {
    code: 'BAD_REQUEST',
    message: 'This bot has no code to run yet.'
  });
};

// enabled is what survives a server restart: an enabled bot is started again at boot
const startHostedBot = async (botId: number) => {
  await assertHasCode(botId);

  await upsertHostedBot(botId, { enabled: true });
  await HostedBotRuntime.start(botId);
};

const stopHostedBot = async (botId: number) => {
  await upsertHostedBot(botId, { enabled: false });
  await HostedBotRuntime.stop(botId);
};

// the code check runs before the stop, so a bot with nothing to run is not stopped either
const restartHostedBot = async (botId: number) => {
  await assertHasCode(botId);

  await HostedBotRuntime.stop(botId);
  await startHostedBot(botId);
};

// a value of null removes the variable. the bot sees the change on its next start
const setHostedBotEnvVar = async (
  botId: number,
  name: string,
  value: string | null
) => {
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
};

const setHostedBotTokenEnvNames = async (botId: number, names: string[]) => {
  await upsertHostedBot(botId, { tokenEnvNames: [...new Set(names)] });
};

// the bots row and the hosted row go with the user through the cascade, the files do not
const removeHostedBot = async (botId: number) => {
  await HostedBotRuntime.remove(botId);

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
  setHostedBotTokenEnvNames,
  startEnabledHostedBots,
  startHostedBot,
  stopHostedBot
};

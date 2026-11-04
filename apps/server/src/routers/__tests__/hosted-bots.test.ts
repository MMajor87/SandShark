import {
  HostedBotStatus,
  Permission,
  ServerEvents,
  type THostedBotState
} from '@sandshark/shared';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test
} from 'bun:test';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import type http from 'http';
import path from 'path';
import {
  botApiRequest,
  initTest,
  startRealtimeServer
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { config } from '../../config';
import { hostedBots, rolePermissions, settings } from '../../db/schema';
import { HOSTED_BOTS_PATH } from '../../helpers/paths';
import { getHostedBotPath, HostedBotRuntime } from '../../runtimes/hosted-bot';
import { pubsub } from '../../utils/pubsub';

// the seeded member role user 2 holds
const MEMBER_ROLE_ID = 2;

let server: http.Server;
const originalServer = { ...config.server };

// hosted bots reach the server on the loopback address and its configured port, so the
// configured port is pointed at a server that also runs the gateway
beforeAll(async () => {
  let host: string;

  ({ server, host } = await startRealtimeServer());

  config.server.host = '';
  config.server.port = Number(host.split(':')[1]);
});

afterAll(() => {
  server.close();
  Object.assign(config.server, originalServer);
});

afterEach(async () => {
  await HostedBotRuntime.clearForTests();
  HostedBotRuntime.restartBaseDelayMs = 1000;
  await fs.rm(HOSTED_BOTS_PATH, { recursive: true, force: true });
});

const enableHosting = () =>
  tdb.update(settings).set({ enableBotHosting: true });

// a bot as the admin uploaded it: its files, written straight into its folder
const createHostedBot = async (files: Record<string, string>) => {
  const { caller } = await initTest(1);
  const { bot, token } = await caller.bots.create({ name: 'Hosted' });
  const botPath = getHostedBotPath(bot.id);

  await fs.mkdir(botPath, { recursive: true });
  await Promise.all(
    Object.entries(files).map(([name, content]) =>
      fs.writeFile(path.join(botPath, name), content)
    )
  );

  return { caller, bot, token, botPath };
};

const waitFor = async (check: () => boolean, ms = 15_000) => {
  const deadline = Date.now() + ms;

  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out');

    await Bun.sleep(25);
  }
};

const waitForLog = (botId: number, text: string, ms?: number) =>
  waitFor(
    () =>
      HostedBotRuntime.getLogs(botId).some(({ message }) =>
        message.includes(text)
      ),
    ms
  );

const logText = (botId: number) =>
  HostedBotRuntime.getLogs(botId)
    .map(({ message }) => message)
    .join('\n');

// asks the bot api who the bot is, the way every library does on login
const WHOAMI_BOT = `
const response = await fetch('https://discord.com/api/v10/users/@me', {
  headers: { Authorization: 'Bot ' + process.env.DISCORD_TOKEN }
});
const body = await response.json();
console.log('whoami ' + response.status + ' ' + body.username);
setInterval(() => {}, 1000);
`;

describe('hosted bots', () => {
  describe('access', () => {
    test('needs the host bots permission', async () => {
      await enableHosting();

      const { bot } = await createHostedBot({ 'index.js': WHOAMI_BOT });
      const { caller } = await initTest(2);

      await expect(caller.bots.getHosted({ botId: bot.id })).rejects.toThrow(
        'Insufficient permissions'
      );
    });

    test('refuses a bot that does not exist', async () => {
      await enableHosting();

      const { caller } = await initTest(1);

      await expect(caller.bots.getHosted({ botId: 999 })).rejects.toThrow(
        'Bot not found.'
      );
    });

    test('refuses while hosting is turned off', async () => {
      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await expect(caller.bots.startHosted({ botId: bot.id })).rejects.toThrow(
        'Bot hosting is turned off on this server.'
      );
    });

    test('refuses to start a bot with no code', async () => {
      await enableHosting();

      const { caller } = await initTest(1);
      const { bot } = await caller.bots.create({ name: 'Empty' });

      await expect(caller.bots.startHosted({ botId: bot.id })).rejects.toThrow(
        'This bot has no code to run yet.'
      );
      await expect(
        caller.bots.restartHosted({ botId: bot.id })
      ).rejects.toThrow('This bot has no code to run yet.');
    });

    test('turning hosting on needs the host bots permission too', async () => {
      await tdb.insert(rolePermissions).values({
        roleId: MEMBER_ROLE_ID,
        permission: Permission.MANAGE_SETTINGS,
        createdAt: Date.now()
      });

      const { caller } = await initTest(2);

      await expect(
        caller.others.updateSettings({ enableBotHosting: true })
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('running', () => {
    test('runs an unmodified bot against this server with a fresh token', async () => {
      await enableHosting();

      const { caller, bot, token } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });
      const updates: THostedBotState[] = [];
      const subscription = pubsub
        .subscribe(ServerEvents.HOSTED_BOT_UPDATE)
        .subscribe({
          next: (update) => {
            updates.push(update);
          }
        });

      try {
        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'whoami');
      } finally {
        subscription.unsubscribe();
      }

      expect(logText(bot.id)).toContain('whoami 200 Hosted');
      expect(updates.map(({ status }) => status)).toEqual([
        HostedBotStatus.STARTING,
        HostedBotStatus.RUNNING
      ]);

      const view = await caller.bots.getHosted({ botId: bot.id });

      expect(view).toMatchObject({
        botId: bot.id,
        enabled: true,
        status: HostedBotStatus.RUNNING,
        restarts: 0
      });
      expect(view.startedAt).toBeNumber();

      // the token the admin was shown at creation was replaced when the bot started
      const { status } = await botApiRequest('/users/@me', token);

      expect(status).toBe(401);

      const logs = await caller.bots.getHostedLogs({ botId: bot.id });

      expect(logs.some(({ stream }) => stream === 'stdout')).toBe(true);
    });

    test('an unmodified discord.js bot logs in with only its token', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'package.json': JSON.stringify({ scripts: { start: 'node bot.js' } }),
        'bot.js': `
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('clientReady', () => console.log('ready as ' + client.user.username));
client.login();
`
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'ready as', 30_000);

      expect(logText(bot.id)).toContain('ready as Hosted');
    }, 40_000);

    test('refuses any other connection to discord', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': `
import https from 'node:https';

await fetch('https://cdn.discordapp.com/avatars/1/2.png').catch(() => {});

try {
  https.get('https://discord.com/api/v10/gateway');
} catch {}

console.log('done');
setInterval(() => {}, 1000);
`
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'done');

      expect(logText(bot.id)).toContain(
        'refused a connection to cdn.discordapp.com'
      );
      expect(logText(bot.id)).toContain('refused a connection to discord.com');
    });

    test('gives the bot only its own environment', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': `
console.log('env ' + JSON.stringify({
  secret: process.env.SANDSHARK_TEST_SECRET ?? null,
  greeting: process.env.GREETING ?? null,
  custom: process.env.MY_TOKEN === process.env.DISCORD_TOKEN,
  token: process.env.TOKEN === process.env.DISCORD_TOKEN
}));
setInterval(() => {}, 1000);
`
      });

      await caller.bots.setHostedEnv({
        botId: bot.id,
        name: 'GREETING',
        value: 'hello'
      });
      await caller.bots.setHostedTokenEnvNames({
        botId: bot.id,
        names: ['MY_TOKEN']
      });

      process.env.SANDSHARK_TEST_SECRET = 'server secret';

      try {
        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'env ');
      } finally {
        delete process.env.SANDSHARK_TEST_SECRET;
      }

      const line = HostedBotRuntime.getLogs(bot.id).find(({ message }) =>
        message.startsWith('env ')
      );

      expect(JSON.parse(line!.message.slice(4))).toEqual({
        secret: null,
        greeting: 'hello',
        custom: true,
        token: true
      });
    });

    test('stops the bot and remembers it is off', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');
      await caller.bots.stopHosted({ botId: bot.id });

      await waitForLog(bot.id, 'exited with code');

      const row = await tdb
        .select({ enabled: hostedBots.enabled })
        .from(hostedBots)
        .where(eq(hostedBots.botId, bot.id))
        .get();

      expect(row?.enabled).toBe(false);
      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.STOPPED
      );
    });

    test('restart runs a new process', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');
      await caller.bots.restartHosted({ botId: bot.id });
      await waitFor(
        () =>
          HostedBotRuntime.getLogs(bot.id).filter(({ message }) =>
            message.startsWith('whoami 200')
          ).length === 2
      );

      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.RUNNING
      );
    });

    test('restarts a crashing bot, then gives up', async () => {
      await enableHosting();
      HostedBotRuntime.restartBaseDelayMs = 1;

      const { caller, bot } = await createHostedBot({
        'index.js': `console.log('crashing'); process.exit(1);`
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'gave up after 5 exits');

      expect(HostedBotRuntime.getState(bot.id)).toMatchObject({
        status: HostedBotStatus.CRASHED,
        restarts: 4
      });
      expect(logText(bot.id)).toContain('exited with code 1');
    });

    test('resetting the token stops the bot', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');
      await caller.bots.resetToken({ botId: bot.id });

      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.STOPPED
      );
    });

    test('deleting the bot stops it and removes its files', async () => {
      await enableHosting();

      const { caller, bot, botPath } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');
      await caller.bots.delete({ botId: bot.id });

      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.STOPPED
      );
      expect(await Bun.file(path.join(botPath, 'index.js')).exists()).toBe(
        false
      );
    });

    test('turning hosting off stops every bot, turning it on starts the enabled ones', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');
      await caller.others.updateSettings({ enableBotHosting: false });

      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.STOPPED
      );

      await caller.others.updateSettings({ enableBotHosting: true });
      await waitFor(
        () =>
          HostedBotRuntime.getState(bot.id).status === HostedBotStatus.RUNNING
      );
    });
  });

  describe('environment', () => {
    test('stores a variable and only ever returns its name', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await caller.bots.setHostedEnv({
        botId: bot.id,
        name: 'API_KEY',
        value: 'secret'
      });

      const row = await tdb
        .select({ env: hostedBots.env })
        .from(hostedBots)
        .where(eq(hostedBots.botId, bot.id))
        .get();

      expect(row?.env).toEqual({ API_KEY: 'secret' });

      const view = await caller.bots.getHosted({ botId: bot.id });

      expect(view.envNames).toEqual(['API_KEY']);
      expect(JSON.stringify(view)).not.toContain('secret');

      await caller.bots.setHostedEnv({
        botId: bot.id,
        name: 'API_KEY',
        value: null
      });

      expect((await caller.bots.getHosted({ botId: bot.id })).envNames).toEqual(
        []
      );
    });

    test('refuses a name the server sets', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await expect(
        caller.bots.setHostedEnv({
          botId: bot.id,
          name: 'SANDSHARK_API_URL',
          value: 'http://elsewhere'
        })
      ).rejects.toThrow('This variable is set by the server.');
      await expect(
        caller.bots.setHostedTokenEnvNames({
          botId: bot.id,
          names: ['BUN_BE_BUN']
        })
      ).rejects.toThrow('This variable is set by the server.');
    });

    test('refuses an invalid name or a value too long', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await expect(
        caller.bots.setHostedEnv({ botId: bot.id, name: '1BAD', value: 'x' })
      ).rejects.toThrow();
      await expect(
        caller.bots.setHostedEnv({
          botId: bot.id,
          name: 'LONG',
          value: 'x'.repeat(4097)
        })
      ).rejects.toThrow();
    });

    test('refuses more variables than a bot can have', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});
      const env = Object.fromEntries(
        Array.from({ length: 50 }, (_, index) => [`VAR_${index}`, 'x'])
      );

      await tdb
        .insert(hostedBots)
        .values({ botId: bot.id, env, createdAt: Date.now() });

      await expect(
        caller.bots.setHostedEnv({
          botId: bot.id,
          name: 'ONE_MORE',
          value: 'x'
        })
      ).rejects.toThrow('A bot can have at most 50 variables.');

      // replacing one it already has is still allowed
      await caller.bots.setHostedEnv({
        botId: bot.id,
        name: 'VAR_0',
        value: 'y'
      });
    });

    test('stores the extra token names once each', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await caller.bots.setHostedTokenEnvNames({
        botId: bot.id,
        names: ['MY_TOKEN', 'MY_TOKEN', 'OTHER']
      });

      expect(
        (await caller.bots.getHosted({ botId: bot.id })).tokenEnvNames
      ).toEqual(['MY_TOKEN', 'OTHER']);
    });
  });
});

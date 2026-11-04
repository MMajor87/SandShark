import {
  HostedBotJsRuntime,
  HostedBotSourceType,
  HostedBotStatus,
  HostedBotTemplate,
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
  spyOn,
  test
} from 'bun:test';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import type http from 'http';
import path from 'path';
import * as yazl from 'yazl';
import {
  botApiRequest,
  initTest,
  startRealtimeServer,
  uploadFile
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { config } from '../../config';
import {
  botCommands,
  hostedBots,
  messages,
  rolePermissions,
  settings
} from '../../db/schema';
import { getUnsupportedCalls } from '../../helpers/bot-compat-report';
import { fileManager } from '../../helpers/file-manager';
import { findNode } from '../../helpers/hosted-bot-node';
import { findPython } from '../../helpers/hosted-bot-python';
import { HOSTED_BOTS_PATH } from '../../helpers/paths';
import { getHostedBotPath, HostedBotRuntime } from '../../runtimes/hosted-bot';
import { pubsub } from '../../utils/pubsub';

// the seeded member role user 2 holds
const MEMBER_ROLE_ID = 2;

// python bots can only run where a python 3 is installed, which the ci runners and most
// dev machines have. without one, only the refusals below are covered
const python = await findPython();
// the same for node, which only bots set to run on it need
const node = await findNode();

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
    Object.entries(files).map(async ([name, content]) => {
      const file = path.join(botPath, name);

      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    })
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

// a zip built in memory, the way an admin would zip their bot's folder
const makeZip = (files: Record<string, string>) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const chunks: Buffer[] = [];

    for (const [name, content] of Object.entries(files)) {
      zip.addBuffer(Buffer.from(content), name);
    }

    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on('end', () =>
      resolve(new Uint8Array(Buffer.concat(chunks)))
    );
    zip.outputStream.on('error', reject);
    zip.end();
  });

const uploadBlob = async (
  token: string,
  content: string | Uint8Array,
  name: string
) => {
  const response = await uploadFile(new File([content], name), token);
  const { id } = (await response.json()) as { id: string };

  return id;
};

const uploadZip = async (
  token: string,
  files: Record<string, string>,
  name = 'bot.zip'
) => uploadBlob(token, await makeZip(files), name);

const readBotFile = (botPath: string, name: string) =>
  fs.readFile(path.join(botPath, name), 'utf8');

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

  // usage is read from /proc, so the readings themselves are only covered on linux, which
  // the ci runners are. elsewhere a running bot reports none, covered below
  describe('usage', () => {
    test('needs the host bots permission', async () => {
      await enableHosting();

      const { bot } = await createHostedBot({ 'index.js': WHOAMI_BOT });
      const { caller } = await initTest(2);

      await expect(
        caller.bots.getHostedUsage({ botId: bot.id })
      ).rejects.toThrow('Insufficient permissions');
    });

    test('refuses a bot that does not exist', async () => {
      await enableHosting();

      const { caller } = await initTest(1);

      await expect(caller.bots.getHostedUsage({ botId: 999 })).rejects.toThrow(
        'Bot not found.'
      );
    });

    test('refuses while hosting is turned off', async () => {
      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      await expect(
        caller.bots.getHostedUsage({ botId: bot.id })
      ).rejects.toThrow('Bot hosting is turned off on this server.');
    });

    test('reports nothing for a bot that is not running', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': WHOAMI_BOT
      });

      expect(await caller.bots.getHostedUsage({ botId: bot.id })).toBeNull();

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');
      await caller.bots.stopHosted({ botId: bot.id });

      expect(await caller.bots.getHostedUsage({ botId: bot.id })).toBeNull();
    });

    test.skipIf(process.platform !== 'linux')(
      'reports the memory and cpu of a running bot',
      async () => {
        await enableHosting();

        const { caller, bot } = await createHostedBot({
          'index.js': WHOAMI_BOT
        });

        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'whoami');

        const first = await caller.bots.getHostedUsage({ botId: bot.id });

        expect(first?.memoryBytes).toBeGreaterThan(1024 * 1024);
        // the share of a core needs a previous reading to measure against
        expect(first?.cpuPercent).toBeNull();

        await Bun.sleep(50);

        const second = await caller.bots.getHostedUsage({ botId: bot.id });

        expect(second?.memoryBytes).toBeGreaterThan(1024 * 1024);
        expect(second?.cpuPercent).toBeGreaterThanOrEqual(0);
      }
    );

    test.skipIf(process.platform === 'linux')(
      'reports nothing where the platform cannot say',
      async () => {
        await enableHosting();

        const { caller, bot } = await createHostedBot({
          'index.js': WHOAMI_BOT
        });

        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'whoami');

        expect(await caller.bots.getHostedUsage({ botId: bot.id })).toBeNull();
      }
    );
  });

  describe('templates', () => {
    test('needs the host bots permission', async () => {
      await enableHosting();

      const { bot } = await createHostedBot({});
      const { caller } = await initTest(2);

      await expect(
        caller.bots.createHostedFromTemplate({
          botId: bot.id,
          template: HostedBotTemplate.PING
        })
      ).rejects.toThrow('Insufficient permissions');
    });

    test('refuses a bot that does not exist', async () => {
      await enableHosting();

      const { caller } = await initTest(1);

      await expect(
        caller.bots.createHostedFromTemplate({
          botId: 999,
          template: HostedBotTemplate.PING
        })
      ).rejects.toThrow('Bot not found.');
    });

    test('refuses while hosting is turned off', async () => {
      const { caller, bot } = await createHostedBot({});

      await expect(
        caller.bots.createHostedFromTemplate({
          botId: bot.id,
          template: HostedBotTemplate.PING
        })
      ).rejects.toThrow('Bot hosting is turned off on this server.');
    });

    test('refuses a template that does not exist', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await expect(
        caller.bots.createHostedFromTemplate({
          botId: bot.id,
          template: 'nope' as HostedBotTemplate
        })
      ).rejects.toThrow();
      expect(await fs.readdir(getHostedBotPath(bot.id))).toEqual([]);
    });

    test('refuses a bot that already has code', async () => {
      await enableHosting();

      const { caller, bot, botPath } = await createHostedBot({});
      const { mockedToken } = await initTest(1);
      const fileId = await uploadZip(mockedToken, {
        'index.js': `console.log('mine');`
      });

      await caller.bots.uploadHostedCode({ botId: bot.id, fileId });

      await expect(
        caller.bots.createHostedFromTemplate({
          botId: bot.id,
          template: HostedBotTemplate.PING
        })
      ).rejects.toThrow(
        'This bot already has code. Upload or update it instead.'
      );
      expect(await readBotFile(botPath, 'index.js')).toBe(
        `console.log('mine');`
      );
    });

    test('writes a ping bot that answers /ping', async () => {
      await enableHosting();

      const { caller, bot, botPath } = await createHostedBot({});
      // an install would download discord.js, which the tests take from the repository
      const install = spyOn(HostedBotRuntime, 'install').mockResolvedValue(
        undefined
      );

      await caller.bots.createHostedFromTemplate({
        botId: bot.id,
        template: HostedBotTemplate.PING
      });

      expect(install).toHaveBeenCalledWith(bot.id);
      expect(
        JSON.parse(await readBotFile(botPath, 'package.json'))
      ).toMatchObject({
        main: 'index.js',
        dependencies: { 'discord.js': expect.any(String) }
      });

      const view = await caller.bots.getHosted({ botId: bot.id });

      expect(view.codeUpdatedAt).toBeNumber();
      expect(view.source).toMatchObject({ type: HostedBotSourceType.UPLOAD });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'ready as', 30_000);

      const [command] = await tdb
        .select()
        .from(botCommands)
        .where(eq(botCommands.botId, bot.id));

      expect(command?.name).toBe('ping');

      await caller.bots.runCommand({ commandId: command!.id, channelId: 1 });

      const deadline = Date.now() + 10_000;
      let reply: string | undefined;

      while (!reply && Date.now() < deadline) {
        const row = await tdb
          .select({ content: messages.content })
          .from(messages)
          .where(eq(messages.userId, bot.id))
          .get();

        reply = row?.content ?? undefined;

        await Bun.sleep(50);
      }

      expect(reply).toBe('<p>Pong!</p>');
    }, 50_000);
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

  describe('compatibility report', () => {
    test('a hosted bot logs each unsupported call once and counts the rest', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'index.js': `
const call = (path) =>
  fetch('https://discord.com/api/v10' + path, {
    headers: { Authorization: 'Bot ' + process.env.DISCORD_TOKEN }
  });
await call('/guilds/1/bans');
await call('/guilds/2/bans');
await call('/guilds/1/emojis');
console.log('called');
setInterval(() => {}, 1000);
`
      });

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'called');

      const lines = HostedBotRuntime.getLogs(bot.id)
        .map(({ message }) => message)
        .filter((message) => message.startsWith('unsupported'));

      expect(lines).toEqual([
        'unsupported: GET /guilds/{id}/bans',
        'unsupported, answered empty: GET /guilds/{id}/emojis'
      ]);

      const { unsupported } = await caller.bots.getHosted({ botId: bot.id });

      expect(
        unsupported.map(({ call, count, stubbed }) => ({
          call,
          count,
          stubbed
        }))
      ).toEqual([
        { call: 'GET /guilds/{id}/bans', count: 2, stubbed: false },
        { call: 'GET /guilds/{id}/emojis', count: 1, stubbed: true }
      ]);
    });

    test('deleting the bot forgets its report', async () => {
      await enableHosting();

      const { caller, bot, token } = await createHostedBot({});

      await botApiRequest('/guilds/1/bans', token);

      expect(getUnsupportedCalls(bot.id)).toHaveLength(1);

      await caller.bots.delete({ botId: bot.id });

      expect(getUnsupportedCalls(bot.id)).toEqual([]);
    });
  });

  describe('code', () => {
    test('an uploaded zip replaces the code and keeps the data next to it', async () => {
      await enableHosting();

      const { caller, bot, botPath } = await createHostedBot({
        'index.js': 'old',
        'data.json': '{"score":10}'
      });
      const { mockedToken } = await initTest(1);
      const fileId = await uploadZip(mockedToken, {
        'my-bot/index.js': 'new',
        'my-bot/commands/ping.js': 'ping'
      });

      await caller.bots.uploadHostedCode({ botId: bot.id, fileId });

      expect(await readBotFile(botPath, 'index.js')).toBe('new');
      expect(await readBotFile(botPath, 'commands/ping.js')).toBe('ping');
      expect(await readBotFile(botPath, 'data.json')).toBe('{"score":10}');
      expect(fileManager.getTemporaryFile(fileId)).toBeUndefined();

      const view = await caller.bots.getHosted({ botId: bot.id });

      expect(view.source).toEqual({
        type: HostedBotSourceType.UPLOAD,
        url: null,
        ref: null
      });
      expect(view.codeUpdatedAt).toBeNumber();
    });

    test('an upload with a package.json installs it and restarts the running bot', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({ 'index.js': WHOAMI_BOT });
      const { mockedToken } = await initTest(1);

      await caller.bots.startHosted({ botId: bot.id });
      await waitForLog(bot.id, 'whoami');

      const fileId = await uploadZip(mockedToken, {
        'package.json': JSON.stringify({ name: 'bot', version: '1.0.0' }),
        'index.js': `console.log('second version'); setInterval(() => {}, 1000);`
      });

      await caller.bots.uploadHostedCode({ botId: bot.id, fileId });
      await waitForLog(bot.id, 'dependencies installed', 60_000);
      await waitForLog(bot.id, 'second version');

      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.RUNNING
      );
    }, 70_000);

    test('refuses an upload that is not the caller own, not a zip, unreadable or too large', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});
      const { mockedToken: otherToken } = await initTest(2);
      const othersFile = await uploadZip(otherToken, { 'index.js': '' });

      await expect(
        caller.bots.uploadHostedCode({ botId: bot.id, fileId: othersFile })
      ).rejects.toThrow('Uploaded file not found.');

      const { mockedToken } = await initTest(1);
      const textFile = await uploadZip(
        mockedToken,
        { 'index.js': '' },
        'bot.txt'
      );

      await expect(
        caller.bots.uploadHostedCode({ botId: bot.id, fileId: textFile })
      ).rejects.toThrow('Upload the bot as a .zip file.');

      const broken = await uploadBlob(mockedToken, 'not a zip', 'broken.zip');

      await expect(
        caller.bots.uploadHostedCode({ botId: bot.id, fileId: broken })
      ).rejects.toThrow('The archive could not be read as a zip file.');

      // the upload limit is a server setting, usually far below this one
      const large = await uploadZip(mockedToken, { 'index.js': '' });
      const tempFile = fileManager.getTemporaryFile(large)!;

      spyOn(fileManager, 'getTemporaryFile').mockReturnValue({
        ...tempFile,
        size: 101 * 1024 * 1024
      });

      await expect(
        caller.bots.uploadHostedCode({ botId: bot.id, fileId: large })
      ).rejects.toThrow('The code is larger than 100 MB.');
    });

    test('stores a github source', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await caller.bots.setHostedSource({
        botId: bot.id,
        url: 'https://github.com/someone/my-bot.git',
        ref: 'main'
      });

      expect((await caller.bots.getHosted({ botId: bot.id })).source).toEqual({
        type: HostedBotSourceType.GITHUB,
        url: 'https://github.com/someone/my-bot.git',
        ref: 'main'
      });
    });

    test('refuses an address that is not a github repository, or a ref that climbs out', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await expect(
        caller.bots.setHostedSource({
          botId: bot.id,
          url: 'https://gitlab.com/someone/my-bot',
          ref: null
        })
      ).rejects.toThrow('This is not a GitHub repository address.');
      await expect(
        caller.bots.setHostedSource({
          botId: bot.id,
          url: 'https://github.com/someone/my-bot',
          ref: '../../users'
        })
      ).rejects.toThrow('This is not a branch, tag or commit name.');
    });

    test('updates from github through its archive api', async () => {
      await enableHosting();

      const { caller, bot, botPath } = await createHostedBot({});
      const zip = await makeZip({
        'someone-my-bot-abc123/index.js': 'from github'
      });

      await caller.bots.setHostedSource({
        botId: bot.id,
        url: 'https://github.com/someone/my-bot',
        ref: 'v2'
      });

      const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(zip, { status: 200 })
      );

      await caller.bots.updateHostedCode({ botId: bot.id });

      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://api.github.com/repos/someone/my-bot/zipball/v2'
      );
      expect(await readBotFile(botPath, 'index.js')).toBe('from github');
    });

    test('says why github could not send the code', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      await expect(
        caller.bots.updateHostedCode({ botId: bot.id })
      ).rejects.toThrow('This bot has no GitHub repository set.');

      await caller.bots.setHostedSource({
        botId: bot.id,
        url: 'https://github.com/someone/private-bot',
        ref: null
      });

      const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('', { status: 404 })
      );

      await expect(
        caller.bots.updateHostedCode({ botId: bot.id })
      ).rejects.toThrow(
        'The repository or branch was not found. Only public repositories can be used.'
      );
      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://api.github.com/repos/someone/private-bot/zipball'
      );

      fetchSpy.mockResolvedValue(new Response('', { status: 502 }));

      await expect(
        caller.bots.updateHostedCode({ botId: bot.id })
      ).rejects.toThrow('GitHub could not send the code (status 502).');
    });

    test('installs dependencies on request, and only when there is a package.json', async () => {
      await enableHosting();

      const { caller, bot, botPath } = await createHostedBot({
        'index.js': ''
      });

      await expect(
        caller.bots.installHostedDependencies({ botId: bot.id })
      ).rejects.toThrow(
        'This bot has no package.json, requirements.txt or pyproject.toml to install from.'
      );

      await fs.writeFile(
        path.join(botPath, 'package.json'),
        JSON.stringify({ name: 'bot', version: '1.0.0' })
      );
      await caller.bots.installHostedDependencies({ botId: bot.id });
      await waitForLog(bot.id, 'dependencies installed', 60_000);

      expect(HostedBotRuntime.getState(bot.id).status).toBe(
        HostedBotStatus.STOPPED
      );
    }, 70_000);
  });

  describe('python', () => {
    test('refuses to start a python bot when the server has no python', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({ 'main.py': '' });

      spyOn(Bun, 'which').mockReturnValue(null);

      await expect(caller.bots.startHosted({ botId: bot.id })).rejects.toThrow(
        'This bot is written in Python, and Python 3 was not found on this server.'
      );
    });

    test('says why a python install could not run', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({
        'main.py': '',
        'requirements.txt': ''
      });

      spyOn(Bun, 'which').mockReturnValue(null);

      await caller.bots.installHostedDependencies({ botId: bot.id });
      await waitForLog(bot.id, 'installing dependencies failed');

      expect(logText(bot.id)).toContain(
        'Python 3 was not found on this server'
      );
    });

    test.skipIf(!python)(
      'moves aiohttp to this server and refuses any other way to discord',
      async () => {
        await enableHosting();

        // aiohttp as discord.py uses it, reduced to the one method the shim patches. the
        // url it is handed is answered back, so the bot can see where it was sent
        const { caller, bot } = await createHostedBot({
          'aiohttp/__init__.py': `
class ClientSession:
    async def _request(self, method, str_or_url, **kwargs):
        return str(str_or_url)
`,
          'main.py': `
import asyncio
import json
import os
import time
import urllib.request

import aiohttp


async def main():
    session = aiohttp.ClientSession()
    api = await session._request('GET', 'https://discord.com/api/v10/users/@me')
    gateway = await session._request('GET', 'wss://gateway.discord.gg/?v=10&encoding=json')

    try:
        await session._request('GET', 'https://cdn.discordapp.com/avatars/1/2.png')
    except ConnectionRefusedError:
        pass

    return api, gateway


api, gateway = asyncio.run(main())
request = urllib.request.Request(
    api, headers={'Authorization': 'Bot ' + os.environ['DISCORD_TOKEN']}
)

with urllib.request.urlopen(request) as response:
    print('whoami', response.status, json.load(response)['username'])

print('gateway', gateway == os.environ['SANDSHARK_GATEWAY_URL'] + '?v=10&encoding=json')

try:
    urllib.request.urlopen('https://discord.com/api/v10/gateway')
except OSError:
    pass

print('done')

while True:
    time.sleep(1)
`
        });

        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'done');

        const text = logText(bot.id);

        expect(text).toContain('started main.py');
        expect(text).toContain('whoami 200 Hosted');
        expect(text).toContain('gateway True');
        expect(text).toContain('refused a connection to cdn.discordapp.com');
        expect(text).toContain('refused a connection to discord.com');
      },
      30_000
    );

    test.skipIf(!python)(
      'installs requirements into a venv of its own and runs the bot on it',
      async () => {
        await enableHosting();

        const { caller, bot, botPath } = await createHostedBot({
          'requirements.txt': '',
          'main.py': `
import sys
import time

print('prefix', sys.prefix)

while True:
    time.sleep(1)
`
        });

        await caller.bots.installHostedDependencies({ botId: bot.id });
        await waitForLog(bot.id, 'dependencies installed', 120_000);
        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'prefix');

        expect(logText(bot.id)).toContain(
          `prefix ${path.join(botPath, '.venv')}`
        );
      },
      150_000
    );
  });

  describe('node', () => {
    const NODE_MISSING =
      'This bot is set to run on Node.js, and Node.js 20 or newer was not found on this server.';

    test('a bot runs on bun until told otherwise', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      expect((await caller.bots.getHosted({ botId: bot.id })).jsRuntime).toBe(
        HostedBotJsRuntime.BUN
      );

      await caller.bots.setHostedJsRuntime({
        botId: bot.id,
        jsRuntime: HostedBotJsRuntime.BUN
      });

      const row = await tdb
        .select({ jsRuntime: hostedBots.jsRuntime })
        .from(hostedBots)
        .where(eq(hostedBots.botId, bot.id))
        .get();

      expect(row?.jsRuntime).toBe(HostedBotJsRuntime.BUN);
    });

    test('needs the host bots permission and a runtime it knows', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});
      const { caller: memberCaller } = await initTest(2);

      await expect(
        memberCaller.bots.setHostedJsRuntime({
          botId: bot.id,
          jsRuntime: HostedBotJsRuntime.BUN
        })
      ).rejects.toThrow('Insufficient permissions');
      await expect(
        caller.bots.setHostedJsRuntime({
          botId: bot.id,
          // @ts-expect-error a runtime that does not exist
          jsRuntime: 'deno'
        })
      ).rejects.toThrow();
    });

    test('refuses node when the server has none', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({});

      spyOn(Bun, 'which').mockReturnValue(null);

      await expect(
        caller.bots.setHostedJsRuntime({
          botId: bot.id,
          jsRuntime: HostedBotJsRuntime.NODE
        })
      ).rejects.toThrow(NODE_MISSING);
      expect((await caller.bots.getHosted({ botId: bot.id })).jsRuntime).toBe(
        HostedBotJsRuntime.BUN
      );
    });

    test('refuses to start a bot set to node once node is gone', async () => {
      await enableHosting();

      const { caller, bot } = await createHostedBot({ 'index.js': WHOAMI_BOT });

      await tdb.insert(hostedBots).values({
        botId: bot.id,
        jsRuntime: HostedBotJsRuntime.NODE,
        createdAt: Date.now()
      });

      spyOn(Bun, 'which').mockReturnValue(null);

      await expect(caller.bots.startHosted({ botId: bot.id })).rejects.toThrow(
        NODE_MISSING
      );
    });

    test.skipIf(!node)(
      'runs the bot on node with the same shim',
      async () => {
        await enableHosting();

        const { caller, bot } = await createHostedBot({
          'package.json': JSON.stringify({ type: 'module' }),
          'index.js': `console.log('runtime ' + (typeof Bun === 'undefined' ? 'node' : 'bun'));
${WHOAMI_BOT}`
        });

        await caller.bots.setHostedJsRuntime({
          botId: bot.id,
          jsRuntime: HostedBotJsRuntime.NODE
        });
        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'whoami');

        expect(logText(bot.id)).toContain('runtime node');
        expect(logText(bot.id)).toContain('whoami 200 Hosted');
      },
      30_000
    );

    // discord.js sends its requests through undici on node, not through fetch
    test.skipIf(!node)(
      'an unmodified discord.js bot logs in on node',
      async () => {
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

        await caller.bots.setHostedJsRuntime({
          botId: bot.id,
          jsRuntime: HostedBotJsRuntime.NODE
        });
        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'ready as', 30_000);

        expect(logText(bot.id)).toContain('ready as Hosted');
      },
      40_000
    );

    test.skipIf(!node)(
      'refuses a raw socket to discord on node',
      async () => {
        await enableHosting();

        const { caller, bot } = await createHostedBot({
          'package.json': JSON.stringify({ type: 'module' }),
          'index.js': `
import net from 'node:net';

await new Promise((resolve) => {
  net.connect({ host: 'gateway.discord.gg', port: 443 }).on('error', resolve);
});

console.log('done');
setInterval(() => {}, 1000);
`
        });

        await caller.bots.setHostedJsRuntime({
          botId: bot.id,
          jsRuntime: HostedBotJsRuntime.NODE
        });
        await caller.bots.startHosted({ botId: bot.id });
        await waitForLog(bot.id, 'done');

        expect(logText(bot.id)).toContain(
          'refused a connection to gateway.discord.gg'
        );
      },
      30_000
    );
  });
});

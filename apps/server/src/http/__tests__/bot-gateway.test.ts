import { UserStatus } from '@sandshark/shared';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import type http from 'http';
import zlib from 'node:zlib';
import WebSocket from 'ws';
import { initTest } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { channels, users } from '../../db/schema';
import { channelSnowflake } from '../../helpers/discord/channel';
import { userSnowflake } from '../../helpers/discord/user';
import { createWsServer, getUserStatus } from '../../utils/wss';
import { GatewayIntent } from '../bot-api/gateway/protocol';
import { createHttpServer } from '../index';

// dispatch bodies are asserted field by field, typing each one would add nothing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TPayload = { op: number; d: any; s: number | null; t: string | null };

let server: http.Server;
let baseUrl: string;

// the shared test server is http only, this one also runs the websocket upgrade routing
// that sends discord gateway connections to the bot gateway and everything else to trpc
beforeAll(async () => {
  server = await createHttpServer(0);
  await createWsServer(server);

  const address = server.address();

  if (!address || typeof address === 'string') throw new Error('no port');

  baseUrl = `localhost:${address.port}`;
});

afterAll(() => {
  server.close();
});

const ALL_INTENTS =
  GatewayIntent.GUILDS |
  GatewayIntent.GUILD_MEMBERS |
  GatewayIntent.GUILD_PRESENCES |
  GatewayIntent.GUILD_MESSAGES |
  GatewayIntent.GUILD_MESSAGE_REACTIONS |
  GatewayIntent.GUILD_MESSAGE_TYPING |
  GatewayIntent.DIRECT_MESSAGES |
  GatewayIntent.MESSAGE_CONTENT;

const connect = (query = '?v=10&encoding=json') => {
  const socket = new WebSocket(`ws://${baseUrl}/api/v10/gateway${query}`);
  const received: TPayload[] = [];
  const sequences: number[] = [];
  const waiters: {
    match: (p: TPayload) => boolean;
    resolve: (p: TPayload) => void;
  }[] = [];
  const closed = new Promise<number>((resolve) =>
    socket.on('close', (code) => resolve(code))
  );

  socket.on('message', (data) => {
    const payload = JSON.parse(data.toString()) as TPayload;

    received.push(payload);

    if (payload.op === 0 && payload.s !== null) sequences.push(payload.s);

    for (const waiter of [...waiters]) {
      if (waiter.match(payload)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(payload);
      }
    }
  });

  const next = (match: (p: TPayload) => boolean, timeoutMs = 3_000) =>
    new Promise<TPayload>((resolve, reject) => {
      const existing = received.find(match);

      if (existing) {
        received.splice(received.indexOf(existing), 1);
        resolve(existing);
        return;
      }

      const timer = setTimeout(() => reject(new Error('timed out')), timeoutMs);

      waiters.push({
        match,
        resolve: (payload) => {
          clearTimeout(timer);
          received.splice(received.indexOf(payload), 1);
          resolve(payload);
        }
      });
    });

  const dispatch = (event: string, timeoutMs?: number) =>
    next((p) => p.op === 0 && p.t === event, timeoutMs);

  const send = (payload: unknown) => socket.send(JSON.stringify(payload));

  // resolves once nothing matching arrived within the window
  const none = async (event: string, windowMs = 300) => {
    await Bun.sleep(windowMs);

    return !received.some((p) => p.t === event);
  };

  const close = async () => {
    socket.close();
    await closed;
    // the server side close handler runs asynchronously
    await Bun.sleep(20);
  };

  return {
    socket,
    received,
    sequences,
    next,
    dispatch,
    send,
    none,
    closed,
    close
  };
};

const createBot = async () => {
  const { caller } = await initTest(1);

  return caller.bots.create({ name: 'Helper' });
};

const identified = async (intents = ALL_INTENTS) => {
  const { bot, token } = await createBot();
  const client = connect();

  await client.next((p) => p.op === 10);
  client.send({ op: 2, d: { token, intents, properties: {} } });

  const ready = await client.dispatch('READY');
  const guild = await client.dispatch('GUILD_CREATE');

  return { bot, token, client, ready, guild };
};

const channelOne = async () =>
  channelSnowflake(
    (await tdb.select().from(channels).where(eq(channels.id, 1)).get())!
  );

describe('bot gateway', () => {
  test('/gateway/bot points the libraries at this server', async () => {
    const { token } = await createBot();
    const response = await fetch(`http://${baseUrl}/api/v10/gateway/bot`, {
      headers: { Authorization: `Bot ${token}` }
    });

    expect(await response.json()).toMatchObject({
      url: `ws://${baseUrl}/api/v10/gateway`,
      shards: 1,
      session_start_limit: { max_concurrency: 1 }
    });
  });

  describe('handshake', () => {
    test('says hello and acknowledges heartbeats', async () => {
      const client = connect();

      try {
        const hello = await client.next((p) => p.op === 10);

        expect(hello.d.heartbeat_interval).toBe(41_250);

        client.send({ op: 1, d: null });

        expect((await client.next((p) => p.op === 11)).op).toBe(11);
      } finally {
        await client.close();
      }
    });

    test('identify sends ready, then the one guild with channels, roles and members', async () => {
      const { bot, client, ready, guild } = await identified();

      try {
        const botRow = (await tdb
          .select()
          .from(users)
          .where(eq(users.id, bot.id))
          .get())!;

        expect(ready.s).toBe(1);
        expect(ready.d).toMatchObject({
          v: 10,
          user: { id: userSnowflake(botRow), bot: true },
          guilds: [{ id: guild.d.id, unavailable: true }],
          shard: [0, 1],
          application: { id: userSnowflake(botRow) }
        });
        expect(typeof ready.d.session_id).toBe('string');
        expect(guild.s).toBe(2);
        expect(guild.d.unavailable).toBe(false);
        expect(
          guild.d.channels.map((channel: { name: string }) => channel.name)
        ).toEqual([
          'Text Channels',
          'Voice Channels',
          'General',
          'Voice',
          'Restricted Text'
        ]);
        expect(guild.d.roles[0]).toMatchObject({
          id: guild.d.id,
          name: '@everyone'
        });
        expect(
          guild.d.members.some(
            (member: { user: { id: string } }) =>
              member.user.id === userSnowflake(botRow)
          )
        ).toBe(true);
      } finally {
        await client.close();
      }
    });

    test('the bot is online while connected and offline after', async () => {
      const { bot, client } = await identified();

      expect(getUserStatus(bot.id)).toBe(UserStatus.ONLINE);

      await client.close();

      expect(getUserStatus(bot.id)).toBe(UserStatus.OFFLINE);
    });

    test('accepts zlib-stream compression', async () => {
      const socket = new WebSocket(
        `ws://${baseUrl}/api/v10/gateway?v=10&encoding=json&compress=zlib-stream`
      );
      const inflate = zlib.createInflate();
      const hello = new Promise<TPayload>((resolve) =>
        inflate.on('data', (chunk: Buffer) =>
          resolve(JSON.parse(chunk.toString()))
        )
      );

      socket.on('message', (data: Buffer) => inflate.write(data));

      try {
        expect((await hello).op).toBe(10);
      } finally {
        socket.close();
        inflate.close();
      }
    });
  });

  describe('refusals', () => {
    const closesWith = async (
      setup: (client: ReturnType<typeof connect>) => void,
      query?: string
    ) => {
      const client = connect(query);

      // a refused version or encoding closes before hello is ever sent
      if (!query) await client.next((p) => p.op === 10);

      setup(client);

      return client.closed;
    };

    test('an unknown token is an authentication failure', async () => {
      expect(
        await closesWith((client) =>
          client.send({
            op: 2,
            d: { token: `1.${'a'.repeat(43)}`, intents: 0 }
          })
        )
      ).toBe(4004);
    });

    test('invalid intents, unknown opcodes and undecodable payloads', async () => {
      const { token } = await createBot();

      expect(
        await closesWith((client) =>
          client.send({ op: 2, d: { token, intents: -1 } })
        )
      ).toBe(4013);
      expect(
        await closesWith((client) => client.send({ op: 99, d: null }))
      ).toBe(4001);
      expect(await closesWith((client) => client.socket.send('{nope'))).toBe(
        4002
      );
    });

    test('asking for members before identifying', async () => {
      expect(
        await closesWith((client) =>
          client.send({ op: 8, d: { guild_id: '1', query: '', limit: 0 } })
        )
      ).toBe(4003);
    });

    test('identifying twice', async () => {
      const { token, client } = await identified();

      client.send({ op: 2, d: { token, intents: 0 } });

      expect(await client.closed).toBe(4005);
    });

    test('an unsupported version or encoding', async () => {
      expect(await closesWith(() => {}, '?v=9')).toBe(4012);
      expect(await closesWith(() => {}, '?v=10&encoding=etf')).toBe(4002);
    });

    test('a resume is told to identify again', async () => {
      const client = connect();

      try {
        await client.next((p) => p.op === 10);
        client.send({ op: 6, d: { token: 'x', session_id: 'y', seq: 1 } });

        expect((await client.next((p) => p.op === 9)).d).toBe(false);
      } finally {
        await client.close();
      }
    });

    test('sending past the client limit closes the connection', async () => {
      const client = connect();

      await client.next((p) => p.op === 10);

      for (let i = 0; i < 121; i++) client.send({ op: 1, d: null });

      expect(await client.closed).toBe(4008);
    });

    test('resetting the token ends the session', async () => {
      const { bot, client } = await identified();
      const { caller } = await initTest(1);

      await caller.bots.resetToken({ botId: bot.id });

      expect(await client.closed).toBe(4004);
    });
  });

  describe('events', () => {
    test('a member message arrives as message create, with content under the intent', async () => {
      const { client } = await identified();
      const { caller } = await initTest(1);

      try {
        await caller.messages.send({
          channelId: 1,
          content: '<p>hello bot</p>',
          files: []
        });

        const created = await client.dispatch('MESSAGE_CREATE');

        expect(created.d).toMatchObject({
          channel_id: await channelOne(),
          content: 'hello bot',
          guild_id: expect.any(String)
        });
      } finally {
        await client.close();
      }
    });

    test('without the content intent a guild message arrives blank unless it mentions the bot', async () => {
      const { bot, client } = await identified(
        GatewayIntent.GUILDS | GatewayIntent.GUILD_MESSAGES
      );
      const { caller } = await initTest(1);

      try {
        await caller.messages.send({
          channelId: 1,
          content: '<p>secret</p>',
          files: []
        });

        expect((await client.dispatch('MESSAGE_CREATE')).d.content).toBe('');

        await caller.messages.send({
          channelId: 1,
          content: `<p><span data-type="mention" data-user-id="${bot.id}" class="mention">@Helper</span> hi</p>`,
          files: []
        });

        expect((await client.dispatch('MESSAGE_CREATE')).d.content).toContain(
          'hi'
        );
      } finally {
        await client.close();
      }
    });

    test('nothing arrives from a channel the bot cannot see, or without the intent', async () => {
      const { client } = await identified(GatewayIntent.GUILDS);
      const { caller } = await initTest(1);

      try {
        await caller.messages.send({
          channelId: 1,
          content: '<p>no intent</p>',
          files: []
        });
        await caller.messages.send({
          channelId: 4,
          content: '<p>private</p>',
          files: []
        });

        expect(await client.none('MESSAGE_CREATE')).toBe(true);
      } finally {
        await client.close();
      }
    });

    test('edits and deletes follow', async () => {
      const { client } = await identified();
      const { caller } = await initTest(1);

      try {
        const messageId = await caller.messages.send({
          channelId: 1,
          content: '<p>draft</p>',
          files: []
        });
        const created = await client.dispatch('MESSAGE_CREATE');

        await caller.messages.edit({
          messageId: messageId!,
          content: '<p>final</p>'
        });

        expect((await client.dispatch('MESSAGE_UPDATE')).d.content).toBe(
          'final'
        );

        await caller.messages.delete({ messageId: messageId! });

        const deleted = await client.dispatch('MESSAGE_DELETE');

        expect(deleted.d).toMatchObject({
          id: created.d.id,
          channel_id: await channelOne()
        });
      } finally {
        await client.close();
      }
    });

    test('reactions arrive as reaction add and remove, named by character', async () => {
      const { client } = await identified();
      const { caller } = await initTest(1);

      try {
        const messageId = (await caller.messages.send({
          channelId: 1,
          content: '<p>react</p>',
          files: []
        }))!;
        const created = await client.dispatch('MESSAGE_CREATE');

        await caller.messages.toggleReaction({ messageId, emoji: '+1' });

        const added = await client.dispatch('MESSAGE_REACTION_ADD');

        expect(added.d).toMatchObject({
          message_id: created.d.id,
          channel_id: await channelOne(),
          emoji: { id: null, name: '👍' }
        });

        await caller.messages.toggleReaction({ messageId, emoji: '+1' });

        expect(
          (await client.dispatch('MESSAGE_REACTION_REMOVE')).d.message_id
        ).toBe(created.d.id);
      } finally {
        await client.close();
      }
    });

    test('typing arrives as typing start', async () => {
      const { client } = await identified();
      const { caller } = await initTest(1);

      try {
        await caller.messages.signalTyping({ channelId: 1 });

        const typing = await client.dispatch('TYPING_START');
        const owner = (await tdb
          .select()
          .from(users)
          .where(eq(users.id, 1))
          .get())!;

        expect(typing.d).toMatchObject({
          channel_id: await channelOne(),
          user_id: userSnowflake(owner)
        });
      } finally {
        await client.close();
      }
    });

    test('member changes arrive as member add and update', async () => {
      const { client } = await identified();
      const { caller } = await initTest(1);

      try {
        const { bot: other } = await caller.bots.create({ name: 'Second' });

        expect(
          (await client.dispatch('GUILD_MEMBER_ADD')).d.user.username
        ).toBe('Second');

        await caller.bots.rename({ botId: other.id, name: 'Renamed' });

        expect(
          (await client.dispatch('GUILD_MEMBER_UPDATE')).d.user.username
        ).toBe('Renamed');
      } finally {
        await client.close();
      }
    });

    test('requesting members answers with one chunk carrying the nonce', async () => {
      const { client, guild } = await identified();

      try {
        client.send({
          op: 8,
          d: { guild_id: guild.d.id, query: 'test', limit: 0, nonce: 'abc' }
        });

        const chunk = await client.dispatch('GUILD_MEMBERS_CHUNK');

        expect(chunk.d).toMatchObject({
          guild_id: guild.d.id,
          chunk_index: 0,
          chunk_count: 1,
          nonce: 'abc'
        });
        expect(
          chunk.d.members.map(
            (member: { user: { username: string } }) => member.user.username
          )
        ).toEqual(['Test Owner', 'Test User', 'Test Moderator']);
      } finally {
        await client.close();
      }
    });

    test('sequence numbers count every dispatch', async () => {
      const { client } = await identified();
      const { caller } = await initTest(1);

      try {
        await caller.messages.send({
          channelId: 1,
          content: '<p>seq</p>',
          files: []
        });

        const created = await client.dispatch('MESSAGE_CREATE');

        // presence updates from other members joining take their own numbers in between
        expect(created.s).toBeGreaterThan(2);
        expect(client.sequences).toEqual(
          client.sequences.map((_, index) => index + 1)
        );
      } finally {
        await client.close();
      }
    });
  });
});

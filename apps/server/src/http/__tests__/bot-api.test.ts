import { OWNER_ROLE_ID } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createTestBot, initTest } from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { config } from '../../config';
import { categories, channels, roles, users } from '../../db/schema';
import { getUnsupportedCalls } from '../../helpers/bot-compat-report';
import {
  categorySnowflake,
  channelSnowflake
} from '../../helpers/discord/channel';
import { DiscordPermission } from '../../helpers/discord/permissions';
import {
  decodeSnowflake,
  encodeSnowflake,
  SnowflakeTag
} from '../../helpers/discord/snowflake';
import { userSnowflake } from '../../helpers/discord/user';

type TJson = Record<string, unknown>;

const botFetch = (path: string, token?: string, init?: RequestInit) =>
  fetch(`${testsBaseUrl}/api/v10${path}`, {
    ...init,
    headers: token ? { Authorization: `Bot ${token}` } : {}
  });

const getJson = async (path: string, token: string) => {
  const response = await botFetch(path, token);

  return { status: response.status, body: (await response.json()) as TJson };
};

const getRow = async (table: typeof users | typeof channels, id: number) =>
  (await tdb.select().from(table).where(eq(table.id, id)).get())!;

const userId = async (id: number) => userSnowflake(await getRow(users, id));

const getGuildId = async () => {
  const ownerRole = await tdb
    .select()
    .from(roles)
    .where(eq(roles.id, OWNER_ROLE_ID))
    .get();

  return encodeSnowflake(SnowflakeTag.GUILD, 0, ownerRole!.createdAt);
};

describe('bot api', () => {
  describe('authentication', () => {
    test('refuses a missing, malformed or wrong token with a discord 401', async () => {
      const { token } = await createTestBot();
      const [id] = token.split('.');

      for (const header of [
        undefined,
        'not-a-token',
        `${id}.${'a'.repeat(43)}`,
        `2.${'a'.repeat(43)}`
      ]) {
        const response = await botFetch('/users/@me', header);

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
          message: '401: Unauthorized',
          code: 0
        });
      }
    });

    test('refuses a banned bot and a reset token', async () => {
      const { bot, token } = await createTestBot();
      const { caller } = await initTest(1);

      await caller.bots.resetToken({ botId: bot.id });
      expect((await botFetch('/users/@me', token)).status).toBe(401);

      const fresh = await caller.bots.resetToken({ botId: bot.id });

      expect((await botFetch('/users/@me', fresh)).status).toBe(200);

      await tdb.update(users).set({ banned: true }).where(eq(users.id, bot.id));
      expect((await botFetch('/users/@me', fresh)).status).toBe(401);
    });

    test('cuts off repeated failures from one address', async () => {
      for (
        let i = 0;
        i < config.rateLimiters.botApiAuthFailure.maxRequests;
        i++
      ) {
        await botFetch('/users/@me', 'nope');
      }

      const response = await botFetch('/users/@me', 'nope');
      const body = (await response.json()) as TJson;

      expect(response.status).toBe(429);
      expect(body.global).toBe(true);
      expect(body.retry_after).toBeGreaterThan(0);
    });
  });

  describe('rate limit', () => {
    test('answers past the global budget with a discord 429', async () => {
      const { token } = await createTestBot();
      const responses = await Promise.all(
        Array.from({ length: config.rateLimiters.botApi.maxRequests + 1 }, () =>
          botFetch('/users/@me', token)
        )
      );
      const limited = responses.filter((response) => response.status === 429);

      expect(limited.length).toBeGreaterThanOrEqual(1);
      expect(limited[0]!.headers.get('retry-after')).toBeTruthy();
      expect(((await limited[0]!.json()) as TJson).message).toBe(
        'You are being rate limited.'
      );
    });
  });

  describe('rate limit headers', () => {
    // discord.py reads every one of these as soon as it sees the limit header
    test('every response carries the full discord header set', async () => {
      const { token } = await createTestBot();
      const response = await botFetch('/users/@me', token);

      expect(response.headers.get('x-ratelimit-limit')).toBe('50');
      expect(Number(response.headers.get('x-ratelimit-remaining'))).toBe(49);
      expect(Number(response.headers.get('x-ratelimit-reset'))).toBeGreaterThan(
        Date.now() / 1000
      );
      expect(
        Number(response.headers.get('x-ratelimit-reset-after'))
      ).toBeGreaterThan(0);
      expect(response.headers.get('x-ratelimit-bucket')).toBe('global');
    });
  });

  describe('application', () => {
    test('the bot is its own application, owned by whoever created it', async () => {
      const { token } = await createTestBot();

      for (const path of ['/applications/@me', '/oauth2/applications/@me']) {
        const { status, body } = await getJson(path, token);

        expect(status).toBe(200);
        expect(body).toMatchObject({
          id: (await getJson('/users/@me', token)).body.id,
          name: 'Helper',
          bot_public: false,
          bot_require_code_grant: false,
          owner: { username: 'Test Owner' }
        });
      }
    });
  });

  describe('routing', () => {
    test('unknown routes and methods get discord errors', async () => {
      const { token } = await createTestBot();
      const missing = await botFetch('/nothing/here', token);

      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({
        message: '404: Not Found',
        code: 0
      });

      const wrongMethod = await botFetch('/users/@me', token, {
        method: 'DELETE'
      });

      expect(wrongMethod.status).toBe(405);
    });

    test('unsupported calls are counted in the bot report, by endpoint', async () => {
      const { bot, token } = await createTestBot();

      await botFetch('/guilds/123/bans', token);
      await botFetch('/guilds/456/bans', token);
      await botFetch('/users/@me', token, { method: 'DELETE' });

      expect(getUnsupportedCalls(bot.id)).toEqual([
        expect.objectContaining({
          call: 'GET /guilds/{id}/bans',
          count: 2,
          stubbed: false
        }),
        expect.objectContaining({
          call: 'DELETE /users/@me',
          count: 1,
          stubbed: false
        })
      ]);
    });

    test('lists bots fetch while starting are answered empty, and still reported', async () => {
      const { bot, token } = await createTestBot();

      for (const list of ['emojis', 'stickers', 'scheduled-events']) {
        const response = await botFetch(`/guilds/1/${list}`, token);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
      }

      expect(
        getUnsupportedCalls(bot.id).map(({ call, stubbed }) => ({
          call,
          stubbed
        }))
      ).toEqual([
        { call: 'GET /guilds/{id}/emojis', stubbed: true },
        { call: 'GET /guilds/{id}/stickers', stubbed: true },
        { call: 'GET /guilds/{id}/scheduled-events', stubbed: true }
      ]);
    });
  });

  describe('users', () => {
    test('@me is the bot, with a snowflake that decodes to its row', async () => {
      const { bot, token } = await createTestBot();
      const { status, body } = await getJson('/users/@me', token);
      const row = await getRow(users, bot.id);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: userSnowflake(row),
        username: 'Helper',
        discriminator: '0',
        bot: true
      });
      expect(decodeSnowflake(body.id as string)).toEqual({
        tag: SnowflakeTag.USER,
        idBits: bot.id,
        timestamp: Math.max(row.createdAt, 1_420_070_400_000)
      });
    });

    test('looks up any member by snowflake', async () => {
      const { token } = await createTestBot();
      const { status, body } = await getJson(
        `/users/${await userId(2)}`,
        token
      );

      expect(status).toBe(200);
      expect(body).toMatchObject({ username: 'Test User', bot: false });
    });

    test('an unknown or forged user id is an unknown user', async () => {
      const { token } = await createTestBot();
      const row = await getRow(users, 2);

      for (const id of [
        encodeSnowflake(SnowflakeTag.USER, 999, Date.now()),
        encodeSnowflake(SnowflakeTag.USER, 2, row.createdAt + 1),
        encodeSnowflake(SnowflakeTag.CHANNEL, 2, row.createdAt),
        'abc'
      ]) {
        const { status, body } = await getJson(`/users/${id}`, token);

        expect(status).toBe(404);
        expect(body).toEqual({ message: 'Unknown User', code: 10013 });
      }
    });
  });

  describe('guild', () => {
    test('the server is one guild owned by the owner', async () => {
      const { token } = await createTestBot();
      const guildId = await getGuildId();
      const { status, body } = await getJson(`/guilds/${guildId}`, token);

      expect(status).toBe(200);
      expect(body).toMatchObject({
        id: guildId,
        name: 'Test Server',
        owner_id: await userId(1)
      });
    });

    test('any other guild id is an unknown guild', async () => {
      const { token } = await createTestBot();

      for (const path of ['/guilds/123', '/guilds/123/roles']) {
        const { status, body } = await getJson(path, token);

        expect(status).toBe(404);
        expect(body).toEqual({ message: 'Unknown Guild', code: 10004 });
      }
    });

    test('roles include @everyone under the guild id and an administrator owner role', async () => {
      const { token } = await createTestBot();
      const guildId = await getGuildId();
      const { body } = await getJson(`/guilds/${guildId}/roles`, token);
      const list = body as unknown as TJson[];
      const everyone = list.find((role) => role.id === guildId);
      const owner = list.find((role) => role.name === 'Owner');

      expect(everyone).toMatchObject({ name: '@everyone', position: 0 });
      expect(
        BigInt(everyone!.permissions as string) & DiscordPermission.VIEW_CHANNEL
      ).toBe(DiscordPermission.VIEW_CHANNEL);
      expect(
        BigInt(owner!.permissions as string) & DiscordPermission.ADMINISTRATOR
      ).toBe(DiscordPermission.ADMINISTRATOR);
      expect(list).toHaveLength(5);
    });
  });

  describe('channels', () => {
    test('lists categories and the guild channels the bot can see, never dms', async () => {
      const { token } = await createTestBot();
      const guildId = await getGuildId();
      const { body } = await getJson(`/guilds/${guildId}/channels`, token);
      const names = (body as unknown as TJson[]).map((channel) => [
        channel.name,
        channel.type
      ]);

      expect(names).toEqual([
        ['Text Channels', 4],
        ['Voice Channels', 4],
        ['General', 0],
        ['Voice', 2],
        ['Restricted Text', 0]
      ]);
    });

    test('a visible channel and a category resolve by id', async () => {
      const { token } = await createTestBot();
      const general = await getRow(channels, 1);
      const category = (await tdb
        .select()
        .from(categories)
        .where(eq(categories.id, 1))
        .get())!;

      const channel = await getJson(
        `/channels/${channelSnowflake(general)}`,
        token
      );

      expect(channel.status).toBe(200);
      expect(channel.body).toMatchObject({
        name: 'General',
        type: 0,
        guild_id: await getGuildId(),
        parent_id: categorySnowflake(category)
      });

      const categoryResponse = await getJson(
        `/channels/${categorySnowflake(category)}`,
        token
      );

      expect(categoryResponse.body).toMatchObject({
        name: 'Text Channels',
        type: 4
      });
    });

    test('a private channel or a dm the bot is not in reads as unknown', async () => {
      const { token } = await createTestBot();

      for (const id of [3, 4]) {
        const { status, body } = await getJson(
          `/channels/${channelSnowflake(await getRow(channels, id))}`,
          token
        );

        expect(status).toBe(404);
        expect(body).toEqual({ message: 'Unknown Channel', code: 10003 });
      }
    });
  });

  describe('members', () => {
    test('pages members by user snowflake, leaving out the placeholder and banned accounts', async () => {
      const { bot, token } = await createTestBot();
      const guildId = await getGuildId();

      await tdb.update(users).set({ banned: true }).where(eq(users.id, 3));

      const all = await getJson(`/guilds/${guildId}/members?limit=1000`, token);
      const ids = (all.body as unknown as TJson[]).map(
        (member) => (member.user as TJson).id
      );

      expect(ids).toEqual(
        await Promise.all([1, 2, 4, 5, 6, 7, 8, bot.id].map(userId))
      );

      const first = await getJson(`/guilds/${guildId}/members`, token);

      expect(first.body as unknown as TJson[]).toHaveLength(1);

      const next = await getJson(
        `/guilds/${guildId}/members?limit=2&after=${ids[0]}`,
        token
      );

      expect(
        (next.body as unknown as TJson[]).map(
          (member) => (member.user as TJson).id
        )
      ).toEqual([ids[1], ids[2]]);
    });

    test('rejects an invalid limit or cursor as an invalid form body', async () => {
      const { token } = await createTestBot();
      const guildId = await getGuildId();

      for (const query of ['limit=0', 'limit=1001', 'after=abc']) {
        const { status, body } = await getJson(
          `/guilds/${guildId}/members?${query}`,
          token
        );

        expect(status).toBe(400);
        expect(body).toEqual({ message: 'Invalid Form Body', code: 50035 });
      }
    });

    test('a single member carries its role snowflakes', async () => {
      const { token } = await createTestBot();
      const guildId = await getGuildId();
      const { status, body } = await getJson(
        `/guilds/${guildId}/members/${await userId(1)}`,
        token
      );

      expect(status).toBe(200);
      expect((body.user as TJson).username).toBe('Test Owner');
      expect(body.roles as string[]).toHaveLength(1);
    });

    test('an unknown member is unknown', async () => {
      const { token } = await createTestBot();
      const guildId = await getGuildId();
      const { status, body } = await getJson(
        `/guilds/${guildId}/members/${encodeSnowflake(SnowflakeTag.USER, 999, Date.now())}`,
        token
      );

      expect(status).toBe(404);
      expect(body).toEqual({ message: 'Unknown Member', code: 10007 });
    });
  });
});

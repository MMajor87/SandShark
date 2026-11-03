import {
  ActivityLogType,
  DELETED_USER_IDENTITY_AND_NAME,
  ServerEvents,
  sha256,
  type TJoinedPublicUser
} from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getCaller, initTest, login } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { config } from '../../config';
import { bots, messages, userRoles, users } from '../../db/schema';
import * as activityLog from '../../queues/activity-log';
import { pubsub } from '../../utils/pubsub';

const collectEvents = <T extends ServerEvents>(event: T) => {
  const received: unknown[] = [];
  const subscription = pubsub.subscribe(event).subscribe({
    next: (payload) => {
      received.push(payload);
    }
  });

  return { received, stop: () => subscription.unsubscribe() };
};

const getBotRow = (botId: number) =>
  tdb.select().from(bots).where(eq(bots.userId, botId)).get();

const getUserRow = (userId: number) =>
  tdb.select().from(users).where(eq(users.id, userId)).get();

const splitToken = (token: string) => {
  const [id, secret] = token.split('.');

  return { id: Number(id), secret: secret! };
};

const createBot = async (name = 'Helper') => {
  const { caller } = await initTest(1);

  return caller.bots.create({ name });
};

describe('bots router', () => {
  describe('create', () => {
    test('stores a bot user with the default role and only a hash of its token', async () => {
      const { caller } = await initTest(1);
      const created = collectEvents(ServerEvents.USER_CREATE);
      const logs = spyOn(activityLog, 'enqueueActivityLog');

      try {
        const { bot, token } = await caller.bots.create({ name: ' Helper ' });
        const { id, secret } = splitToken(token);

        expect(id).toBe(bot.id);
        expect(secret.length).toBeGreaterThanOrEqual(43);
        expect(bot).toMatchObject({ name: 'Helper', createdBy: 1 });

        const user = await getUserRow(bot.id);

        expect(user).toMatchObject({
          name: 'Helper',
          isBot: true,
          passwordSet: false
        });
        expect(user!.identity.startsWith('bot:')).toBe(true);

        const row = await getBotRow(bot.id);

        expect(row!.tokenHash).toBe(await sha256(secret));
        expect(row!.tokenHash).not.toContain(secret);

        const roles = await tdb
          .select()
          .from(userRoles)
          .where(eq(userRoles.userId, bot.id));

        expect(roles.map((role) => role.roleId)).toEqual([2]);
        expect(bot.roleIds).toEqual([2]);

        await Bun.sleep(10);

        expect(created.received).toHaveLength(1);
        expect(created.received[0] as TJoinedPublicUser).toMatchObject({
          id: bot.id,
          isBot: true
        });
        expect(logs).toHaveBeenCalledWith({
          type: ActivityLogType.CREATED_BOT,
          userId: 1,
          details: { botId: bot.id, name: 'Helper' }
        });
      } finally {
        created.stop();
      }
    });

    test('requires the manage bots permission', async () => {
      const { caller } = await initTest(2);

      await expect(caller.bots.create({ name: 'Helper' })).rejects.toThrow(
        'Insufficient permissions'
      );
      expect(await tdb.select().from(bots)).toHaveLength(0);
    });

    test('validates the name like a user name', async () => {
      const { caller } = await initTest(1);

      for (const name of [
        ' ',
        'x'.repeat(25),
        DELETED_USER_IDENTITY_AND_NAME
      ]) {
        await expect(caller.bots.create({ name })).rejects.toMatchObject({
          code: 'BAD_REQUEST'
        });
      }
    });

    test('requires authentication', async () => {
      const { caller } = await getCaller(1, undefined, {
        authenticated: false
      });

      await expect(caller.bots.create({ name: 'Helper' })).rejects.toThrow(
        'You must be authenticated'
      );
    });

    test('is rate limited', async () => {
      const { caller } = await initTest(1);

      for (let i = 0; i < config.rateLimiters.adminCreate.maxRequests; i++) {
        await caller.bots.create({ name: `Helper ${i}` });
      }

      await expect(caller.bots.create({ name: 'One more' })).rejects.toThrow(
        'Too many requests. Please try again shortly.'
      );
    });
  });

  describe('getAll', () => {
    test('lists bots with their roles and never their token', async () => {
      const { bot } = await createBot();
      const { caller } = await initTest(1);
      const list = await caller.bots.getAll();

      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: bot.id,
        name: 'Helper',
        createdBy: 1,
        roleIds: [2]
      });
      expect(list[0]).not.toHaveProperty('tokenHash');
    });

    test('does not list ordinary users', async () => {
      const { caller } = await initTest(1);

      expect(await caller.bots.getAll()).toEqual([]);
    });

    test('requires the manage bots permission', async () => {
      const { caller } = await initTest(2);

      await expect(caller.bots.getAll()).rejects.toThrow(
        'Insufficient permissions'
      );
    });
  });

  describe('rename', () => {
    test('renames the bot user and publishes the change', async () => {
      const { bot } = await createBot();
      const { caller } = await initTest(1);
      const updated = collectEvents(ServerEvents.USER_UPDATE);
      const logs = spyOn(activityLog, 'enqueueActivityLog');

      try {
        await caller.bots.rename({ botId: bot.id, name: 'Assistant' });

        expect((await getUserRow(bot.id))?.name).toBe('Assistant');

        await Bun.sleep(10);

        expect(updated.received).toHaveLength(1);
        expect(logs).toHaveBeenCalledWith({
          type: ActivityLogType.UPDATED_BOT,
          userId: 1,
          details: { botId: bot.id, fromName: 'Helper', toName: 'Assistant' }
        });
      } finally {
        updated.stop();
      }
    });

    test('cannot rename a user who is not a bot', async () => {
      const { caller } = await initTest(1);

      for (const botId of [2, 999]) {
        await expect(
          caller.bots.rename({ botId, name: 'Assistant' })
        ).rejects.toThrow('Bot not found.');
      }

      expect((await getUserRow(2))?.name).toBe('Test User');
    });

    test('requires the manage bots permission', async () => {
      const { bot } = await createBot();
      const { caller } = await initTest(2);

      await expect(
        caller.bots.rename({ botId: bot.id, name: 'Assistant' })
      ).rejects.toThrow('Insufficient permissions');
    });

    test('validates the name and the id', async () => {
      const { bot } = await createBot();
      const { caller } = await initTest(1);

      for (const invalid of [
        { botId: bot.id, name: '' },
        { botId: bot.id, name: DELETED_USER_IDENTITY_AND_NAME },
        { botId: 0, name: 'Assistant' }
      ]) {
        await expect(caller.bots.rename(invalid)).rejects.toMatchObject({
          code: 'BAD_REQUEST'
        });
      }
    });
  });

  describe('resetToken', () => {
    test('replaces the stored hash so only the new token is valid', async () => {
      const { bot, token } = await createBot();
      const { caller } = await initTest(1);
      const logs = spyOn(activityLog, 'enqueueActivityLog');
      const before = await getBotRow(bot.id);

      const newToken = await caller.bots.resetToken({ botId: bot.id });
      const after = await getBotRow(bot.id);

      expect(newToken).not.toBe(token);
      expect(splitToken(newToken).id).toBe(bot.id);
      expect(after!.tokenHash).toBe(await sha256(splitToken(newToken).secret));
      expect(after!.tokenHash).not.toBe(before!.tokenHash);
      expect(after!.tokenUpdatedAt).toBeGreaterThanOrEqual(
        before!.tokenUpdatedAt
      );
      expect(logs).toHaveBeenCalledWith({
        type: ActivityLogType.RESET_BOT_TOKEN,
        userId: 1,
        details: { botId: bot.id, name: 'Helper' }
      });
    });

    test('cannot reset a user who is not a bot', async () => {
      const { caller } = await initTest(1);

      await expect(caller.bots.resetToken({ botId: 2 })).rejects.toThrow(
        'Bot not found.'
      );
    });

    test('requires the manage bots permission', async () => {
      const { bot } = await createBot();
      const before = await getBotRow(bot.id);
      const { caller } = await initTest(2);

      await expect(caller.bots.resetToken({ botId: bot.id })).rejects.toThrow(
        'Insufficient permissions'
      );
      expect((await getBotRow(bot.id))!.tokenHash).toBe(before!.tokenHash);
    });
  });

  describe('delete', () => {
    test('removes the bot user and its token, keeping its messages under the placeholder', async () => {
      const { bot } = await createBot();
      const [message] = await tdb
        .insert(messages)
        .values({
          channelId: 1,
          userId: bot.id,
          content: '<p>beep</p>',
          createdAt: Date.now()
        })
        .returning();
      const { caller } = await initTest(1);

      await caller.bots.delete({ botId: bot.id });

      expect(await getUserRow(bot.id)).toBeUndefined();
      expect(await getBotRow(bot.id)).toBeUndefined();

      const kept = await tdb
        .select()
        .from(messages)
        .where(eq(messages.id, message!.id))
        .get();

      expect(kept?.userId).not.toBe(bot.id);
    });

    test('cannot delete a user who is not a bot', async () => {
      const { caller } = await initTest(1);

      await expect(caller.bots.delete({ botId: 2 })).rejects.toThrow(
        'Bot not found.'
      );
      expect(await getUserRow(2)).toBeDefined();
    });

    test('requires the manage bots permission', async () => {
      const { bot } = await createBot();
      const { caller } = await initTest(2);

      await expect(caller.bots.delete({ botId: bot.id })).rejects.toThrow(
        'Insufficient permissions'
      );
      expect(await getUserRow(bot.id)).toBeDefined();
    });
  });

  describe('sign in', () => {
    test('a bot cannot log in even with a password set on its row', async () => {
      const { bot } = await createBot();
      const user = await getUserRow(bot.id);

      await tdb
        .update(users)
        .set({ password: await Bun.password.hash('botpassword') })
        .where(eq(users.id, bot.id));

      const response = await login(user!.identity, 'botpassword');
      const data = (await response.json()) as {
        errors: Record<string, string>;
      };

      expect(response.status).toBe(400);
      expect(data.errors).toHaveProperty('identity', 'Invalid credentials');
    });

    test('a session token issued for a bot is refused', async () => {
      const { bot } = await createBot();

      await expect(getCaller(bot.id)).rejects.toThrow(
        'Invalid authentication token'
      );
    });
  });
});

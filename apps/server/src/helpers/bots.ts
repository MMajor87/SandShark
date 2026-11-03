import { ActivityLogType, type TJoinedBot } from '@sandshark/shared';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { publishUser } from '../db/publishers';
import { getDefaultRole } from '../db/queries/roles';
import { bots, userRoles, users } from '../db/schema';
import { enqueueActivityLog } from '../queues/activity-log';
import { invariant } from '../utils/invariant';
import { createBotSecret, formatBotToken } from './bot-tokens';

// a bot is a user that holds roles like anyone else, so every permission check applies to
// it unchanged. it has no usable password and no identity anyone knows, and login refuses it
const createBot = async (name: string, actorUserId: number) => {
  const [{ secret, secretHash }, defaultRole] = await Promise.all([
    createBotSecret(),
    getDefaultRole()
  ]);

  invariant(defaultRole, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'The server has no default role to give the bot.'
  });

  const now = Date.now();

  const bot = db.transaction((tx) => {
    const user = tx
      .insert(users)
      .values({
        name,
        identity: `bot:${Bun.randomUUIDv7()}`,
        password: Bun.randomUUIDv7(),
        passwordSet: false,
        isBot: true,
        createdAt: now
      })
      .returning({ id: users.id, name: users.name })
      .get();

    tx.insert(userRoles)
      .values({ userId: user.id, roleId: defaultRole.id, createdAt: now })
      .run();

    tx.insert(bots)
      .values({
        userId: user.id,
        tokenHash: secretHash,
        createdBy: actorUserId,
        tokenUpdatedAt: now,
        createdAt: now
      })
      .run();

    return user;
  });

  publishUser(bot.id, 'create');
  enqueueActivityLog({
    type: ActivityLogType.CREATED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name }
  });

  const joined: TJoinedBot = {
    id: bot.id,
    name: bot.name,
    createdAt: now,
    createdBy: actorUserId,
    tokenUpdatedAt: now,
    roleIds: [defaultRole.id]
  };

  return { bot: joined, token: formatBotToken(bot.id, secret) };
};

const renameBot = async (
  bot: { id: number; name: string },
  name: string,
  actorUserId: number
) => {
  await db
    .update(users)
    .set({ name, updatedAt: Date.now() })
    .where(eq(users.id, bot.id))
    .run();

  publishUser(bot.id, 'update');
  enqueueActivityLog({
    type: ActivityLogType.UPDATED_BOT,
    userId: actorUserId,
    details: { botId: bot.id, fromName: bot.name, toName: name }
  });
};

// the old token stops working the moment the new hash is written, and the version bump
// retires the media links handed out with it
const resetBotToken = async (
  bot: { id: number; name: string },
  actorUserId: number
) => {
  const { secret, secretHash } = await createBotSecret();
  const now = Date.now();

  db.transaction((tx) => {
    tx.update(bots)
      .set({ tokenHash: secretHash, tokenUpdatedAt: now })
      .where(eq(bots.userId, bot.id))
      .run();
    tx.update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1`, updatedAt: now })
      .where(eq(users.id, bot.id))
      .run();
  });

  enqueueActivityLog({
    type: ActivityLogType.RESET_BOT_TOKEN,
    userId: actorUserId,
    details: { botId: bot.id, name: bot.name }
  });

  return formatBotToken(bot.id, secret);
};

export { createBot, renameBot, resetBotToken };

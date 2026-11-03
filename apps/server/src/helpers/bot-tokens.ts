import { sha256 } from '@sandshark/shared';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db } from '../db';
import { getUserById } from '../db/queries/users';
import { bots } from '../db/schema';
import { safeCompare } from './safe-compare';

// the token is `<bot user id>.<secret>`. the id lets a request find its bot without
// scanning every hash, and only the secret is stored, hashed
const createBotSecret = async () => {
  const secret = randomBytes(32).toString('base64url');

  return { secret, secretHash: await sha256(secret) };
};

const formatBotToken = (botId: number, secret: string) => `${botId}.${secret}`;

const BOT_AUTHORIZATION = /^Bot (\d{1,10})\.([A-Za-z0-9_-]{43})$/;

// resolves an `Authorization: Bot <token>` header to its bot user. a banned bot, or a
// user row that is not a bot, never authenticates
const getBotUserByAuthorization = async (header: string | undefined) => {
  const match = header ? BOT_AUTHORIZATION.exec(header) : null;

  if (!match) return undefined;

  const botId = Number(match[1]);
  const [row, user] = await Promise.all([
    db
      .select({ tokenHash: bots.tokenHash })
      .from(bots)
      .where(eq(bots.userId, botId))
      .limit(1)
      .get(),
    getUserById(botId)
  ]);

  if (!row || !user || !user.isBot || user.banned) return undefined;

  const secretHash = await sha256(match[2]!);

  return safeCompare(secretHash, row.tokenHash) ? user : undefined;
};

export { createBotSecret, formatBotToken, getBotUserByAuthorization };

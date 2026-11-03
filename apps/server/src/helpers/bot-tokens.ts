import { sha256 } from '@sandshark/shared';
import { randomBytes } from 'node:crypto';

// the token is `<bot user id>.<secret>`. the id lets a request find its bot without
// scanning every hash, and only the secret is stored, hashed
const createBotSecret = async () => {
  const secret = randomBytes(32).toString('base64url');

  return { secret, secretHash: await sha256(secret) };
};

const formatBotToken = (botId: number, secret: string) => `${botId}.${secret}`;

export { createBotSecret, formatBotToken };

import { randomBytes } from 'crypto';

const INTENT_TTL_MS = 5 * 60 * 1000;

type TDeleteIntent = {
  userId: number;
  wipe: boolean;
  expiresAt: number;
  bound: boolean;
};

const intents = new Map<string, TDeleteIntent>();
const states = new Map<string, string>();

const sweepExpiredIntents = () => {
  const now = Date.now();

  for (const [code, intent] of intents) {
    if (intent.expiresAt <= now) intents.delete(code);
  }
  for (const [state, code] of states) {
    if (!intents.has(code)) states.delete(state);
  }
};

const createAccountDeleteIntent = (userId: number, wipe: boolean) => {
  sweepExpiredIntents();
  const code = randomBytes(32).toString('base64url');

  intents.set(code, {
    userId,
    wipe,
    expiresAt: Date.now() + INTENT_TTL_MS,
    bound: false
  });

  return code;
};

const bindAccountDeleteIntent = (code: string, state: string) => {
  sweepExpiredIntents();
  const intent = intents.get(code);

  if (!intent || intent.bound) return false;

  intent.bound = true;
  states.set(state, code);
  return true;
};

const takeAccountDeleteIntent = (state: string) => {
  const code = states.get(state);
  states.delete(state);

  if (!code) return undefined;

  const intent = intents.get(code);
  intents.delete(code);

  return intent && intent.expiresAt > Date.now() ? intent : undefined;
};

const hasAccountDeleteIntent = (state: string) => states.has(state);

const clearAccountDeleteIntentsForTests = () => {
  intents.clear();
  states.clear();
};

export {
  bindAccountDeleteIntent,
  clearAccountDeleteIntentsForTests,
  createAccountDeleteIntent,
  hasAccountDeleteIntent,
  takeAccountDeleteIntent
};

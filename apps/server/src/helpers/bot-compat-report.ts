import type { THostedBotUnsupportedCall } from '@sandshark/shared';
import { HostedBotRuntime } from '../runtimes/hosted-bot';

// distinct calls kept per bot. a bot that calls more than this many unsupported endpoints has
// told us enough, and the cap keeps a misbehaving one from growing the map without end
const MAX_CALLS_PER_BOT = 100;

const callsByBot = new Map<number, Map<string, THostedBotUnsupportedCall>>();

// what a porting admin needs to know about a call this server does not support: the first
// one goes to the bot's log as one line, every later one only counts
const recordUnsupportedCall = (
  botId: number,
  call: string,
  stubbed = false
) => {
  let calls = callsByBot.get(botId);

  if (!calls) {
    calls = new Map();
    callsByBot.set(botId, calls);
  }

  const existing = calls.get(call);

  if (existing) {
    existing.count += 1;
    existing.lastAt = Date.now();
    return;
  }

  if (calls.size >= MAX_CALLS_PER_BOT) return;

  calls.set(call, { call, count: 1, lastAt: Date.now(), stubbed });
  HostedBotRuntime.note(
    botId,
    stubbed ? `unsupported, answered empty: ${call}` : `unsupported: ${call}`
  );
};

const getUnsupportedCalls = (botId: number) => {
  const calls = callsByBot.get(botId);

  if (!calls) return [];

  return [...calls.values()].sort((a, b) => b.count - a.count);
};

const clearUnsupportedCalls = (botId: number) => {
  callsByBot.delete(botId);
};

const clearUnsupportedCallsForTests = () => {
  callsByBot.clear();
};

// ids, interaction tokens and emoji differ on every call, so they are folded into
// placeholders and one endpoint counts as one entry
const describeRestCall = (method: string, path: string) => {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  const described = segments.map((segment, index) => {
    if (/^\d+$/.test(segment)) return '{id}';
    if (segments[index - 1] === 'reactions') return '{emoji}';
    if (segment.length > 32) return '{token}';

    return segment;
  });

  return `${method} /${described.join('/')}`;
};

export {
  clearUnsupportedCalls,
  clearUnsupportedCallsForTests,
  describeRestCall,
  getUnsupportedCalls,
  recordUnsupportedCall
};

import fs from 'fs/promises';
import path from 'path';
import { HOSTED_BOTS_PATH } from './paths';

// preloaded into every hosted javascript bot before its own code, so an unmodified bot that
// talks to discord talks to this server instead. it is kept as source here because the
// server ships as one compiled binary, and written out before a bot starts.
//
// discord's api moves to this server's, its gateway to this server's gateway, and every
// other connection to a discord host is refused: the bot's token is this server's, and no
// library the rewrite does not know about may carry it to discord. traffic to any other
// host is left alone, bots call weather, ai and game apis
const HOSTED_BOT_SHIM_SOURCE = String.raw`
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';

const API_URL = process.env.SANDSHARK_API_URL;
const GATEWAY_URL = process.env.SANDSHARK_GATEWAY_URL;
const API_HOSTS = new Set([
  'discord.com',
  'www.discord.com',
  'canary.discord.com',
  'ptb.discord.com',
  'discordapp.com',
  'www.discordapp.com'
]);
const DISCORD_HOST = /(^|\.)(discord\.com|discordapp\.com|discord\.gg|discordapp\.net|discord\.media)$/i;

const refuse = (host) => {
  const message =
    'sandshark: refused a connection to ' +
    host +
    ', a hosted bot only talks to this server';

  console.error(message);

  return new Error(message);
};

const rewrite = (input) => {
  let url;

  try {
    url = new URL(String(input));
  } catch {
    return input;
  }

  if (!DISCORD_HOST.test(url.hostname)) return input;

  const host = url.hostname.toLowerCase();

  if (API_HOSTS.has(host) && /^\/api(\/|$)/.test(url.pathname)) {
    return API_URL + url.pathname.slice(4) + url.search;
  }

  if (host === 'gateway.discord.gg' || host.endsWith('.gateway.discord.gg')) {
    return GATEWAY_URL + url.search;
  }

  throw refuse(host);
};

const originalFetch = globalThis.fetch;

// async, so a refusal rejects like any failed fetch instead of throwing at the call
globalThis.fetch = async (input, init) => {
  if (input instanceof Request) {
    const target = rewrite(input.url);

    return originalFetch(target === input.url ? input : new Request(target, input), init);
  }

  return originalFetch(rewrite(input), init);
};

const OriginalWebSocket = globalThis.WebSocket;

// node before 22 has no WebSocket of its own, its libraries bring one built on node:https
if (OriginalWebSocket) {
  globalThis.WebSocket = class extends OriginalWebSocket {
    constructor(url, protocols) {
      super(rewrite(url), protocols);
    }
  };
}

// node's own clients are only guarded, a library using them for discord is rare enough
// that refusing is better than rewriting options objects of every shape
const guard = (module) => {
  for (const name of ['request', 'get']) {
    const original = module[name];

    module[name] = (...args) => {
      const [first] = args;
      const host =
        typeof first === 'string' || first instanceof URL
          ? new URL(String(first)).hostname
          : (first?.hostname ?? first?.host ?? '');

      if (DISCORD_HOST.test(String(host).split(':')[0])) throw refuse(host);

      return original.apply(module, args);
    };
  }
};

guard(http);
guard(https);

// on node, discord.js sends its requests through undici rather than fetch, and undici's
// copies all share the one dispatcher stored under this symbol. node only creates it on its
// first fetch, so a fetch that never leaves the process creates it here, and every request
// through it is rewritten like a fetch. bun has no such dispatcher, its fetch is its own
const DISPATCHER = Symbol.for('undici.globalDispatcher.1');

if (!globalThis.Bun) {
  originalFetch('data:,').catch(() => {});
}

const dispatcher = globalThis[DISPATCHER];

if (dispatcher) {
  globalThis[DISPATCHER] = new Proxy(dispatcher, {
    get(target, property) {
      if (property === 'dispatch') {
        return (options, handler) => {
          const url = String(new URL(options.path, options.origin));
          const rewritten = rewrite(url);

          if (rewritten === url) return target.dispatch(options, handler);

          const next = new URL(rewritten);

          return target.dispatch(
            { ...options, origin: next.origin, path: next.pathname + next.search },
            handler
          );
        };
      }

      const value = Reflect.get(target, property);

      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

// below every client on node, a name lookup of a discord host is refused, so a library that
// brings its own undici agent or socket still cannot reach discord
const originalLookup = dns.lookup;

dns.lookup = (hostname, ...args) => {
  if (!DISCORD_HOST.test(String(hostname))) {
    return originalLookup.call(dns, hostname, ...args);
  }

  const error = refuse(hostname);
  const callback = args.at(-1);

  if (typeof callback !== 'function') throw error;

  process.nextTick(callback, error);
};
`;

const HOSTED_BOT_SHIM_PATH = path.join(
  HOSTED_BOTS_PATH,
  '.shim',
  'preload.mjs'
);

const writeHostedBotShim = async () => {
  await fs.mkdir(path.dirname(HOSTED_BOT_SHIM_PATH), { recursive: true });
  await fs.writeFile(HOSTED_BOT_SHIM_PATH, HOSTED_BOT_SHIM_SOURCE);

  return HOSTED_BOT_SHIM_PATH;
};

export { writeHostedBotShim };

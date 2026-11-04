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

globalThis.WebSocket = class extends OriginalWebSocket {
  constructor(url, protocols) {
    super(rewrite(url), protocols);
  }
};

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

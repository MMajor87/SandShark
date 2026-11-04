export enum HostedBotStatus {
  STOPPED = 'stopped',
  INSTALLING = 'installing',
  STARTING = 'starting',
  RUNNING = 'running',
  CRASHED = 'crashed'
}

// where the bot's code came from: a zip the admin uploaded, or a github repository the
// server downloads again on every update
export enum HostedBotSourceType {
  UPLOAD = 'upload',
  GITHUB = 'github'
}

// what runs a javascript bot. bun is the server's own runtime and needs nothing installed,
// node is for bots whose native add-ons bun cannot load
export enum HostedBotJsRuntime {
  BUN = 'bun',
  NODE = 'node'
}

// starter code an admin can host in one click, for a bot that has none yet
export enum HostedBotTemplate {
  PING = 'ping'
}

export type THostedBotSource = {
  type: HostedBotSourceType;
  url: string | null;
  ref: string | null;
};

export type THostedBotLogStream = 'stdout' | 'stderr' | 'system';

export type THostedBotLogEntry = {
  botId: number;
  stream: THostedBotLogStream;
  timestamp: number;
  message: string;
};

// a call the bot made that this server does not support, counted rather than repeated.
// stubbed calls were answered with a harmless empty result instead of an error
export type THostedBotUnsupportedCall = {
  call: string;
  count: number;
  lastAt: number;
  stubbed: boolean;
};

// what the settings page sees of a hosted bot. the env values never leave the server, only
// their names do
export type THostedBot = {
  botId: number;
  enabled: boolean;
  status: HostedBotStatus;
  startedAt: number | null;
  restarts: number;
  envNames: string[];
  tokenEnvNames: string[];
  jsRuntime: HostedBotJsRuntime;
  source: THostedBotSource | null;
  codeUpdatedAt: number | null;
  unsupported: THostedBotUnsupportedCall[];
};

// the part of a hosted bot that only the running process knows, published as it changes
export type THostedBotState = Pick<
  THostedBot,
  'botId' | 'status' | 'startedAt' | 'restarts'
>;

// the names a bot reads its token from without being told, the way most guides write it
export const HOSTED_BOT_DEFAULT_TOKEN_ENV_NAMES = [
  'DISCORD_TOKEN',
  'TOKEN',
  'BOT_TOKEN'
];

// a public repository, written the way its page address reads
export const HOSTED_BOT_GITHUB_URL_REGEX =
  /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;
// a branch, tag or commit. it ends up in a url path, so it may never climb out with ..
export const HOSTED_BOT_GITHUB_REF_REGEX = /^(?!.*\.\.)[\w./-]{1,255}$/;

export const HOSTED_BOT_ENV_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const HOSTED_BOT_MAX_ENV_VARS = 50;
export const HOSTED_BOT_MAX_ENV_VALUE_LENGTH = 4096;
export const HOSTED_BOT_MAX_TOKEN_ENV_NAMES = 10;
export const HOSTED_BOT_MAX_ARCHIVE_SIZE = 100 * 1024 * 1024;

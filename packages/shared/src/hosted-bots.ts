export enum HostedBotStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  CRASHED = 'crashed'
}

export type THostedBotLogStream = 'stdout' | 'stderr' | 'system';

export type THostedBotLogEntry = {
  botId: number;
  stream: THostedBotLogStream;
  timestamp: number;
  message: string;
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

export const HOSTED_BOT_ENV_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const HOSTED_BOT_MAX_ENV_VARS = 50;
export const HOSTED_BOT_MAX_ENV_VALUE_LENGTH = 4096;
export const HOSTED_BOT_MAX_TOKEN_ENV_NAMES = 10;

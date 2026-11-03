// the parts of discord's gateway protocol, api v10, that sandshark speaks

const GatewayOpcode = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE_UPDATE: 3,
  VOICE_STATE_UPDATE: 4,
  RESUME: 6,
  RECONNECT: 7,
  REQUEST_GUILD_MEMBERS: 8,
  INVALID_SESSION: 9,
  HELLO: 10,
  HEARTBEAT_ACK: 11
} as const;

// the libraries decide from these whether to reconnect, so each failure uses the code
// discord uses for it
const GatewayCloseCode = {
  UNKNOWN_ERROR: 4000,
  UNKNOWN_OPCODE: 4001,
  DECODE_ERROR: 4002,
  NOT_AUTHENTICATED: 4003,
  AUTHENTICATION_FAILED: 4004,
  ALREADY_AUTHENTICATED: 4005,
  RATE_LIMITED: 4008,
  SESSION_TIMED_OUT: 4009,
  INVALID_API_VERSION: 4012,
  INVALID_INTENTS: 4013
} as const;

const GatewayIntent = {
  GUILDS: 1 << 0,
  GUILD_MEMBERS: 1 << 1,
  GUILD_PRESENCES: 1 << 8,
  GUILD_MESSAGES: 1 << 9,
  GUILD_MESSAGE_REACTIONS: 1 << 10,
  GUILD_MESSAGE_TYPING: 1 << 11,
  DIRECT_MESSAGES: 1 << 12,
  DIRECT_MESSAGE_REACTIONS: 1 << 13,
  DIRECT_MESSAGE_TYPING: 1 << 14,
  MESSAGE_CONTENT: 1 << 15
} as const;

// every intent discord defines fits below this, anything above is not an intent at all
const MAX_INTENTS = (1 << 26) - 1;

const HEARTBEAT_INTERVAL_MS = 41_250;

// a heartbeat may arrive up to an interval late, past that the connection is dead
const HEARTBEAT_GRACE_MS = HEARTBEAT_INTERVAL_MS + 15_000;

const IDENTIFY_TIMEOUT_MS = 20_000;

// discord allows a client 120 sends a minute
const CLIENT_SEND_LIMIT = { maxRequests: 120, windowMs: 60_000 };

const BOT_GATEWAY_PATH = '/api/v10/gateway';

type TGatewayPayload = {
  op: number;
  d: unknown;
  s?: number | null;
  t?: string | null;
};

export {
  BOT_GATEWAY_PATH,
  CLIENT_SEND_LIMIT,
  GatewayCloseCode,
  GatewayIntent,
  GatewayOpcode,
  HEARTBEAT_GRACE_MS,
  HEARTBEAT_INTERVAL_MS,
  IDENTIFY_TIMEOUT_MS,
  MAX_INTENTS,
  type TGatewayPayload
};

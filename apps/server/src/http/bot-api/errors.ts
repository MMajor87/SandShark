import type http from 'http';

// the json error codes discord returns, which the libraries switch on
enum DiscordErrorCode {
  GENERAL = 0,
  UNKNOWN_APPLICATION = 10002,
  UNKNOWN_CHANNEL = 10003,
  UNKNOWN_GUILD = 10004,
  UNKNOWN_MEMBER = 10007,
  UNKNOWN_MESSAGE = 10008,
  UNKNOWN_USER = 10013,
  UNKNOWN_EMOJI = 10014,
  UNKNOWN_WEBHOOK = 10015,
  UNKNOWN_INTERACTION = 10062,
  UNKNOWN_APPLICATION_COMMAND = 10063,
  CANNOT_SEND_EMPTY_MESSAGE = 50006,
  MISSING_ACCESS = 50001,
  MISSING_PERMISSIONS = 50013,
  INVALID_FORM_BODY = 50035,
  INTERACTION_ALREADY_ACKNOWLEDGED = 40060
}

class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: DiscordErrorCode,
    message: string
  ) {
    super(message);
  }
}

const notFound = (code: DiscordErrorCode, what: string) =>
  new DiscordApiError(404, code, `Unknown ${what}`);

const alreadyAcknowledged = () =>
  new DiscordApiError(
    400,
    DiscordErrorCode.INTERACTION_ALREADY_ACKNOWLEDGED,
    'Interaction has already been acknowledged.'
  );

const sendDiscordJson = (
  res: http.ServerResponse,
  status: number,
  body: unknown
) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const sendDiscordError = (res: http.ServerResponse, error: DiscordApiError) => {
  sendDiscordJson(res, error.status, {
    message: error.message,
    code: error.code
  });
};

// discord answers 429 with the wait in seconds, as a float, in both the body and headers
const sendDiscordRateLimit = (
  res: http.ServerResponse,
  retryAfterMs: number
) => {
  const retryAfter = Math.max(retryAfterMs, 1) / 1000;

  res.setHeader('Retry-After', Math.ceil(retryAfter).toString());
  res.setHeader('X-RateLimit-Global', 'true');
  res.setHeader('X-RateLimit-Scope', 'global');
  sendDiscordJson(res, 429, {
    message: 'You are being rate limited.',
    retry_after: retryAfter,
    global: true
  });
};

export {
  DiscordApiError,
  DiscordErrorCode,
  alreadyAcknowledged,
  notFound,
  sendDiscordError,
  sendDiscordJson,
  sendDiscordRateLimit
};

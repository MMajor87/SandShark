import { TRPCError } from '@trpc/server';
import { DiscordApiError, DiscordErrorCode } from './errors';

// the rate limited procedures do not say how long is left, so this is a conservative
// wait the libraries honour before retrying
const PROCEDURE_RETRY_AFTER_MS = 1_000;

class DiscordRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('You are being rate limited.');
  }
}

// runs a procedure on behalf of the bot and turns its trpc error into the discord one
// the libraries expect. a not found carries the code of whatever the route was after
const callProcedure = async <T>(
  run: () => Promise<T>,
  notFound: { code: DiscordErrorCode; what: string }
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof TRPCError)) throw error;

    switch (error.code) {
      case 'NOT_FOUND':
        throw new DiscordApiError(
          404,
          notFound.code,
          `Unknown ${notFound.what}`
        );
      case 'FORBIDDEN':
        throw new DiscordApiError(
          403,
          DiscordErrorCode.MISSING_PERMISSIONS,
          'Missing Permissions'
        );
      case 'UNAUTHORIZED':
        throw new DiscordApiError(
          401,
          DiscordErrorCode.GENERAL,
          '401: Unauthorized'
        );
      case 'TOO_MANY_REQUESTS':
        throw new DiscordRateLimitError(PROCEDURE_RETRY_AFTER_MS);
      case 'BAD_REQUEST':
        throw new DiscordApiError(
          400,
          DiscordErrorCode.INVALID_FORM_BODY,
          error.message
        );
      default:
        throw error;
    }
  }
};

export { callProcedure, DiscordRateLimitError };

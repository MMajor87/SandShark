import { getErrorMessage } from '@sandshark/shared';
import type http from 'http';
import { config } from '../../config';
import { getBotUserByAuthorization } from '../../helpers/bot-tokens';
import { logger } from '../../logger';
import type { TConnectionInfo } from '../../types';
import {
  createRateLimiter,
  getClientRateLimitKey
} from '../../utils/rate-limiters/rate-limiter';
import type { TSupportedHttpMethod } from '../helpers';
import {
  DiscordApiError,
  DiscordErrorCode,
  sendDiscordError,
  sendDiscordJson,
  sendDiscordRateLimit
} from './errors';
import { getChannelRoute } from './routes/get-channel';
import { getCurrentUserRoute } from './routes/get-current-user';
import { getGuildRoute } from './routes/get-guild';
import { getGuildChannelsRoute } from './routes/get-guild-channels';
import { getGuildMemberRoute } from './routes/get-guild-member';
import { getGuildMembersRoute } from './routes/get-guild-members';
import { getGuildRolesRoute } from './routes/get-guild-roles';
import { getUserRoute } from './routes/get-user';
import type { TBotRouteHandler } from './types';

const BOT_API_PREFIX = '/api/v10';

type TBotRoute = {
  method: TSupportedHttpMethod;
  segments: string[];
  handler: TBotRouteHandler;
};

const route = (
  method: TSupportedHttpMethod,
  path: string,
  handler: TBotRouteHandler
): TBotRoute => ({ method, segments: path.split('/').slice(1), handler });

// literal segments are listed before parameters at the same depth, so /users/@me wins
// over /users/:userId
const botRoutes: TBotRoute[] = [
  route('GET', '/users/@me', getCurrentUserRoute),
  route('GET', '/users/:userId', getUserRoute),
  route('GET', '/guilds/:guildId', getGuildRoute),
  route('GET', '/guilds/:guildId/channels', getGuildChannelsRoute),
  route('GET', '/guilds/:guildId/roles', getGuildRolesRoute),
  route('GET', '/guilds/:guildId/members', getGuildMembersRoute),
  route('GET', '/guilds/:guildId/members/:userId', getGuildMemberRoute),
  route('GET', '/channels/:channelId', getChannelRoute)
];

const matchSegments = (routeSegments: string[], pathSegments: string[]) => {
  if (routeSegments.length !== pathSegments.length) return undefined;

  const params: Record<string, string> = {};

  for (const [index, segment] of routeSegments.entries()) {
    const value = pathSegments[index]!;

    if (segment.startsWith(':')) {
      params[segment.slice(1)] = value;
    } else if (segment !== value) {
      return undefined;
    }
  }

  return params;
};

const findBotRoute = (method: TSupportedHttpMethod, pathname: string) => {
  const pathSegments = pathname
    .slice(BOT_API_PREFIX.length)
    .split('/')
    .slice(1)
    .filter((segment) => segment.length > 0);
  let methodAllowed = false;

  for (const candidate of botRoutes) {
    const params = matchSegments(candidate.segments, pathSegments);

    if (!params) continue;

    if (candidate.method === method) {
      return { handler: candidate.handler, params, methodAllowed: true };
    }

    methodAllowed = true;
  }

  return { handler: undefined, params: {}, methodAllowed };
};

// one bucket per bot across every route, like discord's global limit
const botLimiter = createRateLimiter(config.rateLimiters.botApi);

// invalid tokens are counted per address, so guessing is cut off well before it could
// matter even though the secret is 256 bits
const authFailureLimiter = createRateLimiter(
  config.rateLimiters.botApiAuthFailure
);

type TBotApiContext = {
  info: TConnectionInfo | undefined;
  pathname: string;
  url: URL;
};

const botApiRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  { info, pathname, url }: TBotApiContext
) => {
  const ipKey = getClientRateLimitKey(info?.ip);
  const bot = await getBotUserByAuthorization(req.headers.authorization);

  if (!bot) {
    const failure = authFailureLimiter.consume(ipKey);

    if (!failure.allowed) {
      sendDiscordRateLimit(res, failure.retryAfterMs);
      return;
    }

    sendDiscordError(
      res,
      new DiscordApiError(401, DiscordErrorCode.GENERAL, '401: Unauthorized')
    );
    return;
  }

  const rateLimit = botLimiter.consume(`bot:${bot.id}`);

  res.setHeader('X-RateLimit-Limit', config.rateLimiters.botApi.maxRequests);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    sendDiscordRateLimit(res, rateLimit.retryAfterMs);
    return;
  }

  const method = req.method as TSupportedHttpMethod;
  const { handler, params, methodAllowed } = findBotRoute(method, pathname);

  if (!handler) {
    sendDiscordError(
      res,
      methodAllowed
        ? new DiscordApiError(
            405,
            DiscordErrorCode.GENERAL,
            '405: Method Not Allowed'
          )
        : new DiscordApiError(404, DiscordErrorCode.GENERAL, '404: Not Found')
    );
    return;
  }

  try {
    const body = await handler({ bot, params, url, info });

    sendDiscordJson(res, 200, body);
  } catch (error) {
    if (error instanceof DiscordApiError) {
      sendDiscordError(res, error);
      return;
    }

    logger.error(
      'Bot API %s %s failed: %s',
      method,
      pathname,
      getErrorMessage(error)
    );
    sendDiscordError(
      res,
      new DiscordApiError(
        500,
        DiscordErrorCode.GENERAL,
        '500: Internal Server Error'
      )
    );
  }
};

export { BOT_API_PREFIX, botApiRouteHandler };

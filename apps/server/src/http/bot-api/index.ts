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
import { getPublicOrigin } from '../helpers';
import { DiscordRateLimitError } from './call-procedure';
import {
  DiscordApiError,
  DiscordErrorCode,
  sendDiscordError,
  sendDiscordJson,
  sendDiscordRateLimit
} from './errors';
import { addOwnReactionRoute } from './routes/add-own-reaction';
import { createDmRoute } from './routes/create-dm';
import { createMessageRoute } from './routes/create-message';
import { deleteMessageRoute } from './routes/delete-message';
import { editMessageRoute } from './routes/edit-message';
import { getChannelRoute } from './routes/get-channel';
import { getChannelMessageRoute } from './routes/get-channel-message';
import { getChannelMessagesRoute } from './routes/get-channel-messages';
import { getCurrentUserRoute } from './routes/get-current-user';
import { getGatewayBotRoute } from './routes/get-gateway-bot';
import { getGuildRoute } from './routes/get-guild';
import { getGuildChannelsRoute } from './routes/get-guild-channels';
import { getGuildMemberRoute } from './routes/get-guild-member';
import { getGuildMembersRoute } from './routes/get-guild-members';
import { getGuildRolesRoute } from './routes/get-guild-roles';
import { getUserRoute } from './routes/get-user';
import { removeOwnReactionRoute } from './routes/remove-own-reaction';
import { triggerTypingRoute } from './routes/trigger-typing';
import { NO_CONTENT, type TBotRouteHandler } from './types';

const BOT_API_PREFIX = '/api/v10';

type TBotApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type TBotRoute = {
  method: TBotApiMethod;
  segments: string[];
  handler: TBotRouteHandler;
};

const route = (
  method: TBotApiMethod,
  path: string,
  handler: TBotRouteHandler
): TBotRoute => ({ method, segments: path.split('/').slice(1), handler });

// literal segments are listed before parameters at the same depth, so /users/@me wins
// over /users/:userId
const botRoutes: TBotRoute[] = [
  route('GET', '/gateway/bot', getGatewayBotRoute),
  route('GET', '/users/@me', getCurrentUserRoute),
  route('GET', '/users/:userId', getUserRoute),
  route('GET', '/guilds/:guildId', getGuildRoute),
  route('GET', '/guilds/:guildId/channels', getGuildChannelsRoute),
  route('GET', '/guilds/:guildId/roles', getGuildRolesRoute),
  route('GET', '/guilds/:guildId/members', getGuildMembersRoute),
  route('GET', '/guilds/:guildId/members/:userId', getGuildMemberRoute),
  route('POST', '/users/@me/channels', createDmRoute),
  route('GET', '/channels/:channelId', getChannelRoute),
  route('GET', '/channels/:channelId/messages', getChannelMessagesRoute),
  route('POST', '/channels/:channelId/messages', createMessageRoute),
  route(
    'GET',
    '/channels/:channelId/messages/:messageId',
    getChannelMessageRoute
  ),
  route('PATCH', '/channels/:channelId/messages/:messageId', editMessageRoute),
  route(
    'DELETE',
    '/channels/:channelId/messages/:messageId',
    deleteMessageRoute
  ),
  route(
    'PUT',
    '/channels/:channelId/messages/:messageId/reactions/:emoji/@me',
    addOwnReactionRoute
  ),
  route(
    'DELETE',
    '/channels/:channelId/messages/:messageId/reactions/:emoji/@me',
    removeOwnReactionRoute
  ),
  route('POST', '/channels/:channelId/typing', triggerTypingRoute)
];

const matchSegments = (routeSegments: string[], pathSegments: string[]) => {
  if (routeSegments.length !== pathSegments.length) return undefined;

  const params: Record<string, string> = {};

  for (const [index, segment] of routeSegments.entries()) {
    const value = pathSegments[index]!;

    if (segment.startsWith(':')) {
      // a reaction names its emoji in the path, url encoded
      try {
        params[segment.slice(1)] = decodeURIComponent(value);
      } catch {
        return undefined;
      }
    } else if (segment !== value) {
      return undefined;
    }
  }

  return params;
};

const findBotRoute = (method: TBotApiMethod, pathname: string) => {
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

  const method = req.method as TBotApiMethod;
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
    const body = await handler({
      req,
      bot,
      params,
      url,
      info,
      origin: getPublicOrigin(req)
    });

    if (body === NO_CONTENT) {
      res.writeHead(204);
      res.end();
      return;
    }

    sendDiscordJson(res, 200, body);
  } catch (error) {
    if (error instanceof DiscordApiError) {
      sendDiscordError(res, error);
      return;
    }

    if (error instanceof DiscordRateLimitError) {
      sendDiscordRateLimit(res, error.retryAfterMs);
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

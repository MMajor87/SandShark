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
import { authenticateInteraction } from './interaction-auth';
import { addOwnReactionRoute } from './routes/add-own-reaction';
import { bulkOverwriteApplicationCommandsRoute } from './routes/bulk-overwrite-application-commands';
import { createApplicationCommandRoute } from './routes/create-application-command';
import { createDmRoute } from './routes/create-dm';
import { createFollowupMessageRoute } from './routes/create-followup-message';
import { createInteractionResponseRoute } from './routes/create-interaction-response';
import { createMessageRoute } from './routes/create-message';
import { deleteApplicationCommandRoute } from './routes/delete-application-command';
import { deleteInteractionMessageRoute } from './routes/delete-interaction-message';
import { deleteMessageRoute } from './routes/delete-message';
import { editApplicationCommandRoute } from './routes/edit-application-command';
import { editInteractionMessageRoute } from './routes/edit-interaction-message';
import { editMessageRoute } from './routes/edit-message';
import { getApplicationCommandRoute } from './routes/get-application-command';
import { getApplicationCommandsRoute } from './routes/get-application-commands';
import { getChannelRoute } from './routes/get-channel';
import { getChannelMessageRoute } from './routes/get-channel-message';
import { getChannelMessagesRoute } from './routes/get-channel-messages';
import { getCurrentApplicationRoute } from './routes/get-current-application';
import { getCurrentUserRoute } from './routes/get-current-user';
import { getGatewayBotRoute } from './routes/get-gateway-bot';
import { getGuildRoute } from './routes/get-guild';
import { getGuildChannelsRoute } from './routes/get-guild-channels';
import { getGuildMemberRoute } from './routes/get-guild-member';
import { getGuildMembersRoute } from './routes/get-guild-members';
import { getGuildRolesRoute } from './routes/get-guild-roles';
import { getInteractionMessageRoute } from './routes/get-interaction-message';
import { getUserRoute } from './routes/get-user';
import { removeOwnReactionRoute } from './routes/remove-own-reaction';
import { triggerTypingRoute } from './routes/trigger-typing';
import {
  NO_CONTENT,
  type TBotRouteHandler,
  type TInteractionRouteHandler
} from './types';

const BOT_API_PREFIX = '/api/v10';

type TBotApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type TRoute<THandler> = {
  method: TBotApiMethod;
  segments: string[];
  handler: THandler;
};

const route = <THandler = TBotRouteHandler>(
  method: TBotApiMethod,
  path: string,
  handler: THandler
): TRoute<THandler> => ({
  method,
  segments: path.split('/').slice(1),
  handler
});

// literal segments are listed before parameters at the same depth, so /users/@me wins
// over /users/:userId
const botRoutes: TRoute<TBotRouteHandler>[] = [
  route('GET', '/gateway/bot', getGatewayBotRoute),
  route('GET', '/applications/@me', getCurrentApplicationRoute),
  route('GET', '/oauth2/applications/@me', getCurrentApplicationRoute),
  // the global commands and the guild's commands are two lists served by the same handlers
  ...[
    '/applications/:applicationId',
    '/applications/:applicationId/guilds/:guildId'
  ]
    .map((base) => `${base}/commands`)
    .flatMap((commands) => [
      route('GET', commands, getApplicationCommandsRoute),
      route('POST', commands, createApplicationCommandRoute),
      route('PUT', commands, bulkOverwriteApplicationCommandsRoute),
      route('GET', `${commands}/:commandId`, getApplicationCommandRoute),
      route('PATCH', `${commands}/:commandId`, editApplicationCommandRoute),
      route('DELETE', `${commands}/:commandId`, deleteApplicationCommandRoute)
    ]),
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

// answered with an interaction's token instead of the bot's, see interaction-auth
const interactionRoutes: TRoute<TInteractionRouteHandler>[] = [
  route(
    'POST',
    '/interactions/:interactionId/:token/callback',
    createInteractionResponseRoute
  ),
  route('POST', '/webhooks/:applicationId/:token', createFollowupMessageRoute),
  route(
    'GET',
    '/webhooks/:applicationId/:token/messages/:messageId',
    getInteractionMessageRoute
  ),
  route(
    'PATCH',
    '/webhooks/:applicationId/:token/messages/:messageId',
    editInteractionMessageRoute
  ),
  route(
    'DELETE',
    '/webhooks/:applicationId/:token/messages/:messageId',
    deleteInteractionMessageRoute
  )
];

const findRoute = <THandler>(
  routes: TRoute<THandler>[],
  method: TBotApiMethod,
  pathname: string
) => {
  const pathSegments = pathname
    .slice(BOT_API_PREFIX.length)
    .split('/')
    .slice(1)
    .filter((segment) => segment.length > 0);
  let methodAllowed = false;

  for (const candidate of routes) {
    const params = matchSegments(candidate.segments, pathSegments);

    if (!params) continue;

    if (candidate.method === method) {
      return { handler: candidate.handler, params, methodAllowed: true };
    }

    methodAllowed = true;
  }

  return { handler: undefined, params: {}, methodAllowed };
};

// discord.py reads every one of these as soon as it sees the limit, so the whole set is sent
const setRateLimitHeaders = (
  res: http.ServerResponse,
  rateLimit: { remaining: number; resetAfterMs: number }
) => {
  const resetAfter = rateLimit.resetAfterMs / 1000;

  res.setHeader('X-RateLimit-Limit', config.rateLimiters.botApi.maxRequests);
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  res.setHeader(
    'X-RateLimit-Reset',
    ((Date.now() + rateLimit.resetAfterMs) / 1000).toFixed(3)
  );
  res.setHeader('X-RateLimit-Reset-After', resetAfter.toFixed(3));
  res.setHeader('X-RateLimit-Bucket', 'global');
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

const routeNotFound = (methodAllowed: boolean) =>
  methodAllowed
    ? new DiscordApiError(
        405,
        DiscordErrorCode.GENERAL,
        '405: Method Not Allowed'
      )
    : new DiscordApiError(404, DiscordErrorCode.GENERAL, '404: Not Found');

// runs a handler and writes its answer the way discord would, whichever credential the
// route takes
const respond = async (
  res: http.ServerResponse,
  label: string,
  run: () => Promise<unknown>
) => {
  try {
    const body = await run();

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

    logger.error('Bot API %s failed: %s', label, getErrorMessage(error));
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

// the bot's one limit across every route, its interaction routes included
const consumeBotLimit = (res: http.ServerResponse, botId: number) => {
  const rateLimit = botLimiter.consume(`bot:${botId}`);

  setRateLimitHeaders(res, rateLimit);

  if (!rateLimit.allowed) {
    throw new DiscordRateLimitError(rateLimit.retryAfterMs);
  }
};

// an unknown interaction token counts against the address like an invalid bot token
const authenticateInteractionRequest = async (
  params: Record<string, string>,
  ipKey: string
) => {
  try {
    return await authenticateInteraction(params);
  } catch (error) {
    const failure = authFailureLimiter.consume(ipKey);

    if (!failure.allowed) {
      throw new DiscordRateLimitError(failure.retryAfterMs);
    }

    throw error;
  }
};

const botApiRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  { info, pathname, url }: TBotApiContext
) => {
  const ipKey = getClientRateLimitKey(info?.ip);
  const method = req.method as TBotApiMethod;
  const label = `${method} ${pathname}`;
  const interactionRoute = findRoute(interactionRoutes, method, pathname);

  if (interactionRoute.handler || interactionRoute.methodAllowed) {
    const { handler, params } = interactionRoute;

    await respond(res, label, async () => {
      if (!handler) throw routeNotFound(true);

      const authenticated = await authenticateInteractionRequest(params, ipKey);

      consumeBotLimit(res, authenticated.bot.id);

      return handler({
        req,
        params,
        url,
        info,
        origin: getPublicOrigin(req),
        ...authenticated
      });
    });
    return;
  }

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

  const { handler, params, methodAllowed } = findRoute(
    botRoutes,
    method,
    pathname
  );

  await respond(res, label, async () => {
    consumeBotLimit(res, bot.id);

    if (!handler) throw routeNotFound(methodAllowed);

    return handler({
      req,
      bot,
      params,
      url,
      info,
      origin: getPublicOrigin(req)
    });
  });
};

export { BOT_API_PREFIX, botApiRouteHandler };

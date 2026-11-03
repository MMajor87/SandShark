import { DEFAULT_MESSAGES_LIMIT } from '@sandshark/shared';
import { z } from 'zod';
import { getGuildContext } from '../../../helpers/discord/guild';
import { decodeSnowflake } from '../../../helpers/discord/snowflake';
import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode } from '../errors';
import {
  invalidFormBody,
  loadMessageId,
  loadVisibleChannel,
  serializeForBot
} from '../helpers';
import type { TBotRouteHandler } from '../types';

const zSnowflakeParam = z
  .string()
  .regex(/^\d{1,20}$/)
  .optional();

const zMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(DEFAULT_MESSAGES_LIMIT).default(50),
  before: zSnowflakeParam,
  after: zSnowflakeParam,
  around: zSnowflakeParam
});

// before and after are positions, not necessarily messages, exactly as on discord, so they
// become a cursor straight from the snowflake's time and id bits
const toCursor = (snowflake: string) => {
  const decoded = decodeSnowflake(snowflake);

  if (!decoded) throw invalidFormBody();

  return { createdAt: decoded.timestamp, id: decoded.idBits };
};

const getChannelMessagesRoute: TBotRouteHandler = async (request) => {
  const { bot, info, params, url } = request;
  const parsed = zMessagesQuery.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );

  if (!parsed.success) throw invalidFormBody();

  const { limit, before, after, around } = parsed.data;

  if ([before, after, around].filter(Boolean).length > 1) {
    throw invalidFormBody('Use only one of before, after and around.');
  }

  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const caller = createBotCaller(bot, info);
  const notFound = { code: DiscordErrorCode.UNKNOWN_CHANNEL, what: 'Channel' };

  let page;

  if (around) {
    const targetMessageId = await loadMessageId(channel.id, around);
    const window = await callProcedure(
      () =>
        caller.messages.get({ channelId: channel.id, targetMessageId, limit }),
      notFound
    );
    const targetIndex = window.messages.findIndex(
      ({ id }) => id === targetMessageId
    );
    const start = Math.max(0, targetIndex - Math.floor(limit / 2));

    page = window.messages.slice(start, start + limit);
  } else {
    const result = await callProcedure(
      () =>
        caller.messages.get({
          channelId: channel.id,
          limit,
          cursor: before ? toCursor(before) : null,
          after: after ? toCursor(after) : null
        }),
      notFound
    );

    page = result.messages;
  }

  return serializeForBot(request, await getGuildContext(), page);
};

export { getChannelMessagesRoute };

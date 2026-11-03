import { z } from 'zod';
import { toStoredHtml } from '../../../helpers/discord/content';
import { getGuildContext } from '../../../helpers/discord/guild';
import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordApiError, DiscordErrorCode } from '../errors';
import {
  invalidFormBody,
  loadMessageId,
  loadVisibleChannel,
  readJsonBody,
  serializeForBot
} from '../helpers';
import { NO_CONTENT, type TBotRouteHandler } from '../types';

// discord caps message content at 2000 characters. embeds, stickers and components have
// no sandshark counterpart, so a message carrying only those is empty here
const zCreateMessage = z.object({
  content: z.string().max(2_000).optional(),
  message_reference: z
    .object({ message_id: z.string().regex(/^\d{1,20}$/) })
    .optional()
});

const createMessageRoute: TBotRouteHandler = async (request) => {
  const { bot, info, params, req } = request;
  const parsed = zCreateMessage.safeParse(await readJsonBody(req));

  if (!parsed.success) throw invalidFormBody();

  const { content, message_reference: reference } = parsed.data;

  if (!content || !content.trim()) {
    throw new DiscordApiError(
      400,
      DiscordErrorCode.CANNOT_SEND_EMPTY_MESSAGE,
      'Cannot send an empty message'
    );
  }

  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const replyToMessageId = reference
    ? await loadMessageId(channel.id, reference.message_id)
    : undefined;
  const guild = await getGuildContext();
  const caller = createBotCaller(bot, info);
  const messageId = await callProcedure(
    async () =>
      caller.messages.send({
        channelId: channel.id,
        content: await toStoredHtml(content, guild),
        replyToMessageId
      }),
    { code: DiscordErrorCode.UNKNOWN_CHANNEL, what: 'Channel' }
  );

  // an ephemeral plugin command answers the sender privately and stores nothing
  if (messageId === null) return NO_CONTENT;

  const message = await callProcedure(
    () => caller.messages.getOne({ messageId }),
    { code: DiscordErrorCode.UNKNOWN_MESSAGE, what: 'Message' }
  );
  const [serialized] = await serializeForBot(request, guild, [message]);

  return serialized;
};

export { createMessageRoute };

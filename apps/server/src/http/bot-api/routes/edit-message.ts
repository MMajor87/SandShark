import { z } from 'zod';
import { toStoredHtml } from '../../../helpers/discord/content';
import { getGuildContext } from '../../../helpers/discord/guild';
import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode } from '../errors';
import {
  invalidFormBody,
  loadMessageId,
  loadVisibleChannel,
  readJsonBody,
  serializeForBot
} from '../helpers';
import type { TBotRouteHandler } from '../types';

const zEditMessage = z.object({
  content: z.string().min(1).max(2_000)
});

const editMessageRoute: TBotRouteHandler = async (request) => {
  const { bot, info, params, req } = request;
  const parsed = zEditMessage.safeParse(await readJsonBody(req));

  if (!parsed.success) throw invalidFormBody();

  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const messageId = await loadMessageId(channel.id, params.messageId!);
  const guild = await getGuildContext();
  const caller = createBotCaller(bot, info);
  const unknownMessage = {
    code: DiscordErrorCode.UNKNOWN_MESSAGE,
    what: 'Message'
  };

  await callProcedure(
    async () =>
      caller.messages.edit({
        messageId,
        content: await toStoredHtml(parsed.data.content, guild)
      }),
    unknownMessage
  );

  const message = await callProcedure(
    () => caller.messages.getOne({ messageId }),
    unknownMessage
  );
  const [serialized] = await serializeForBot(request, guild, [message]);

  return serialized;
};

export { editMessageRoute };

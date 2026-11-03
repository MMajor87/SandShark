import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode } from '../errors';
import { loadMessageId, loadVisibleChannel } from '../helpers';
import { NO_CONTENT, type TBotRouteHandler } from '../types';

const deleteMessageRoute: TBotRouteHandler = async ({ bot, info, params }) => {
  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const messageId = await loadMessageId(channel.id, params.messageId!);
  const caller = createBotCaller(bot, info);

  await callProcedure(() => caller.messages.delete({ messageId }), {
    code: DiscordErrorCode.UNKNOWN_MESSAGE,
    what: 'Message'
  });

  return NO_CONTENT;
};

export { deleteMessageRoute };

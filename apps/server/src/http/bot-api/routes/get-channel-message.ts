import { getGuildContext } from '../../../helpers/discord/guild';
import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode } from '../errors';
import { loadMessageId, loadVisibleChannel, serializeForBot } from '../helpers';
import type { TBotRouteHandler } from '../types';

const getChannelMessageRoute: TBotRouteHandler = async (request) => {
  const { bot, info, params } = request;
  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const messageId = await loadMessageId(channel.id, params.messageId!);
  const caller = createBotCaller(bot, info);
  const message = await callProcedure(
    () => caller.messages.getOne({ messageId }),
    { code: DiscordErrorCode.UNKNOWN_MESSAGE, what: 'Message' }
  );
  const [serialized] = await serializeForBot(request, await getGuildContext(), [
    message
  ]);

  return serialized;
};

export { getChannelMessageRoute };

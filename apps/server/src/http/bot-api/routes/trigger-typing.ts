import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode } from '../errors';
import { loadVisibleChannel } from '../helpers';
import { NO_CONTENT, type TBotRouteHandler } from '../types';

const triggerTypingRoute: TBotRouteHandler = async ({ bot, info, params }) => {
  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const caller = createBotCaller(bot, info);

  await callProcedure(
    () => caller.messages.signalTyping({ channelId: channel.id }),
    { code: DiscordErrorCode.UNKNOWN_CHANNEL, what: 'Channel' }
  );

  return NO_CONTENT;
};

export { triggerTypingRoute };

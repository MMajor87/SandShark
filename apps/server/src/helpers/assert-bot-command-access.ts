import { ChannelPermission, Permission } from '@sandshark/shared';
import { getSlashCommandById } from '../db/queries/bot-commands';
import { getChannelsForUser } from '../db/queries/channels';
import { getPublicUserById } from '../db/queries/users';
import { isBotConnected } from '../http/bot-api/gateway';
import { invariant } from '../utils/invariant';
import type { Context } from '../utils/trpc';
import { assertChannelAccess } from './assert-channel-access';
import { canUseBotCommand } from './bot-command-access';
import { getGuildContext } from './discord/guild';
import { memberPermissionBits } from './discord/member';

// everything that has to hold before a member's use of a bot's slash command reaches the
// bot, whether running it or asking for suggestions: the command, the channel for the member
// and for the bot, the command's own permissions, and the bot being online
const assertBotCommandAccess = async (
  ctx: Context,
  commandId: number,
  channelId: number
) => {
  await ctx.needsPermission(Permission.SEND_MESSAGES);

  const command = await getSlashCommandById(commandId);

  invariant(command, { code: 'NOT_FOUND', message: 'Command not found.' });

  await assertChannelAccess(ctx, channelId);
  await ctx.needsChannelPermission(channelId, ChannelPermission.SEND_MESSAGES);

  const [botChannels, member, guild] = await Promise.all([
    getChannelsForUser(command.botId),
    getPublicUserById(ctx.userId),
    getGuildContext()
  ]);

  // the answer is posted in the channel by the bot, so the bot has to be able to see it
  invariant(
    botChannels.some((channel) => channel.id === channelId),
    { code: 'FORBIDDEN', message: "This bot can't see this channel." }
  );

  invariant(
    member && canUseBotCommand(command, memberPermissionBits(member, guild)),
    {
      code: 'FORBIDDEN',
      message: "You don't have permission to use this command."
    }
  );

  invariant(isBotConnected(command.botId), {
    code: 'PRECONDITION_FAILED',
    message: 'This bot is offline right now.'
  });

  return command;
};

export { assertBotCommandAccess };

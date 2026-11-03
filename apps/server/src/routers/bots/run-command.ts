import { ChannelPermission, Permission, ServerEvents } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { getSlashCommandById } from '../../db/queries/bot-commands';
import { getChannelsForUser } from '../../db/queries/channels';
import { getPublicUserById } from '../../db/queries/users';
import { assertChannelAccess } from '../../helpers/assert-channel-access';
import { canUseBotCommand } from '../../helpers/bot-command-access';
import { resolveInvocation } from '../../helpers/bot-command-invocation';
import {
  createBotInteraction,
  watchBotInteractionResponse
} from '../../helpers/bot-interactions';
import { getGuildContext } from '../../helpers/discord/guild';
import { memberPermissionBits } from '../../helpers/discord/member';
import { isBotConnected } from '../../http/bot-api/gateway';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// runs a bot's slash command: the bot is sent INTERACTION_CREATE and answers through the
// interaction endpoints. running one is as easy to spam as sending a message
const runCommandRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.sendAndEditMessage.maxRequests,
  windowMs: config.rateLimiters.sendAndEditMessage.windowMs,
  logLabel: 'runBotCommand'
})
  .input(
    z.object({
      commandId: z.number().int().positive(),
      channelId: z.number().int().positive(),
      subcommand: z.array(z.string().min(1).max(32)).max(2).default([]),
      values: z
        .record(
          z.string().min(1).max(32),
          z.union([z.string().max(6_000), z.number(), z.boolean()])
        )
        .default({})
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.SEND_MESSAGES);

    const command = await getSlashCommandById(input.commandId);

    invariant(command, { code: 'NOT_FOUND', message: 'Command not found.' });

    await assertChannelAccess(ctx, input.channelId);
    await ctx.needsChannelPermission(
      input.channelId,
      ChannelPermission.SEND_MESSAGES
    );

    // the answer is posted in the channel by the bot, so the bot has to be able to see it
    const botChannels = await getChannelsForUser(command.botId);

    invariant(
      botChannels.some((channel) => channel.id === input.channelId),
      {
        code: 'FORBIDDEN',
        message: "This bot can't see this channel."
      }
    );

    const [member, guild] = await Promise.all([
      getPublicUserById(ctx.userId),
      getGuildContext()
    ]);

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

    const { options, commandName } = await resolveInvocation(
      command,
      { subcommand: input.subcommand, values: input.values },
      ctx.userId
    );

    const { interaction, token } = await createBotInteraction({
      botId: command.botId,
      userId: ctx.userId,
      channelId: input.channelId,
      commandName
    });

    ctx.pubsub.publishFor(command.botId, ServerEvents.BOT_INTERACTION_CREATE, {
      interactionId: interaction.id,
      token,
      createdAt: interaction.createdAt,
      userId: ctx.userId,
      channelId: input.channelId,
      command: {
        id: command.id,
        createdAt: command.createdAt,
        name: command.name,
        type: command.type,
        guildScoped: command.guildScoped
      },
      options
    });

    watchBotInteractionResponse(interaction);

    return { interactionId: interaction.id };
  });

export { runCommandRoute };

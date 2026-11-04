import { ServerEvents } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertBotCommandAccess } from '../../helpers/assert-bot-command-access';
import { resolveInvocation } from '../../helpers/bot-command-invocation';
import {
  createBotInteraction,
  watchBotInteractionResponse
} from '../../helpers/bot-interactions';
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
    const command = await assertBotCommandAccess(
      ctx,
      input.commandId,
      input.channelId
    );

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
      kind: 'command',
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

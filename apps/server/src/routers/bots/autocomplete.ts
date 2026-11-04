import { ServerEvents } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertBotCommandAccess } from '../../helpers/assert-bot-command-access';
import { waitForAutocomplete } from '../../helpers/bot-autocomplete';
import { buildAutocompleteOptions } from '../../helpers/bot-command-invocation';
import {
  createBotInteraction,
  RESPONSE_WINDOW_MS
} from '../../helpers/bot-interactions';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const AUTOCOMPLETE = 4;

// suggestions for an option a member is typing into, asked of the bot and handed back when
// it answers. a bot that does not answer in time simply offers none
const autocompleteRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.botAutocomplete.maxRequests,
  windowMs: config.rateLimiters.botAutocomplete.windowMs,
  logLabel: 'botAutocomplete'
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
        .default({}),
      focused: z.string().min(1).max(32)
    })
  )
  .mutation(async ({ ctx, input }) => {
    const command = await assertBotCommandAccess(
      ctx,
      input.commandId,
      input.channelId
    );

    const options = buildAutocompleteOptions(
      command,
      { subcommand: input.subcommand, values: input.values },
      input.focused
    );
    const { interaction, token } = await createBotInteraction({
      botId: command.botId,
      userId: ctx.userId,
      channelId: input.channelId,
      type: AUTOCOMPLETE,
      commandName: command.name
    });
    const answer = waitForAutocomplete(interaction.id, RESPONSE_WINDOW_MS);

    ctx.pubsub.publishFor(command.botId, ServerEvents.BOT_INTERACTION_CREATE, {
      kind: 'autocomplete',
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

    return { choices: await answer };
  });

export { autocompleteRoute };

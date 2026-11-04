import { ServerEvents } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import {
  closeBotModal,
  createBotInteraction,
  getBotInteractionById,
  isTokenAlive,
  watchBotInteractionResponse
} from '../../helpers/bot-interactions';
import { MAX_INPUT_LENGTH } from '../../helpers/discord/modal';
import { isBotConnected } from '../../http/bot-api/gateway';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const MODAL_SUBMIT = 5;

// a member submitting the form a bot answered with. the bot is sent a modal submit
// interaction, which it answers like any other
const submitModalRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.sendAndEditMessage.maxRequests,
  windowMs: config.rateLimiters.sendAndEditMessage.windowMs,
  logLabel: 'submitBotModal'
})
  .input(
    z.object({
      interactionId: z.number().int().positive(),
      values: z.record(
        z.string().min(1).max(100),
        z.string().max(MAX_INPUT_LENGTH)
      )
    })
  )
  .mutation(async ({ ctx, input }) => {
    const source = getBotInteractionById(input.interactionId);

    // a form opened for someone else, or one already submitted, reads as gone
    invariant(
      source &&
        source.userId === ctx.userId &&
        source.modal &&
        isTokenAlive(source),
      { code: 'NOT_FOUND', message: 'This form is no longer open.' }
    );

    const { modal } = source;
    const known = new Set(modal.inputs.map(({ customId }) => customId));

    for (const customId of Object.keys(input.values)) {
      invariant(known.has(customId), {
        code: 'BAD_REQUEST',
        message: 'This form has no such field.'
      });
    }

    const values = modal.inputs.map((field) => {
      const value = input.values[field.customId] ?? '';

      invariant(!field.required || value.trim() !== '', {
        code: 'BAD_REQUEST',
        message: `Fill in "${field.label}".`
      });

      invariant(
        value === '' ||
          (value.length >= (field.minLength ?? 0) &&
            value.length <= (field.maxLength ?? MAX_INPUT_LENGTH)),
        {
          code: 'BAD_REQUEST',
          message: `"${field.label}" is too short or too long.`
        }
      );

      return { customId: field.customId, value };
    });

    invariant(isBotConnected(source.botId), {
      code: 'PRECONDITION_FAILED',
      message: 'This bot is offline right now.'
    });

    invariant(closeBotModal(source.id), {
      code: 'NOT_FOUND',
      message: 'This form is no longer open.'
    });

    const { interaction, token } = await createBotInteraction({
      botId: source.botId,
      userId: ctx.userId,
      channelId: source.channelId,
      type: MODAL_SUBMIT,
      commandName: source.commandName,
      messageId: source.messageId,
      ephemeralMessageId: source.ephemeralMessageId
    });

    ctx.pubsub.publishFor(source.botId, ServerEvents.BOT_INTERACTION_CREATE, {
      kind: 'modal',
      interactionId: interaction.id,
      token,
      createdAt: interaction.createdAt,
      userId: ctx.userId,
      channelId: source.channelId,
      customId: modal.customId,
      labelled: modal.labelled,
      values,
      messageId: source.messageId,
      ephemeralMessageId: source.ephemeralMessageId
    });

    watchBotInteractionResponse(interaction);

    return { interactionId: interaction.id };
  });

export { submitModalRoute };

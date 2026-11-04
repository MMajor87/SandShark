import {
  BotButtonStyle,
  BotComponentType,
  ServerEvents,
  type TBotActionRow
} from '@sandshark/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../../config';
import { db } from '../../db';
import { getBotById } from '../../db/queries/bots';
import { botEphemeralMessages, messages } from '../../db/schema';
import { assertChannelAccess } from '../../helpers/assert-channel-access';
import {
  createBotInteraction,
  getBotInteractionById,
  watchBotInteractionResponse
} from '../../helpers/bot-interactions';
import { findComponent } from '../../helpers/discord/component';
import { isBotConnected } from '../../http/bot-api/gateway';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

type TComponentSource = {
  botId: number;
  channelId: number;
  components: TBotActionRow[] | null;
};

const NOT_FOUND = { code: 'NOT_FOUND', message: 'Message not found.' } as const;

// a bot's message in a channel the member can see
const loadMessageSource = async (
  messageId: number
): Promise<TComponentSource> => {
  const message = db
    .select({
      channelId: messages.channelId,
      userId: messages.userId,
      components: messages.components
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1)
    .get();

  invariant(message && message.userId !== null, NOT_FOUND);

  const bot = await getBotById(message.userId);

  invariant(bot, NOT_FOUND);

  return {
    botId: bot.id,
    channelId: message.channelId,
    components: message.components
  };
};

// an ephemeral answer only the member it was sent to can use, anyone else is told it
// does not exist
const loadEphemeralSource = (
  ephemeralMessageId: number,
  userId: number
): TComponentSource => {
  const row = db
    .select({
      interactionId: botEphemeralMessages.interactionId,
      components: botEphemeralMessages.components
    })
    .from(botEphemeralMessages)
    .where(eq(botEphemeralMessages.id, ephemeralMessageId))
    .limit(1)
    .get();
  const owner = row ? getBotInteractionById(row.interactionId) : undefined;

  invariant(row && owner && owner.userId === userId, NOT_FOUND);

  return {
    botId: owner.botId,
    channelId: owner.channelId,
    components: row.components
  };
};

// a select menu's choice has to be among its options, as many as it allows
const assertSelectValues = (
  component: Extract<
    TBotActionRow['components'][number],
    { type: BotComponentType.STRING_SELECT }
  >,
  values: string[]
) => {
  const allowed = new Set(component.options.map(({ value }) => value));

  invariant(
    new Set(values).size === values.length &&
      values.every((value) => allowed.has(value)) &&
      values.length >= component.minValues &&
      values.length <= component.maxValues,
    { code: 'BAD_REQUEST', message: 'That choice is not one of the options.' }
  );
};

// a member pressing a bot's button or choosing from its select menu. the bot is sent a
// component interaction and answers it through the interaction endpoints
const pressComponentRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.sendAndEditMessage.maxRequests,
  windowMs: config.rateLimiters.sendAndEditMessage.windowMs,
  logLabel: 'pressBotComponent'
})
  .input(
    z
      .object({
        messageId: z.number().int().positive().optional(),
        ephemeralMessageId: z.number().int().positive().optional(),
        customId: z.string().min(1).max(100),
        values: z.array(z.string().min(1).max(100)).max(25).default([])
      })
      .refine(
        ({ messageId, ephemeralMessageId }) =>
          (messageId === undefined) !== (ephemeralMessageId === undefined),
        { message: 'Name either a message or an ephemeral message.' }
      )
  )
  .mutation(async ({ ctx, input }) => {
    const source =
      input.messageId !== undefined
        ? await loadMessageSource(input.messageId)
        : loadEphemeralSource(input.ephemeralMessageId!, ctx.userId);

    await assertChannelAccess(ctx, source.channelId);

    const component = findComponent(source.components, input.customId);
    const isPressable =
      !!component &&
      !(
        component.type === BotComponentType.BUTTON &&
        component.style === BotButtonStyle.LINK
      );

    invariant(component && isPressable, {
      code: 'NOT_FOUND',
      message: 'That button is no longer there.'
    });

    invariant(!component.disabled, {
      code: 'BAD_REQUEST',
      message: 'That button is disabled.'
    });

    if (component.type === BotComponentType.STRING_SELECT) {
      assertSelectValues(component, input.values);
    } else {
      invariant(input.values.length === 0, {
        code: 'BAD_REQUEST',
        message: 'A button takes no choice.'
      });
    }

    invariant(isBotConnected(source.botId), {
      code: 'PRECONDITION_FAILED',
      message: 'This bot is offline right now.'
    });

    const { interaction, token } = await createBotInteraction({
      botId: source.botId,
      userId: ctx.userId,
      channelId: source.channelId,
      commandName: '',
      messageId: input.messageId ?? null,
      ephemeralMessageId: input.ephemeralMessageId ?? null
    });

    ctx.pubsub.publishFor(source.botId, ServerEvents.BOT_INTERACTION_CREATE, {
      kind: 'component',
      interactionId: interaction.id,
      token,
      createdAt: interaction.createdAt,
      userId: ctx.userId,
      channelId: source.channelId,
      customId: input.customId,
      componentType: component.type,
      values: input.values,
      messageId: input.messageId ?? null,
      ephemeralMessageId: input.ephemeralMessageId ?? null
    });

    watchBotInteractionResponse(interaction);

    return { interactionId: interaction.id };
  });

export { pressComponentRoute };

import {
  ServerEvents,
  sha256,
  type TBotEphemeralMessage
} from '@sandshark/shared';
import { randomBytes } from 'crypto';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db';
import { botEphemeralMessages, botInteractions } from '../db/schema';
import { pubsub } from '../utils/pubsub';

type TBotInteraction = typeof botInteractions.$inferSelect;
type TBotEphemeralRow = typeof botEphemeralMessages.$inferSelect;

// discord's windows: three seconds for the first answer, fifteen minutes for the token
const RESPONSE_WINDOW_MS = 3_000;
const TOKEN_LIFETIME_MS = 15 * 60_000;

type TCreateInteraction = Pick<
  TBotInteraction,
  'botId' | 'userId' | 'channelId' | 'commandName'
>;

const createBotInteraction = async (input: TCreateInteraction) => {
  const token = randomBytes(48).toString('base64url');
  const tokenHash = await sha256(token);
  const interaction = db
    .insert(botInteractions)
    .values({ ...input, tokenHash, responded: false, createdAt: Date.now() })
    .returning()
    .get();

  return { interaction, token };
};

const getBotInteractionByToken = async (token: string) => {
  const tokenHash = await sha256(token);

  return db
    .select()
    .from(botInteractions)
    .where(eq(botInteractions.tokenHash, tokenHash))
    .limit(1)
    .get();
};

const isWithinResponseWindow = (interaction: TBotInteraction) =>
  Date.now() - interaction.createdAt <= RESPONSE_WINDOW_MS;

const isTokenAlive = (interaction: TBotInteraction) =>
  Date.now() - interaction.createdAt <= TOKEN_LIFETIME_MS;

// the one first answer an interaction gets. false when it already had one, which is what
// stops two answers racing each other
const claimBotInteractionResponse = (interactionId: number) =>
  !!db
    .update(botInteractions)
    .set({ responded: true })
    .where(
      and(
        eq(botInteractions.id, interactionId),
        eq(botInteractions.responded, false)
      )
    )
    .returning({ id: botInteractions.id })
    .get();

// tells the member when the bot lets the three seconds pass without answering
const watchBotInteractionResponse = (interaction: TBotInteraction) => {
  setTimeout(() => {
    const current = db
      .select({ responded: botInteractions.responded })
      .from(botInteractions)
      .where(
        and(
          eq(botInteractions.id, interaction.id),
          eq(botInteractions.createdAt, interaction.createdAt)
        )
      )
      .limit(1)
      .get();

    if (!current || current.responded) return;

    pubsub.publishFor(interaction.userId, ServerEvents.BOT_INTERACTION_FAILED, {
      interactionId: interaction.id,
      botId: interaction.botId,
      channelId: interaction.channelId,
      commandName: interaction.commandName
    });
  }, RESPONSE_WINDOW_MS).unref();
};

const toEphemeralPayload = (
  interaction: TBotInteraction,
  row: TBotEphemeralRow
): TBotEphemeralMessage => ({
  id: row.id,
  interactionId: interaction.id,
  botId: interaction.botId,
  channelId: interaction.channelId,
  commandName: interaction.commandName,
  content: row.content,
  loading: row.loading,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const publishEphemeral = (
  interaction: TBotInteraction,
  row: TBotEphemeralRow
) => {
  pubsub.publishFor(
    interaction.userId,
    ServerEvents.BOT_EPHEMERAL_MESSAGE,
    toEphemeralPayload(interaction, row)
  );
};

const createBotEphemeralMessage = (
  interaction: TBotInteraction,
  {
    content,
    loading,
    original
  }: Pick<TBotEphemeralRow, 'content' | 'loading' | 'original'>
) => {
  const now = Date.now();
  const row = db
    .insert(botEphemeralMessages)
    .values({
      interactionId: interaction.id,
      content,
      loading,
      original,
      createdAt: now,
      updatedAt: now
    })
    .returning()
    .get();

  publishEphemeral(interaction, row);

  return row;
};

const updateBotEphemeralMessage = (
  interaction: TBotInteraction,
  messageId: number,
  content: string
) => {
  const row = db
    .update(botEphemeralMessages)
    .set({ content, loading: false, updatedAt: Date.now() })
    .where(
      and(
        eq(botEphemeralMessages.id, messageId),
        eq(botEphemeralMessages.interactionId, interaction.id)
      )
    )
    .returning()
    .get();

  if (row) publishEphemeral(interaction, row);

  return row;
};

const deleteBotEphemeralMessage = (
  interaction: TBotInteraction,
  messageId: number
) => {
  db.delete(botEphemeralMessages)
    .where(
      and(
        eq(botEphemeralMessages.id, messageId),
        eq(botEphemeralMessages.interactionId, interaction.id)
      )
    )
    .run();

  pubsub.publishFor(
    interaction.userId,
    ServerEvents.BOT_EPHEMERAL_MESSAGE_DELETE,
    { id: messageId, channelId: interaction.channelId }
  );
};

// past the token's lifetime nothing can reach an interaction any more. answers already
// posted keep who ran the command, only their link to the interaction is cleared
const cleanupBotInteractions = () => {
  db.delete(botInteractions)
    .where(lt(botInteractions.createdAt, Date.now() - TOKEN_LIFETIME_MS))
    .run();
};

export {
  claimBotInteractionResponse,
  cleanupBotInteractions,
  createBotEphemeralMessage,
  createBotInteraction,
  deleteBotEphemeralMessage,
  getBotInteractionByToken,
  isTokenAlive,
  isWithinResponseWindow,
  RESPONSE_WINDOW_MS,
  TOKEN_LIFETIME_MS,
  updateBotEphemeralMessage,
  watchBotInteractionResponse,
  type TBotEphemeralRow,
  type TBotInteraction
};

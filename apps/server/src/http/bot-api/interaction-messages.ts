import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { botEphemeralMessages, messages } from '../../db/schema';
import {
  createBotEphemeralMessage,
  deleteBotEphemeralMessage,
  getBotInteractionById,
  updateBotEphemeralMessage,
  type TBotEphemeralRow,
  type TBotInteraction
} from '../../helpers/bot-interactions';
import {
  ephemeralSnowflake,
  serializeEphemeralMessage
} from '../../helpers/discord/ephemeral';
import { getGuildContext } from '../../helpers/discord/guild';
import { DiscordMessageFlag } from '../../helpers/discord/message';
import { resolveMessageSnowflake } from '../../helpers/discord/resolve';
import { decodeSnowflake, SnowflakeTag } from '../../helpers/discord/snowflake';
import { callProcedure } from './call-procedure';
import { createBotCaller } from './context';
import { DiscordErrorCode, notFound } from './errors';
import { messageSerializeOptions, serializeForBot } from './helpers';
import {
  emptyMessage,
  hasStoredContent,
  zMessageBody,
  type TMessageBody,
  type TStoredBody
} from './message-body';
import type { TInteractionRequest } from './types';

// an interaction answer is an ordinary message body, its flags saying whether it is ephemeral
const zInteractionMessage = zMessageBody;

type TInteractionMessage = TMessageBody;

// an ephemeral answer belongs to the interaction that posted it, its owner, which is not
// the interaction of a button pressed on it later
type TInteractionMessageTarget =
  | { kind: 'message'; id: number }
  | { kind: 'ephemeral'; row: TBotEphemeralRow; owner: TBotInteraction };

const isEphemeral = (flags: number | undefined) =>
  ((flags ?? 0) & DiscordMessageFlag.EPHEMERAL) !== 0;

type TPostOptions = {
  // checked and converted before the interaction is claimed, so a refused body does not
  // use up the bot's one answer
  stored: TStoredBody;
  ephemeral: boolean;
  original: boolean;
  loading: boolean;
};

// an ephemeral answer goes to the member alone. any other is a message the bot posts in
// the channel, through the same procedure as every other message it sends
const postInteractionMessage = async (
  { bot, info, interaction }: TInteractionRequest,
  { stored, ephemeral, original, loading }: TPostOptions
): Promise<TInteractionMessageTarget> => {
  const { html, embeds, components } = stored;

  if (ephemeral) {
    const row = createBotEphemeralMessage(interaction, {
      content: html ?? '',
      embeds: embeds?.length ? embeds : null,
      components: components?.length ? components : null,
      loading,
      original
    });

    return { kind: 'ephemeral', row, owner: interaction };
  }

  const caller = createBotCaller(bot, info, {
    interaction: {
      id: interaction.id,
      userId: interaction.userId,
      commandName: interaction.commandName,
      original,
      loading
    },
    embeds,
    components
  });
  const messageId = await callProcedure(
    () =>
      caller.messages.send({
        channelId: interaction.channelId,
        content: html ?? '',
        files: []
      }),
    { code: DiscordErrorCode.UNKNOWN_CHANNEL, what: 'Channel' }
  );

  return { kind: 'message', id: messageId! };
};

const unknownMessage = () =>
  notFound(DiscordErrorCode.UNKNOWN_MESSAGE, 'Message');

const findOwnEphemeral = (
  interactionId: number,
  condition: 'original' | number
) =>
  db
    .select()
    .from(botEphemeralMessages)
    .where(
      and(
        eq(botEphemeralMessages.interactionId, interactionId),
        condition === 'original'
          ? eq(botEphemeralMessages.original, true)
          : eq(botEphemeralMessages.id, condition)
      )
    )
    .limit(1)
    .get();

const findOwnMessages = (interactionId: number) =>
  db
    .select({ id: messages.id, invokerId: messages.interactionUserId })
    .from(messages)
    .where(eq(messages.interactionId, interactionId))
    .all();

// the ephemeral answer a button was pressed on, with the interaction that posted it
const findComponentEphemeral = async (
  interaction: TBotInteraction
): Promise<TInteractionMessageTarget | undefined> => {
  if (interaction.ephemeralMessageId === null) return undefined;

  const row = db
    .select()
    .from(botEphemeralMessages)
    .where(eq(botEphemeralMessages.id, interaction.ephemeralMessageId))
    .limit(1)
    .get();
  const owner = row ? getBotInteractionById(row.interactionId) : undefined;

  return row && owner ? { kind: 'ephemeral', row, owner } : undefined;
};

// the first answer, unless the bot has deleted it. a button or select menu answered by
// updating its message has no answer of its own, and its message stands in, as on discord
const findOriginalAnswer = async (
  interaction: TBotInteraction
): Promise<TInteractionMessageTarget | undefined> => {
  const ephemeral = findOwnEphemeral(interaction.id, 'original');

  if (ephemeral)
    return { kind: 'ephemeral', row: ephemeral, owner: interaction };

  const original = findOwnMessages(interaction.id).find(
    (row) => row.invokerId !== null
  );

  if (original) return { kind: 'message', id: original.id };

  if (interaction.messageId !== null) {
    return { kind: 'message', id: interaction.messageId };
  }

  return findComponentEphemeral(interaction);
};

// "@original" or the snowflake of one of this interaction's answers, or of the message its
// button was on, never anything else
const findInteractionMessage = async (
  { interaction }: TInteractionRequest,
  messageParam: string
): Promise<TInteractionMessageTarget> => {
  if (messageParam === '@original') {
    const original = await findOriginalAnswer(interaction);

    if (!original) throw unknownMessage();

    return original;
  }

  const decoded = decodeSnowflake(messageParam);

  if (decoded?.tag === SnowflakeTag.EPHEMERAL_MESSAGE) {
    const own = findOwnEphemeral(interaction.id, decoded.idBits);
    const target: TInteractionMessageTarget | undefined = own
      ? { kind: 'ephemeral', row: own, owner: interaction }
      : await findComponentEphemeral(interaction);

    if (
      target?.kind !== 'ephemeral' ||
      target.row.id !== decoded.idBits ||
      ephemeralSnowflake(target.row) !== messageParam
    ) {
      throw unknownMessage();
    }

    return target;
  }

  const messageId = await resolveMessageSnowflake(
    messageParam,
    interaction.channelId
  );
  const belongs =
    messageId !== undefined &&
    (messageId === interaction.messageId ||
      findOwnMessages(interaction.id).some((row) => row.id === messageId));

  if (!belongs) throw unknownMessage();

  return { kind: 'message', id: messageId };
};

const serializeInteractionMessage = async (
  request: TInteractionRequest,
  target: TInteractionMessageTarget
) => {
  const guild = await getGuildContext();

  if (target.kind === 'ephemeral') {
    return serializeEphemeralMessage(
      target.row,
      target.owner,
      messageSerializeOptions(request, guild)
    );
  }

  const caller = createBotCaller(request.bot, request.info);
  const message = await callProcedure(
    () => caller.messages.getOne({ messageId: target.id }),
    { code: DiscordErrorCode.UNKNOWN_MESSAGE, what: 'Message' }
  );
  const [serialized] = await serializeForBot(request, guild, [message]);

  return serialized;
};

// whether the answer is still the bot thinking, from a deferred response
const isLoadingAnswer = (target: TInteractionMessageTarget) => {
  if (target.kind === 'ephemeral') return target.row.loading;

  const row = db
    .select({ loading: messages.loading })
    .from(messages)
    .where(eq(messages.id, target.id))
    .limit(1)
    .get();

  return !!row?.loading;
};

// an edit changes what it names and keeps the rest, as on discord. filling in a loading
// answer is an edit like any other
const editInteractionMessage = async (
  request: TInteractionRequest,
  target: TInteractionMessageTarget,
  stored: TStoredBody
): Promise<TInteractionMessageTarget> => {
  if (
    stored.html === undefined &&
    stored.embeds === undefined &&
    stored.components === undefined
  ) {
    return target;
  }

  if (target.kind === 'ephemeral') {
    const next = {
      html: stored.html ?? target.row.content,
      embeds: stored.embeds ?? target.row.embeds ?? undefined
    };

    if (!hasStoredContent(next)) throw emptyMessage();

    const components = stored.components ?? target.row.components ?? undefined;
    const row = updateBotEphemeralMessage(target.owner, target.row.id, {
      content: next.html,
      embeds: next.embeds?.length ? next.embeds : null,
      components: components?.length ? components : null
    });

    if (!row) throw unknownMessage();

    return { kind: 'ephemeral', row, owner: target.owner };
  }

  const caller = createBotCaller(request.bot, request.info, {
    embeds: stored.embeds,
    components: stored.components
  });
  const unknown = { code: DiscordErrorCode.UNKNOWN_MESSAGE, what: 'Message' };
  let content = stored.html;

  if (content === undefined) {
    const current = await callProcedure(
      () => caller.messages.getOne({ messageId: target.id }),
      unknown
    );

    content = current.content ?? '';
  }

  const nextContent = content;

  await callProcedure(
    () => caller.messages.edit({ messageId: target.id, content: nextContent }),
    unknown
  );

  return target;
};

const deleteInteractionMessage = async (
  request: TInteractionRequest,
  target: TInteractionMessageTarget
) => {
  if (target.kind === 'ephemeral') {
    deleteBotEphemeralMessage(target.owner, target.row.id);

    return;
  }

  const caller = createBotCaller(request.bot, request.info);

  await callProcedure(() => caller.messages.delete({ messageId: target.id }), {
    code: DiscordErrorCode.UNKNOWN_MESSAGE,
    what: 'Message'
  });
};

export {
  deleteInteractionMessage,
  editInteractionMessage,
  findInteractionMessage,
  findOriginalAnswer,
  isEphemeral,
  isLoadingAnswer,
  postInteractionMessage,
  serializeInteractionMessage,
  zInteractionMessage,
  type TInteractionMessage,
  type TInteractionMessageTarget
};

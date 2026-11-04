import type { TJoinedMessage } from '@sandshark/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { botEphemeralMessages, messages } from '../../db/schema';
import {
  createBotEphemeralMessage,
  deleteBotEphemeralMessage,
  updateBotEphemeralMessage,
  type TBotEphemeralRow
} from '../../helpers/bot-interactions';
import { getGuildContext } from '../../helpers/discord/guild';
import { DiscordMessageFlag } from '../../helpers/discord/message';
import { resolveMessageSnowflake } from '../../helpers/discord/resolve';
import {
  decodeSnowflake,
  encodeSnowflake,
  SnowflakeTag
} from '../../helpers/discord/snowflake';
import { callProcedure } from './call-procedure';
import { createBotCaller } from './context';
import { DiscordErrorCode, notFound } from './errors';
import { serializeForBot } from './helpers';
import {
  emptyMessage,
  hasStoredContent,
  toStoredBody,
  zMessageBody,
  type TMessageBody,
  type TStoredBody
} from './message-body';
import type { TInteractionRequest } from './types';

// an interaction answer is an ordinary message body, its flags saying whether it is ephemeral
const zInteractionMessage = zMessageBody;

type TInteractionMessage = TMessageBody;

type TInteractionMessageTarget =
  | { kind: 'message'; id: number }
  | { kind: 'ephemeral'; row: TBotEphemeralRow };

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
  const { html, embeds } = stored;

  if (ephemeral) {
    const row = createBotEphemeralMessage(interaction, {
      content: html ?? '',
      embeds: embeds?.length ? embeds : null,
      loading,
      original
    });

    return { kind: 'ephemeral', row };
  }

  const caller = createBotCaller(bot, info, {
    interaction: {
      id: interaction.id,
      userId: interaction.userId,
      commandName: interaction.commandName,
      original,
      loading
    },
    embeds
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

const findEphemeral = (interactionId: number, condition: 'original' | number) =>
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

const findInteractionMessages = (interactionId: number) =>
  db
    .select({ id: messages.id, commandName: messages.interactionCommandName })
    .from(messages)
    .where(eq(messages.interactionId, interactionId))
    .all();

// the first answer, unless the bot has deleted it
const findOriginalAnswer = (
  interactionId: number
): TInteractionMessageTarget | undefined => {
  const ephemeral = findEphemeral(interactionId, 'original');

  if (ephemeral) return { kind: 'ephemeral', row: ephemeral };

  const original = findInteractionMessages(interactionId).find(
    (row) => row.commandName !== null
  );

  return original ? { kind: 'message', id: original.id } : undefined;
};

// "@original" or the snowflake of one of this interaction's answers, never anything else
const findInteractionMessage = async (
  { interaction }: TInteractionRequest,
  messageParam: string
): Promise<TInteractionMessageTarget> => {
  if (messageParam === '@original') {
    const original = findOriginalAnswer(interaction.id);

    if (!original) throw unknownMessage();

    return original;
  }

  const decoded = decodeSnowflake(messageParam);

  if (decoded?.tag === SnowflakeTag.EPHEMERAL_MESSAGE) {
    const ephemeral = findEphemeral(interaction.id, decoded.idBits);

    if (
      !ephemeral ||
      encodeSnowflake(
        SnowflakeTag.EPHEMERAL_MESSAGE,
        ephemeral.id,
        ephemeral.createdAt
      ) !== messageParam
    ) {
      throw unknownMessage();
    }

    return { kind: 'ephemeral', row: ephemeral };
  }

  const messageId = await resolveMessageSnowflake(
    messageParam,
    interaction.channelId
  );
  const belongs =
    messageId !== undefined &&
    findInteractionMessages(interaction.id).some((row) => row.id === messageId);

  if (!belongs) throw unknownMessage();

  return { kind: 'message', id: messageId };
};

// an ephemeral answer has no message row, so it is shaped like one for the serializer and
// given its own id and the ephemeral flag
const ephemeralAsMessage = (
  { bot, interaction }: TInteractionRequest,
  row: TBotEphemeralRow
): TJoinedMessage => ({
  id: row.id,
  content: row.content,
  userId: bot.id,
  pluginId: null,
  pluginComponents: null,
  channelId: interaction.channelId,
  parentMessageId: null,
  replyToMessageId: null,
  editable: true,
  metadata: null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  pinned: false,
  pinnedAt: null,
  pinnedBy: null,
  editedAt: null,
  editedBy: null,
  interactionId: interaction.id,
  interactionUserId: row.original ? interaction.userId : null,
  interactionCommandName: row.original ? interaction.commandName : null,
  loading: row.loading,
  embeds: row.embeds,
  files: [],
  reactions: []
});

const serializeInteractionMessage = async (
  request: TInteractionRequest,
  target: TInteractionMessageTarget
) => {
  const guild = await getGuildContext();

  if (target.kind === 'ephemeral') {
    const [serialized] = await serializeForBot(request, guild, [
      ephemeralAsMessage(request, target.row)
    ]);

    return {
      ...serialized,
      id: encodeSnowflake(
        SnowflakeTag.EPHEMERAL_MESSAGE,
        target.row.id,
        target.row.createdAt
      ),
      flags: serialized!.flags | DiscordMessageFlag.EPHEMERAL
    };
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
  body: TMessageBody
): Promise<TInteractionMessageTarget> => {
  const stored = await toStoredBody(body, { requireContent: false });

  if (stored.html === undefined && stored.embeds === undefined) return target;

  if (target.kind === 'ephemeral') {
    const next = {
      html: stored.html ?? target.row.content,
      embeds: stored.embeds ?? target.row.embeds ?? undefined
    };

    if (!hasStoredContent(next)) throw emptyMessage();

    const row = updateBotEphemeralMessage(request.interaction, target.row.id, {
      content: next.html,
      embeds: next.embeds?.length ? next.embeds : null
    });

    if (!row) throw unknownMessage();

    return { kind: 'ephemeral', row };
  }

  const caller = createBotCaller(request.bot, request.info, {
    embeds: stored.embeds
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
    deleteBotEphemeralMessage(request.interaction, target.row.id);

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
  type TInteractionMessage
};

import { z } from 'zod';
import {
  claimBotInteractionResponse,
  type TBotInteraction
} from '../../../helpers/bot-interactions';
import { interactionSnowflake } from '../../../helpers/discord/interaction';
import { alreadyAcknowledged, DiscordErrorCode, notFound } from '../errors';
import { invalidFormBody, readJsonBody } from '../helpers';
import {
  editInteractionMessage,
  findOriginalAnswer,
  isEphemeral,
  postInteractionMessage,
  serializeInteractionMessage,
  zInteractionMessage,
  type TInteractionMessageTarget
} from '../interaction-messages';
import { toStoredBody } from '../message-body';
import { NO_CONTENT, type TInteractionRequest } from '../types';

const InteractionCallbackType = {
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7
} as const;

const zCallback = z.object({
  type: z.number().int(),
  data: zInteractionMessage.optional()
});

const responseSummary = (
  interaction: TBotInteraction,
  messageId: string | undefined,
  loading: boolean,
  ephemeral: boolean
) => ({
  id: interactionSnowflake(interaction),
  type: interaction.commandName ? 2 : 3,
  activity_instance_id: null,
  response_message_id: messageId,
  response_message_loading: loading,
  response_message_ephemeral: ephemeral
});

// a button or select menu interaction knows the message it was used on
const isComponentInteraction = (interaction: TBotInteraction) =>
  interaction.messageId !== null || interaction.ephemeralMessageId !== null;

// discord answers 204 unless the bot asks for the message back. discord.py always asks,
// with "1", discord.js with "true" when it wants the message
const wantsResponse = (url: URL) =>
  ['1', 'true'].includes(
    (url.searchParams.get('with_response') ?? '').toLowerCase()
  );

// what the answer did to a message, handed back when the bot asks for it
const respondWith = async (
  request: TInteractionRequest,
  type: number,
  target: TInteractionMessageTarget | undefined,
  loading: boolean
) => {
  if (!wantsResponse(request.url)) return NO_CONTENT;

  const message = target
    ? await serializeInteractionMessage(request, target)
    : undefined;

  return {
    interaction: responseSummary(
      request.interaction,
      message?.id,
      loading,
      target?.kind === 'ephemeral'
    ),
    resource: { type, message }
  };
};

// the bot's first answer: a message, or "thinking" to be filled in later. for a button or
// select menu it can instead update the message the component is on, or do nothing
// visible yet. autocomplete and modal answers are not supported
const createInteractionResponseRoute = async (request: TInteractionRequest) => {
  const parsed = zCallback.safeParse(await readJsonBody(request.req));

  if (!parsed.success) throw invalidFormBody();

  const { type, data } = parsed.data;
  const { interaction } = request;
  const isUpdate =
    type === InteractionCallbackType.DEFERRED_UPDATE_MESSAGE ||
    type === InteractionCallbackType.UPDATE_MESSAGE;

  if (isUpdate) {
    if (!isComponentInteraction(interaction)) {
      throw invalidFormBody(
        'Only a button or select menu interaction can update its message.'
      );
    }

    const target = await findOriginalAnswer(interaction);

    if (!target) throw notFound(DiscordErrorCode.UNKNOWN_MESSAGE, 'Message');

    // the body is checked before the interaction is claimed, so a refused one does not use
    // up the bot's one answer
    const stored =
      type === InteractionCallbackType.UPDATE_MESSAGE
        ? await toStoredBody(data ?? {}, { requireContent: false })
        : undefined;

    if (!claimBotInteractionResponse(interaction.id)) {
      throw alreadyAcknowledged();
    }

    const updated = stored
      ? await editInteractionMessage(request, target, stored)
      : target;

    return respondWith(request, type, updated, false);
  }

  if (
    type !== InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE &&
    type !== InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  ) {
    throw invalidFormBody('This interaction response type is not supported.');
  }

  const loading =
    type === InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE;

  // a loading answer is the only one that may be empty, the bot writes it later
  const stored = loading
    ? { html: '', embeds: undefined, components: undefined }
    : await toStoredBody(data ?? {}, { requireContent: true });

  if (!claimBotInteractionResponse(interaction.id)) {
    throw alreadyAcknowledged();
  }

  const target = await postInteractionMessage(request, {
    stored,
    ephemeral: isEphemeral(data?.flags),
    original: true,
    loading
  });

  return respondWith(request, type, target, loading);
};

export { createInteractionResponseRoute };

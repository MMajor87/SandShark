import { z } from 'zod';
import {
  claimBotInteractionResponse,
  type TBotInteraction
} from '../../../helpers/bot-interactions';
import { interactionSnowflake } from '../../../helpers/discord/interaction';
import {
  alreadyAcknowledged,
  DiscordApiError,
  DiscordErrorCode
} from '../errors';
import { invalidFormBody, readJsonBody } from '../helpers';
import {
  isEphemeral,
  postInteractionMessage,
  serializeInteractionMessage,
  zInteractionMessage
} from '../interaction-messages';
import { NO_CONTENT, type TInteractionRequest } from '../types';

const InteractionCallbackType = {
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5
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
  type: 2,
  activity_instance_id: null,
  response_message_id: messageId,
  response_message_loading: loading,
  response_message_ephemeral: ephemeral
});

// the bot's first answer to a slash command: a message, or "thinking" to be filled in
// later. component, autocomplete and modal answers come with those features (#58)
const createInteractionResponseRoute = async (request: TInteractionRequest) => {
  const parsed = zCallback.safeParse(await readJsonBody(request.req));

  if (!parsed.success) throw invalidFormBody();

  const { type, data } = parsed.data;

  if (
    type !== InteractionCallbackType.CHANNEL_MESSAGE_WITH_SOURCE &&
    type !== InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
  ) {
    throw invalidFormBody('This interaction response type is not supported.');
  }

  const loading =
    type === InteractionCallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE;
  const ephemeral = isEphemeral(data?.flags);

  if (!loading && !data?.content?.trim()) {
    throw new DiscordApiError(
      400,
      DiscordErrorCode.CANNOT_SEND_EMPTY_MESSAGE,
      'Cannot send an empty message'
    );
  }

  if (!claimBotInteractionResponse(request.interaction.id)) {
    throw alreadyAcknowledged();
  }

  const target = await postInteractionMessage(request, {
    content: loading ? undefined : data?.content,
    ephemeral,
    original: true,
    loading
  });

  // discord answers 204 unless the bot asks for the message back. discord.py always asks,
  // with "1", discord.js with "true" when it wants the message
  const withResponse = request.url.searchParams.get('with_response') ?? '';

  if (!['1', 'true'].includes(withResponse.toLowerCase())) return NO_CONTENT;

  const message = await serializeInteractionMessage(request, target);

  return {
    interaction: responseSummary(
      request.interaction,
      message?.id,
      loading,
      ephemeral
    ),
    resource: { type, message }
  };
};

export { createInteractionResponseRoute };

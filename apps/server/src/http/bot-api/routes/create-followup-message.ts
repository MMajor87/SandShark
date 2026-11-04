import { invalidFormBody, readJsonBody } from '../helpers';
import {
  editInteractionMessage,
  findOriginalAnswer,
  isEphemeral,
  isLoadingAnswer,
  postInteractionMessage,
  serializeInteractionMessage,
  zInteractionMessage
} from '../interaction-messages';
import { toStoredBody } from '../message-body';
import type { TInteractionRequest } from '../types';

// another message after the first answer, public or for the member alone. after a
// deferred answer the first follow up fills in the thinking message instead, as on discord,
// which is what discord.py's defer then followup.send relies on
const createFollowupMessageRoute = async (request: TInteractionRequest) => {
  const parsed = zInteractionMessage.safeParse(await readJsonBody(request.req));

  if (!parsed.success) throw invalidFormBody();

  const original = await findOriginalAnswer(request.interaction);

  if (original && isLoadingAnswer(original)) {
    const filled = await editInteractionMessage(
      request,
      original,
      await toStoredBody(
        { ...parsed.data, content: parsed.data.content ?? '' },
        { requireContent: false }
      )
    );

    return serializeInteractionMessage(request, filled);
  }

  const target = await postInteractionMessage(request, {
    stored: await toStoredBody(parsed.data, { requireContent: true }),
    ephemeral: isEphemeral(parsed.data.flags),
    original: false,
    loading: false
  });

  return serializeInteractionMessage(request, target);
};

export { createFollowupMessageRoute };

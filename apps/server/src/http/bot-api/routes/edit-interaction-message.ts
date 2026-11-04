import { invalidFormBody, readJsonBody } from '../helpers';
import {
  editInteractionMessage,
  findInteractionMessage,
  serializeInteractionMessage,
  zInteractionMessage
} from '../interaction-messages';
import { toStoredBody } from '../message-body';
import type { TInteractionRequest } from '../types';

// fills in a deferred answer, or edits an answer. what the body leaves out stays as it is
const editInteractionMessageRoute = async (request: TInteractionRequest) => {
  const parsed = zInteractionMessage.safeParse(await readJsonBody(request.req));

  if (!parsed.success) throw invalidFormBody();

  const found = await findInteractionMessage(
    request,
    request.params.messageId!
  );
  const stored = await toStoredBody(parsed.data, { requireContent: false });
  const target = await editInteractionMessage(request, found, stored);

  return serializeInteractionMessage(request, target);
};

export { editInteractionMessageRoute };

import { invalidFormBody, readJsonBody } from '../helpers';
import {
  editInteractionMessage,
  findInteractionMessage,
  serializeInteractionMessage,
  zInteractionMessage
} from '../interaction-messages';
import type { TInteractionRequest } from '../types';

// fills in a deferred answer, or edits an answer. what the body leaves out stays as it is
const editInteractionMessageRoute = async (request: TInteractionRequest) => {
  const parsed = zInteractionMessage.safeParse(await readJsonBody(request.req));

  if (!parsed.success) throw invalidFormBody();

  const found = await findInteractionMessage(
    request,
    request.params.messageId!
  );
  const target = await editInteractionMessage(request, found, parsed.data);

  return serializeInteractionMessage(request, target);
};

export { editInteractionMessageRoute };

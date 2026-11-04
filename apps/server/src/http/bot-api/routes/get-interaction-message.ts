import {
  findInteractionMessage,
  serializeInteractionMessage
} from '../interaction-messages';
import type { TInteractionRequest } from '../types';

// "@original" or a follow up, by the path's message id
const getInteractionMessageRoute = async (request: TInteractionRequest) => {
  const target = await findInteractionMessage(
    request,
    request.params.messageId!
  );

  return serializeInteractionMessage(request, target);
};

export { getInteractionMessageRoute };

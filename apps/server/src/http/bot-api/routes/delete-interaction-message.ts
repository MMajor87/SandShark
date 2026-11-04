import {
  deleteInteractionMessage,
  findInteractionMessage
} from '../interaction-messages';
import { NO_CONTENT, type TInteractionRequest } from '../types';

const deleteInteractionMessageRoute = async (request: TInteractionRequest) => {
  const target = await findInteractionMessage(
    request,
    request.params.messageId!
  );

  await deleteInteractionMessage(request, target);

  return NO_CONTENT;
};

export { deleteInteractionMessageRoute };

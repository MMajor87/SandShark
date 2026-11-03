import { setOwnReaction } from '../set-own-reaction';
import type { TBotRouteHandler } from '../types';

const removeOwnReactionRoute: TBotRouteHandler = (request) =>
  setOwnReaction(request, false);

export { removeOwnReactionRoute };

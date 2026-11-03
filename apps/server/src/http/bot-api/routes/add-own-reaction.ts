import { setOwnReaction } from '../set-own-reaction';
import type { TBotRouteHandler } from '../types';

const addOwnReactionRoute: TBotRouteHandler = (request) =>
  setOwnReaction(request, true);

export { addOwnReactionRoute };

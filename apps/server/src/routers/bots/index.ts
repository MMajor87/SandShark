import { t } from '../../utils/trpc';
import { createBotRoute } from './create-bot';
import { deleteBotRoute } from './delete-bot';
import {
  onEphemeralMessageDeleteRoute,
  onEphemeralMessageRoute,
  onInteractionFailedRoute
} from './events';
import { getBotsRoute } from './get-bots';
import { renameBotRoute } from './rename-bot';
import { resetBotTokenRoute } from './reset-bot-token';
import { runCommandRoute } from './run-command';

const botsRouter = t.router({
  getAll: getBotsRoute,
  create: createBotRoute,
  rename: renameBotRoute,
  resetToken: resetBotTokenRoute,
  delete: deleteBotRoute,
  runCommand: runCommandRoute,
  onEphemeralMessage: onEphemeralMessageRoute,
  onEphemeralMessageDelete: onEphemeralMessageDeleteRoute,
  onInteractionFailed: onInteractionFailedRoute
});

export { botsRouter };

import { t } from '../../utils/trpc';
import { createBotRoute } from './create-bot';
import { deleteBotRoute } from './delete-bot';
import {
  onCommandsChangeRoute,
  onEphemeralMessageDeleteRoute,
  onEphemeralMessageRoute,
  onInteractionFailedRoute
} from './events';
import { getBotsRoute } from './get-bots';
import { getCommandsRoute } from './get-commands';
import { pressComponentRoute } from './press-component';
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
  pressComponent: pressComponentRoute,
  getCommands: getCommandsRoute,
  onCommandsChange: onCommandsChangeRoute,
  onEphemeralMessage: onEphemeralMessageRoute,
  onEphemeralMessageDelete: onEphemeralMessageDeleteRoute,
  onInteractionFailed: onInteractionFailedRoute
});

export { botsRouter };

import { t } from '../../utils/trpc';
import { autocompleteRoute } from './autocomplete';
import { createBotRoute } from './create-bot';
import { deleteBotRoute } from './delete-bot';
import {
  onCommandsChangeRoute,
  onEphemeralMessageDeleteRoute,
  onEphemeralMessageRoute,
  onHostedBotLogRoute,
  onHostedBotUpdateRoute,
  onInteractionFailedRoute,
  onModalOpenRoute
} from './events';
import { getBotsRoute } from './get-bots';
import { getCommandsRoute } from './get-commands';
import { getHostedRoute } from './get-hosted';
import { getHostedLogsRoute } from './get-hosted-logs';
import { pressComponentRoute } from './press-component';
import { renameBotRoute } from './rename-bot';
import { resetBotTokenRoute } from './reset-bot-token';
import { restartHostedRoute } from './restart-hosted';
import { runCommandRoute } from './run-command';
import { setHostedEnvRoute } from './set-hosted-env';
import { setHostedTokenEnvNamesRoute } from './set-hosted-token-env-names';
import { startHostedRoute } from './start-hosted';
import { stopHostedRoute } from './stop-hosted';
import { submitModalRoute } from './submit-modal';

const botsRouter = t.router({
  getAll: getBotsRoute,
  create: createBotRoute,
  rename: renameBotRoute,
  resetToken: resetBotTokenRoute,
  delete: deleteBotRoute,
  runCommand: runCommandRoute,
  pressComponent: pressComponentRoute,
  submitModal: submitModalRoute,
  autocomplete: autocompleteRoute,
  onModalOpen: onModalOpenRoute,
  getCommands: getCommandsRoute,
  onCommandsChange: onCommandsChangeRoute,
  onEphemeralMessage: onEphemeralMessageRoute,
  onEphemeralMessageDelete: onEphemeralMessageDeleteRoute,
  onInteractionFailed: onInteractionFailedRoute,
  getHosted: getHostedRoute,
  getHostedLogs: getHostedLogsRoute,
  startHosted: startHostedRoute,
  stopHosted: stopHostedRoute,
  restartHosted: restartHostedRoute,
  setHostedEnv: setHostedEnvRoute,
  setHostedTokenEnvNames: setHostedTokenEnvNamesRoute,
  onHostedBotUpdate: onHostedBotUpdateRoute,
  onHostedBotLog: onHostedBotLogRoute
});

export { botsRouter };

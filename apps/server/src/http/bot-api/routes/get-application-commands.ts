import { getBotCommands } from '../../../db/queries/bot-commands';
import { serializeCommand } from '../../../helpers/discord/command';
import { loadCommandScope } from '../helpers';
import type { TBotRouteHandler } from '../types';

// serves both the global list and the guild scoped one, which the path decides
const getApplicationCommandsRoute: TBotRouteHandler = async (request) => {
  const { scope, context } = await loadCommandScope(request);
  const commands = await getBotCommands(scope.botId, scope.guildScoped);

  return commands.map((command) => serializeCommand(command, context));
};

export { getApplicationCommandsRoute };

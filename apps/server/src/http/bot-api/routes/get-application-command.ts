import { serializeCommand } from '../../../helpers/discord/command';
import { loadCommandScope, loadOwnCommand } from '../helpers';
import type { TBotRouteHandler } from '../types';

const getApplicationCommandRoute: TBotRouteHandler = async (request) => {
  const { scope, context } = await loadCommandScope(request);
  const command = await loadOwnCommand(scope, request.params.commandId!);

  return serializeCommand(command, context);
};

export { getApplicationCommandRoute };

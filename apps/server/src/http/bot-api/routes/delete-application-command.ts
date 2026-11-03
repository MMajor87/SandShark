import { deleteBotCommand } from '../../../helpers/bot-commands';
import { loadCommandScope, loadOwnCommand } from '../helpers';
import { NO_CONTENT, type TBotRouteHandler } from '../types';

const deleteApplicationCommandRoute: TBotRouteHandler = async (request) => {
  const { scope } = await loadCommandScope(request);
  const command = await loadOwnCommand(scope, request.params.commandId!);

  deleteBotCommand(scope, command.id);

  return NO_CONTENT;
};

export { deleteApplicationCommandRoute };

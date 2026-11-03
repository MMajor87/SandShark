import { updateBotCommand } from '../../../helpers/bot-commands';
import {
  serializeCommand,
  toStoredCommand,
  zCommandFields
} from '../../../helpers/discord/command';
import {
  invalidFormBody,
  loadCommandScope,
  loadOwnCommand,
  readJsonBody
} from '../helpers';
import type { TBotRouteHandler } from '../types';

// a patch merges over the stored command, and the type of a command cannot change
const editApplicationCommandRoute: TBotRouteHandler = async (request) => {
  const parsed = zCommandFields.safeParse(await readJsonBody(request.req));

  if (!parsed.success) throw invalidFormBody();

  const { scope, context } = await loadCommandScope(request);
  const existing = await loadOwnCommand(scope, request.params.commandId!);

  if (parsed.data.type !== undefined && parsed.data.type !== existing.type) {
    throw invalidFormBody();
  }

  const command = toStoredCommand(parsed.data, existing);

  if (!command) throw invalidFormBody();

  const saved = updateBotCommand(scope, existing.id, command);

  if (!saved) {
    throw invalidFormBody('Application command names must be unique');
  }

  return serializeCommand(saved, context);
};

export { editApplicationCommandRoute };

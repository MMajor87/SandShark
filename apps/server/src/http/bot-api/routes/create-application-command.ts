import { upsertBotCommand } from '../../../helpers/bot-commands';
import {
  MAX_COMMANDS,
  serializeCommand,
  toStoredCommand,
  zCommandFields
} from '../../../helpers/discord/command';
import { invalidFormBody, loadCommandScope, readJsonBody } from '../helpers';
import type { TBotRouteHandler } from '../types';

// creating a command with the name of an existing one overwrites it, as on discord
const createApplicationCommandRoute: TBotRouteHandler = async (request) => {
  const parsed = zCommandFields.safeParse(await readJsonBody(request.req));

  if (!parsed.success || parsed.data.name === undefined) {
    throw invalidFormBody();
  }

  const command = toStoredCommand(parsed.data);

  if (!command) throw invalidFormBody();

  const { scope, context } = await loadCommandScope(request);
  const saved = upsertBotCommand(scope, command);

  if (!saved) {
    throw invalidFormBody(
      `Maximum number of application commands reached (${MAX_COMMANDS[command.type]})`
    );
  }

  return serializeCommand(saved, context);
};

export { createApplicationCommandRoute };

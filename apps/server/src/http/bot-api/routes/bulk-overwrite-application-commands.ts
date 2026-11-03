import { BotCommandType } from '@sandshark/shared';
import { commandKey, replaceBotCommands } from '../../../helpers/bot-commands';
import {
  MAX_COMMANDS,
  serializeCommand,
  toStoredCommand,
  zCommandFields,
  type TStoredCommand
} from '../../../helpers/discord/command';
import { invalidFormBody, loadCommandScope, readJsonArray } from '../helpers';
import type { TBotRouteHandler } from '../types';

// what discord.js's commands.set and discord.py's tree.sync send at startup: the whole list,
// replacing the scope. the list is checked as a whole before anything is written
const bulkOverwriteApplicationCommandsRoute: TBotRouteHandler = async (
  request
) => {
  const body = await readJsonArray(request.req);
  const commands: TStoredCommand[] = [];

  for (const item of body) {
    const parsed = zCommandFields.safeParse(item);
    const command =
      parsed.success && parsed.data.name !== undefined
        ? toStoredCommand(parsed.data)
        : undefined;

    if (!command) throw invalidFormBody();

    commands.push(command);
  }

  if (new Set(commands.map(commandKey)).size !== commands.length) {
    throw invalidFormBody('Application command names must be unique');
  }

  for (const type of [
    BotCommandType.CHAT_INPUT,
    BotCommandType.USER,
    BotCommandType.MESSAGE
  ]) {
    const total = commands.filter((command) => command.type === type).length;

    if (total > MAX_COMMANDS[type]) {
      throw invalidFormBody(
        `Maximum number of application commands reached (${MAX_COMMANDS[type]})`
      );
    }
  }

  const { scope, context } = await loadCommandScope(request);
  const saved = replaceBotCommands(scope, commands);

  return saved.map((command) => serializeCommand(command, context));
};

export { bulkOverwriteApplicationCommandsRoute };

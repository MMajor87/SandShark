import {
  BotCommandOptionType,
  type TBotCommandInfo,
  type TBotCommandOption
} from '@sandshark/shared';
import { getSlashCommandsWithBots } from '../db/queries/bot-commands';
import { getPublicUserById } from '../db/queries/users';
import { canUseBotCommand } from './bot-command-access';
import type { TBotCommandRow } from './discord/command';
import { getGuildContext } from './discord/guild';
import { memberPermissionBits } from './discord/member';

type TMenuLeaf = Pick<
  TBotCommandInfo,
  'name' | 'description' | 'subcommand' | 'options'
>;

const isSubcommand = (option: TBotCommandOption) =>
  option.type === BotCommandOptionType.SUB_COMMAND ||
  option.type === BotCommandOptionType.SUB_COMMAND_GROUP;

// a command with subcommands is run through one of them, so each is its own entry
const flattenCommand = (command: TBotCommandRow): TMenuLeaf[] => {
  if (!command.options.some(isSubcommand)) {
    return [
      {
        name: command.name,
        description: command.description,
        subcommand: [],
        options: command.options
      }
    ];
  }

  return command.options.flatMap((option) => {
    if (option.type === BotCommandOptionType.SUB_COMMAND) {
      return [
        {
          name: `${command.name} ${option.name}`,
          description: option.description,
          subcommand: [option.name],
          options: option.options ?? []
        }
      ];
    }

    return (option.options ?? []).map((child) => ({
      name: `${command.name} ${option.name} ${child.name}`,
      description: child.description,
      subcommand: [option.name, child.name],
      options: child.options ?? []
    }));
  });
};

// a member cannot hand a bot a file yet, so a command that needs one is not offered
const needsFile = (leaf: TMenuLeaf) =>
  leaf.options.some(
    (option) =>
      option.required && option.type === BotCommandOptionType.ATTACHMENT
  );

// the bot commands this member may run. when a bot registered a name both globally and for
// the guild, which a bot under development often does, the guild's copy is the one listed
const getBotCommandMenu = async (
  userId: number
): Promise<TBotCommandInfo[]> => {
  const [rows, member, guild] = await Promise.all([
    getSlashCommandsWithBots(),
    getPublicUserById(userId),
    getGuildContext()
  ]);

  if (!member) return [];

  const memberBits = memberPermissionBits(member, guild);
  const chosen = new Map<string, (typeof rows)[number]>();

  for (const row of rows) {
    const key = `${row.command.botId}:${row.command.name}`;
    const current = chosen.get(key);

    if (!current || (row.command.guildScoped && !current.command.guildScoped)) {
      chosen.set(key, row);
    }
  }

  return [...chosen.values()]
    .filter(({ command }) => canUseBotCommand(command, memberBits))
    .flatMap(({ command, botName }) =>
      flattenCommand(command)
        .filter((leaf) => !needsFile(leaf))
        .map((leaf) => ({
          ...leaf,
          commandId: command.id,
          botId: command.botId,
          botName
        }))
    );
};

export { getBotCommandMenu };

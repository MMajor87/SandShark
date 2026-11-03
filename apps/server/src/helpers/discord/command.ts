import {
  BotCommandOptionType,
  BotCommandType,
  type TBotCommandChoice,
  type TBotCommandOption
} from '@sandshark/shared';
import { z } from 'zod';
import type { botCommands } from '../../db/schema';
import { encodeSnowflake, SnowflakeTag } from './snowflake';

type TBotCommandRow = typeof botCommands.$inferSelect;

type TStoredCommand = Pick<
  TBotCommandRow,
  | 'type'
  | 'name'
  | 'description'
  | 'options'
  | 'defaultMemberPermissions'
  | 'nsfw'
>;

// discord's own limits. a bot that stays inside them on discord stays inside them here
const MAX_OPTIONS = 25;
const MAX_CHOICES = 25;
const MAX_COMMANDS: Record<BotCommandType, number> = {
  [BotCommandType.CHAT_INPUT]: 100,
  [BotCommandType.USER]: 15,
  [BotCommandType.MESSAGE]: 15
};

// slash command and option names: lowercase letters, digits and a few marks, as on discord
const CHAT_INPUT_NAME = /^[-_'\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$/u;

const isChatInputName = (name: string) =>
  CHAT_INPUT_NAME.test(name) && name === name.toLowerCase();

const zChoice = z.object({
  name: z.string().min(1).max(100),
  value: z.union([z.string().max(100), z.number()])
});

type TDiscordOption = {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: z.infer<typeof zChoice>[];
  options?: TDiscordOption[];
  channel_types?: number[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
};

const zOption: z.ZodType<TDiscordOption> = z.lazy(() =>
  z.object({
    type: z.number().int().min(1).max(11),
    name: z.string(),
    description: z.string().min(1).max(100),
    required: z.boolean().optional(),
    choices: z.array(zChoice).max(MAX_CHOICES).optional(),
    options: z.array(zOption).max(MAX_OPTIONS).optional(),
    channel_types: z.array(z.number().int()).optional(),
    min_value: z.number().optional(),
    max_value: z.number().optional(),
    min_length: z.number().int().min(0).max(6_000).optional(),
    max_length: z.number().int().min(1).max(6_000).optional(),
    autocomplete: z.boolean().optional()
  })
);

// every field is optional so the same shape serves a create, where the route insists on a
// name, and a patch, which merges over the stored command. localizations, contexts and
// the like are accepted and dropped: there is one language and one guild
const zCommandFields = z.object({
  type: z.number().int().min(1).max(3).optional(),
  name: z.string().min(1).max(32).optional(),
  description: z.string().max(100).optional(),
  options: z.array(zOption).max(MAX_OPTIONS).optional(),
  default_member_permissions: z
    .union([z.string().regex(/^\d{1,20}$/), z.number().int().min(0), z.null()])
    .optional(),
  nsfw: z.boolean().optional()
});

type TCommandFields = z.infer<typeof zCommandFields>;

const isSubcommand = (option: TDiscordOption) =>
  option.type === BotCommandOptionType.SUB_COMMAND ||
  option.type === BotCommandOptionType.SUB_COMMAND_GROUP;

const hasChoices = (option: TDiscordOption) =>
  option.type === BotCommandOptionType.STRING ||
  option.type === BotCommandOptionType.INTEGER ||
  option.type === BotCommandOptionType.NUMBER;

// the structural rules discord checks: names unique among siblings, required options
// before optional ones, subcommands not mixed with plain options, groups holding only
// subcommands and subcommands holding none, and choices only on text and number options
const areOptionsValid = (
  options: TDiscordOption[],
  parent: 'command' | 'group' | 'subcommand'
): boolean => {
  const names = new Set(options.map(({ name }) => name));

  if (names.size !== options.length) return false;

  const subcommands = options.filter(isSubcommand);

  if (subcommands.length > 0 && subcommands.length !== options.length) {
    return false;
  }

  let seenOptional = false;

  for (const option of options) {
    if (!isChatInputName(option.name)) return false;

    if (option.choices && !hasChoices(option)) return false;

    if (option.type === BotCommandOptionType.SUB_COMMAND_GROUP) {
      const children = option.options ?? [];

      if (parent !== 'command') return false;

      if (
        !children.every(
          (child) => child.type === BotCommandOptionType.SUB_COMMAND
        )
      ) {
        return false;
      }

      if (!areOptionsValid(children, 'group')) return false;

      continue;
    }

    if (option.type === BotCommandOptionType.SUB_COMMAND) {
      if (parent === 'subcommand') return false;

      if (!areOptionsValid(option.options ?? [], 'subcommand')) return false;

      continue;
    }

    if (option.options) return false;

    if (option.required) {
      if (seenOptional) return false;
    } else {
      seenOptional = true;
    }
  }

  return true;
};

const toStoredOption = (option: TDiscordOption): TBotCommandOption => ({
  type: option.type as BotCommandOptionType,
  name: option.name,
  description: option.description,
  required: option.required || undefined,
  choices: option.choices as TBotCommandChoice[] | undefined,
  options: option.options?.map(toStoredOption),
  channelTypes: option.channel_types,
  minValue: option.min_value,
  maxValue: option.max_value,
  minLength: option.min_length,
  maxLength: option.max_length,
  autocomplete: option.autocomplete
});

const toDiscordOption = (option: TBotCommandOption): TDiscordOption => ({
  type: option.type,
  name: option.name,
  description: option.description,
  required: option.required,
  choices: option.choices,
  options: option.options?.map(toDiscordOption),
  channel_types: option.channelTypes,
  min_value: option.minValue,
  max_value: option.maxValue,
  min_length: option.minLength,
  max_length: option.maxLength,
  autocomplete: option.autocomplete
});

// merges a create or patch body over the stored command, when there is one, and checks
// the result as a whole, since a patch can make an otherwise valid command invalid. returns
// undefined for anything discord would refuse
const toStoredCommand = (
  fields: TCommandFields,
  existing?: TStoredCommand
): TStoredCommand | undefined => {
  const type = (fields.type ??
    existing?.type ??
    BotCommandType.CHAT_INPUT) as BotCommandType;
  const name = fields.name ?? existing?.name;
  const description = fields.description ?? existing?.description ?? '';
  const options =
    fields.options ?? existing?.options.map(toDiscordOption) ?? [];

  if (!name) return undefined;

  if (type === BotCommandType.CHAT_INPUT) {
    if (!isChatInputName(name) || !description) return undefined;

    if (!areOptionsValid(options, 'command')) return undefined;
  } else if (description || options.length > 0) {
    // user and message commands have neither a description nor options on discord
    return undefined;
  }

  let defaultMemberPermissions = existing?.defaultMemberPermissions ?? null;

  if (fields.default_member_permissions !== undefined) {
    defaultMemberPermissions =
      fields.default_member_permissions === null
        ? null
        : String(fields.default_member_permissions);
  }

  return {
    type,
    name,
    description,
    options: options.map(toStoredOption),
    defaultMemberPermissions,
    nsfw: fields.nsfw ?? existing?.nsfw ?? false
  };
};

const commandSnowflake = (command: Pick<TBotCommandRow, 'id' | 'createdAt'>) =>
  encodeSnowflake(SnowflakeTag.COMMAND, command.id, command.createdAt);

type TSerializeCommandContext = {
  applicationId: string;
  guildId: string;
};

// localizations are always null and the command is usable in the guild only, since a
// sandshark server is one guild with no other installation contexts
const serializeCommand = (
  command: TBotCommandRow,
  { applicationId, guildId }: TSerializeCommandContext
) => ({
  id: commandSnowflake(command),
  application_id: applicationId,
  version: encodeSnowflake(SnowflakeTag.COMMAND, command.id, command.updatedAt),
  default_member_permissions: command.defaultMemberPermissions,
  type: command.type,
  name: command.name,
  name_localizations: null,
  description: command.description,
  description_localizations: null,
  guild_id: command.guildScoped ? guildId : undefined,
  dm_permission: command.guildScoped ? undefined : true,
  contexts: null,
  integration_types: [0],
  options: command.options.map(toDiscordOption),
  nsfw: command.nsfw
});

export {
  commandSnowflake,
  MAX_COMMANDS,
  serializeCommand,
  toStoredCommand,
  zCommandFields,
  type TBotCommandRow,
  type TCommandFields,
  type TStoredCommand
};

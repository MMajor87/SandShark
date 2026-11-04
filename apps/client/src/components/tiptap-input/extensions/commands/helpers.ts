import {
  BotCommandOptionType,
  MessageNodeType,
  type TBotCommandInfo,
  type TBotCommandOption,
  type TCommandArg,
  type TCommandInfo
} from '@sandshark/shared';

type TPluginCommandValues = Record<string, string>;

// the slash menu lists plugin commands and bot commands side by side
type TSlashCommand = TCommandInfo | TBotCommandInfo;

const isBotCommand = (command: TSlashCommand): command is TBotCommandInfo =>
  'commandId' in command;

type TBotCommandInvocation = {
  commandId: number;
  subcommand: string[];
  values: Record<string, string | number | boolean>;
};

const safeJsonParse = <T>(raw: unknown, fallback: T): T => {
  if (typeof raw !== 'string' || !raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const serializeArgToken = (value: string): string => {
  if (value.length === 0) {
    return '""';
  }

  if (/^[^\s"'\\]+$/.test(value)) {
    return value;
  }

  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  return `"${escaped}"`;
};

const serializeArgValue = (arg: TCommandArg, raw: string): string => {
  if (raw === '') return '""';

  if (arg.type === 'number') return raw;

  if (arg.type === 'boolean') return raw === 'true' ? 'true' : 'false';

  return serializeArgToken(raw);
};

const serializePluginCommandText = (
  commandName: string,
  argDefs: TCommandArg[],
  values: TPluginCommandValues
): string => {
  const tokens = argDefs.map((arg) =>
    serializeArgValue(arg, values[arg.name] ?? '')
  );

  while (tokens.at(-1) === '""') tokens.pop();

  return [`/${commandName}`, ...tokens].join(' ');
};

type TMissingCommandArg = {
  commandName: string;
  argName: string;
};

// a bot command chip shows its values as text, the way the plugin chip does
const serializeBotCommandText = (
  commandName: string,
  options: TBotCommandOption[],
  values: TPluginCommandValues
): string => {
  const tokens = options
    .map((option) => values[option.name] ?? '')
    .filter((value) => value !== '')
    .map(serializeArgToken);

  return [`/${commandName}`, ...tokens].join(' ');
};

// what the chip holds, every value a string, as the value the server checks against the
// option's type. users, channels and roles are picked by id, a mentionable keeps its kind
const toInvocationValue = (
  option: TBotCommandOption,
  raw: string
): string | number | boolean => {
  switch (option.type) {
    case BotCommandOptionType.INTEGER:
    case BotCommandOptionType.NUMBER:
    case BotCommandOptionType.USER:
    case BotCommandOptionType.CHANNEL:
    case BotCommandOptionType.ROLE:
      return Number(raw);
    case BotCommandOptionType.BOOLEAN:
      return raw === 'true';
    default:
      return raw;
  }
};

const BOT_COMMAND_SELECTOR = `span[data-type="${MessageNodeType.BOT_COMMAND}"]`;

type TBotCommandNodeAttrs = {
  commandId: string | null;
  subcommand: string | null;
  options: string | null;
  values: string | null;
};

// the chip's attributes, as the call that runs the command. blank values are left out so
// the server sees an optional option as not given
const toBotCommandInvocation = (
  attrs: TBotCommandNodeAttrs
): TBotCommandInvocation => {
  const options = safeJsonParse<TBotCommandOption[]>(attrs.options, []);
  const raw = safeJsonParse<TPluginCommandValues>(attrs.values, {});
  const values: TBotCommandInvocation['values'] = {};

  for (const option of options) {
    const value = raw[option.name] ?? '';

    if (value !== '') values[option.name] = toInvocationValue(option, value);
  }

  return {
    commandId: Number(attrs.commandId),
    subcommand: safeJsonParse<string[]>(attrs.subcommand, []),
    values
  };
};

// a message holding a bot command chip is not sent, the command is run instead
const parseBotCommandInvocation = (
  html: string
): TBotCommandInvocation | undefined => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const node = document.querySelector(BOT_COMMAND_SELECTOR);

  if (!node) return undefined;

  return toBotCommandInvocation({
    commandId: node.getAttribute('data-command-id'),
    subcommand: node.getAttribute('data-command-subcommand'),
    options: node.getAttribute('data-command-options'),
    values: node.getAttribute('data-command-values')
  });
};

const findMissingRequiredCommandArg = (
  html: string
): TMissingCommandArg | undefined => {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const nodes = document.querySelectorAll(
    `span[data-type="${MessageNodeType.PLUGIN_COMMAND}"], ${BOT_COMMAND_SELECTOR}`
  );

  for (const node of nodes) {
    const isBotNode =
      node.getAttribute('data-type') === MessageNodeType.BOT_COMMAND;
    const argDefs = safeJsonParse<Pick<TCommandArg, 'name' | 'required'>[]>(
      node.getAttribute(
        isBotNode ? 'data-command-options' : 'data-command-args'
      ),
      []
    );
    const values = safeJsonParse<TPluginCommandValues>(
      node.getAttribute('data-command-values'),
      {}
    );
    const missing = argDefs.find(
      (arg) => arg.required && !(values[arg.name] ?? '')
    );

    if (missing) {
      return {
        commandName: node.getAttribute('data-command-name') ?? '',
        argName: missing.name
      };
    }
  }

  return undefined;
};

export {
  findMissingRequiredCommandArg,
  isBotCommand,
  parseBotCommandInvocation,
  safeJsonParse,
  serializeBotCommandText,
  serializePluginCommandText,
  toBotCommandInvocation
};
export type {
  TBotCommandInvocation,
  TMissingCommandArg,
  TPluginCommandValues,
  TSlashCommand
};

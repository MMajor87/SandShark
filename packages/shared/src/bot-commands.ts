import type { TBotActionRow } from './message-components';
import type { TMessageEmbed } from './message-embeds';

// discord's application command types. chat input commands are the slash commands; user
// and message commands are the right click "Apps" entries
export enum BotCommandType {
  CHAT_INPUT = 1,
  USER = 2,
  MESSAGE = 3
}

export enum BotCommandOptionType {
  SUB_COMMAND = 1,
  SUB_COMMAND_GROUP = 2,
  STRING = 3,
  INTEGER = 4,
  BOOLEAN = 5,
  USER = 6,
  CHANNEL = 7,
  ROLE = 8,
  MENTIONABLE = 9,
  NUMBER = 10,
  ATTACHMENT = 11
}

export type TBotCommandChoice = {
  name: string;
  value: string | number;
};

// a bot command option as stored, the camel cased form of discord's option object
export type TBotCommandOption = {
  type: BotCommandOptionType;
  name: string;
  description: string;
  required?: boolean;
  choices?: TBotCommandChoice[];
  options?: TBotCommandOption[];
  channelTypes?: number[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  autocomplete?: boolean;
};

// a bot's answer that only the member who ran the command sees. content is message html
export type TBotEphemeralMessage = {
  id: number;
  interactionId: number;
  botId: number;
  channelId: number;
  commandName: string;
  content: string;
  embeds: TMessageEmbed[] | null;
  components: TBotActionRow[] | null;
  loading: boolean;
  createdAt: number;
  updatedAt: number;
};

export type TBotEphemeralMessageDelete = {
  id: number;
  channelId: number;
};

// the bot did not answer within discord's three seconds, so the member is told
export type TBotInteractionFailed = {
  interactionId: number;
  botId: number;
  channelId: number;
  commandName: string;
};

// one entry of the composer's slash menu for a bot command. a command with subcommands is
// listed once per subcommand, named by its whole path ("config set")
export type TBotCommandInfo = {
  commandId: number;
  botId: number;
  botName: string;
  name: string;
  description: string;
  // the subcommand group and subcommand under the command, outermost first
  subcommand: string[];
  options: TBotCommandOption[];
};

export type TBotCommandsChange = {
  botId: number;
};

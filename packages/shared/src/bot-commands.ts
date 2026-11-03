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

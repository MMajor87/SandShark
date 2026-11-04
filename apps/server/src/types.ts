import type { BotCommandOptionType, BotComponentType } from '@sandshark/shared';
import type { botCommands } from './db/schema';

type TBotCommand = typeof botCommands.$inferSelect;

export type TTokenPayload = {
  userId: number;
  exp: number;
  tokenVersion?: number;
};

export type TConnectionInfo = {
  ip?: string;
  os?: string;
  device?: string;
  userAgent?: string;
};

// an option of a slash command as a member filled it in. users, channels and roles are
// row ids here and become snowflakes when the gateway describes the interaction
export type TInvocationOption = {
  name: string;
  type: BotCommandOptionType;
  value?: string | number | boolean;
  options?: TInvocationOption[];
  // the option a member is typing into, when the bot is asked for suggestions
  focused?: boolean;
};

type TBotInteractionEventBase = {
  interactionId: number;
  token: string;
  createdAt: number;
  userId: number;
  channelId: number;
};

export type TBotCommandInteractionEvent = TBotInteractionEventBase & {
  kind: 'command';
  command: Pick<
    TBotCommand,
    'id' | 'createdAt' | 'name' | 'type' | 'guildScoped'
  >;
  options: TInvocationOption[];
};

// a button pressed or a select menu chosen, on a message or on an ephemeral answer
export type TBotComponentInteractionEvent = TBotInteractionEventBase & {
  kind: 'component';
  customId: string;
  componentType: BotComponentType;
  values: string[];
  messageId: number | null;
  ephemeralMessageId: number | null;
};

// a member typing into an option the bot completes. the options are as far as they are
// filled in, the focused one holding whatever has been typed so far
export type TBotAutocompleteInteractionEvent = TBotInteractionEventBase & {
  kind: 'autocomplete';
  command: TBotCommandInteractionEvent['command'];
  options: TInvocationOption[];
};

// a form submitted. it may have been opened from a button, whose message it then carries
export type TBotModalInteractionEvent = TBotInteractionEventBase & {
  kind: 'modal';
  customId: string;
  labelled: boolean;
  values: { customId: string; value: string }[];
  messageId: number | null;
  ephemeralMessageId: number | null;
};

// handed to the bot's gateway sessions, the only place the plain token exists
export type TBotInteractionEvent =
  | TBotCommandInteractionEvent
  | TBotComponentInteractionEvent
  | TBotModalInteractionEvent
  | TBotAutocompleteInteractionEvent;

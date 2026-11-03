import type { BotCommandOptionType } from '@sandshark/shared';
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
};

// handed to the bot's gateway sessions, the only place the plain token exists
export type TBotInteractionEvent = {
  interactionId: number;
  token: string;
  createdAt: number;
  userId: number;
  channelId: number;
  command: Pick<
    TBotCommand,
    'id' | 'createdAt' | 'name' | 'type' | 'guildScoped'
  >;
  options: TInvocationOption[];
};

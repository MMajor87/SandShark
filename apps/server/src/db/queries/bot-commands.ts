import { BotCommandType } from '@sandshark/shared';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '..';
import { botCommands, users } from '../schema';

const getBotCommands = async (botId: number, guildScoped: boolean) =>
  db
    .select()
    .from(botCommands)
    .where(
      and(
        eq(botCommands.botId, botId),
        eq(botCommands.guildScoped, guildScoped)
      )
    )
    .orderBy(asc(botCommands.id))
    .all();

// the bot and scope are part of the lookup, so a bot can only ever reach its own commands
const getBotCommandById = async (
  botId: number,
  guildScoped: boolean,
  commandId: number
) =>
  db
    .select()
    .from(botCommands)
    .where(
      and(
        eq(botCommands.id, commandId),
        eq(botCommands.botId, botId),
        eq(botCommands.guildScoped, guildScoped)
      )
    )
    .limit(1)
    .get();

// the slash command a member picked, from any bot and either scope. user and message
// commands are not slash commands and cannot be run this way
const getSlashCommandById = async (commandId: number) =>
  db
    .select()
    .from(botCommands)
    .where(
      and(
        eq(botCommands.id, commandId),
        eq(botCommands.type, BotCommandType.CHAT_INPUT)
      )
    )
    .limit(1)
    .get();

// every bot's slash commands with the bot's name, for the composer's menu. a banned bot's
// commands are left out, it cannot answer them
const getSlashCommandsWithBots = async () =>
  db
    .select({ command: botCommands, botName: users.name })
    .from(botCommands)
    .innerJoin(users, eq(users.id, botCommands.botId))
    .where(
      and(
        eq(botCommands.type, BotCommandType.CHAT_INPUT),
        eq(users.banned, false)
      )
    )
    .orderBy(asc(botCommands.id))
    .all();

export {
  getBotCommandById,
  getBotCommands,
  getSlashCommandById,
  getSlashCommandsWithBots
};

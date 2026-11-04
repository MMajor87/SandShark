import { ServerEvents } from '@sandshark/shared';
import { and, count, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db';
import { botCommands } from '../db/schema';
import { pubsub } from '../utils/pubsub';
import {
  MAX_COMMANDS,
  type TBotCommandRow,
  type TStoredCommand
} from './discord/command';

type TCommandScope = {
  botId: number;
  guildScoped: boolean;
};

// every member's slash menu lists bot commands, so any change is announced to all of them
const publishBotCommandsChange = (botId: number) => {
  pubsub.publish(ServerEvents.BOT_COMMANDS_CHANGE, { botId });
};

const inScope = ({ botId, guildScoped }: TCommandScope) =>
  and(eq(botCommands.botId, botId), eq(botCommands.guildScoped, guildScoped));

const sameKey = (scope: TCommandScope, command: TStoredCommand) =>
  and(
    inScope(scope),
    eq(botCommands.type, command.type),
    eq(botCommands.name, command.name)
  );

// creating a command whose name and type already exist overwrites it and keeps its id, as
// discord does. returns undefined when a new command would go over discord's limit
const upsertBotCommand = (
  scope: TCommandScope,
  command: TStoredCommand
): TBotCommandRow | undefined => {
  const now = Date.now();
  const saved = db.transaction((tx) => {
    const existing = tx
      .select({ id: botCommands.id })
      .from(botCommands)
      .where(sameKey(scope, command))
      .limit(1)
      .get();

    if (existing) {
      return tx
        .update(botCommands)
        .set({ ...command, updatedAt: now })
        .where(eq(botCommands.id, existing.id))
        .returning()
        .get();
    }

    const [{ total }] = tx
      .select({ total: count() })
      .from(botCommands)
      .where(and(inScope(scope), eq(botCommands.type, command.type)))
      .all() as [{ total: number }];

    if (total >= MAX_COMMANDS[command.type]) return undefined;

    return tx
      .insert(botCommands)
      .values({ ...scope, ...command, createdAt: now, updatedAt: now })
      .returning()
      .get();
  });

  if (saved) publishBotCommandsChange(scope.botId);

  return saved;
};

// returns undefined when the edit renames the command onto another of the bot's commands
const updateBotCommand = (
  scope: TCommandScope,
  commandId: number,
  command: TStoredCommand
): TBotCommandRow | undefined => {
  const saved = db.transaction((tx) => {
    const clash = tx
      .select({ id: botCommands.id })
      .from(botCommands)
      .where(and(sameKey(scope, command), ne(botCommands.id, commandId)))
      .limit(1)
      .get();

    if (clash) return undefined;

    return tx
      .update(botCommands)
      .set({ ...command, updatedAt: Date.now() })
      .where(and(eq(botCommands.id, commandId), inScope(scope)))
      .returning()
      .get();
  });

  if (saved) publishBotCommandsChange(scope.botId);

  return saved;
};

const deleteBotCommand = (scope: TCommandScope, commandId: number) => {
  db.delete(botCommands)
    .where(and(eq(botCommands.id, commandId), inScope(scope)))
    .run();

  publishBotCommandsChange(scope.botId);
};

const commandKey = ({ type, name }: Pick<TStoredCommand, 'type' | 'name'>) =>
  `${type}:${name}`;

// the bulk overwrite discord.js and discord.py run at startup. commands that keep their
// name and type keep their id, the rest of the scope is removed. the caller has already
// checked the list for duplicates and limits
const replaceBotCommands = (
  scope: TCommandScope,
  commands: TStoredCommand[]
): TBotCommandRow[] => {
  const now = Date.now();
  const saved = db.transaction((tx) => {
    const existing = tx.select().from(botCommands).where(inScope(scope)).all();
    const existingByKey = new Map(
      existing.map((row) => [commandKey(row), row])
    );
    const keep = new Set(commands.map(commandKey));
    const removedIds = existing
      .filter((row) => !keep.has(commandKey(row)))
      .map(({ id }) => id);

    if (removedIds.length > 0) {
      tx.delete(botCommands).where(inArray(botCommands.id, removedIds)).run();
    }

    return commands.map((command) => {
      const current = existingByKey.get(commandKey(command));

      if (current) {
        return tx
          .update(botCommands)
          .set({ ...command, updatedAt: now })
          .where(eq(botCommands.id, current.id))
          .returning()
          .get();
      }

      return tx
        .insert(botCommands)
        .values({ ...scope, ...command, createdAt: now, updatedAt: now })
        .returning()
        .get();
    });
  });

  publishBotCommandsChange(scope.botId);

  return saved;
};

export {
  commandKey,
  deleteBotCommand,
  publishBotCommandsChange,
  replaceBotCommands,
  updateBotCommand,
  upsertBotCommand,
  type TCommandScope
};

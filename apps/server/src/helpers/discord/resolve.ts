import { and, eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '../../db';
import {
  categories,
  channels,
  emojis,
  messages,
  roles,
  users
} from '../../db/schema';
import {
  decodeSnowflake,
  encodeSnowflake,
  resolveSnowflakeId,
  SnowflakeTag
} from './snowflake';

type TTableWithCreatedAt = SQLiteTable & {
  id: SQLiteColumn;
  createdAt: SQLiteColumn;
};

const createdAtLookup = (table: TTableWithCreatedAt) => async (id: number) => {
  const row = await db
    .select({ createdAt: table.createdAt })
    .from(table)
    .where(eq(table.id, id))
    .limit(1)
    .get();

  return row?.createdAt as number | undefined;
};

const resolveUserSnowflake = (value: string) =>
  resolveSnowflakeId(value, SnowflakeTag.USER, createdAtLookup(users));

const resolveChannelSnowflake = (value: string) =>
  resolveSnowflakeId(value, SnowflakeTag.CHANNEL, createdAtLookup(channels));

const resolveCategorySnowflake = (value: string) =>
  resolveSnowflakeId(value, SnowflakeTag.CATEGORY, createdAtLookup(categories));

const resolveRoleSnowflake = (value: string) =>
  resolveSnowflakeId(value, SnowflakeTag.ROLE, createdAtLookup(roles));

const resolveEmojiSnowflake = (value: string) =>
  resolveSnowflakeId(value, SnowflakeTag.EMOJI, createdAtLookup(emojis));

// messages are the one table that outgrows the 18 id bits, so a miss on the primary key
// falls back to the channel and creation time the snowflake carries, which the
// messages_channel_created_idx index serves
const resolveMessageSnowflake = async (value: string, channelId: number) => {
  const decoded = decodeSnowflake(value);

  if (!decoded || decoded.tag !== SnowflakeTag.MESSAGE) return undefined;

  const matches = (row: { id: number; createdAt: number } | undefined) =>
    !!row &&
    encodeSnowflake(SnowflakeTag.MESSAGE, row.id, row.createdAt) === value;

  const direct = await db
    .select({ id: messages.id, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(eq(messages.id, decoded.idBits), eq(messages.channelId, channelId))
    )
    .limit(1)
    .get();

  if (matches(direct)) return direct!.id;

  const candidates = await db
    .select({ id: messages.id, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.channelId, channelId),
        eq(messages.createdAt, decoded.timestamp)
      )
    )
    .all();
  const match = candidates.find(matches);

  return match?.id;
};

export {
  resolveCategorySnowflake,
  resolveChannelSnowflake,
  resolveEmojiSnowflake,
  resolveMessageSnowflake,
  resolveRoleSnowflake,
  resolveUserSnowflake
};

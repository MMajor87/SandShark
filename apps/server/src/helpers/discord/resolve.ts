import { eq } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { db } from '../../db';
import { categories, channels, roles, users } from '../../db/schema';
import { resolveSnowflakeId, SnowflakeTag } from './snowflake';

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

export {
  resolveCategorySnowflake,
  resolveChannelSnowflake,
  resolveRoleSnowflake,
  resolveUserSnowflake
};

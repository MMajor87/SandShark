import type { TJoinedBot } from '@sandshark/shared';
import { eq, inArray } from 'drizzle-orm';
import { db } from '..';
import { bots, userRoles, users } from '../schema';

const getBots = async (): Promise<TJoinedBot[]> => {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      createdAt: bots.createdAt,
      createdBy: bots.createdBy,
      tokenUpdatedAt: bots.tokenUpdatedAt
    })
    .from(bots)
    .innerJoin(users, eq(users.id, bots.userId))
    .orderBy(bots.createdAt)
    .all();

  if (rows.length === 0) return [];

  const roles = await db
    .select({ userId: userRoles.userId, roleId: userRoles.roleId })
    .from(userRoles)
    .where(
      inArray(
        userRoles.userId,
        rows.map((row) => row.id)
      )
    )
    .all();

  const roleIdsByUser = new Map<number, number[]>();

  for (const { userId, roleId } of roles) {
    const list = roleIdsByUser.get(userId) ?? [];

    list.push(roleId);
    roleIdsByUser.set(userId, list);
  }

  return rows.map((row) => ({
    ...row,
    roleIds: roleIdsByUser.get(row.id) ?? []
  }));
};

const getBotById = (botId: number) =>
  db
    .select({ id: users.id, name: users.name })
    .from(bots)
    .innerJoin(users, eq(users.id, bots.userId))
    .where(eq(bots.userId, botId))
    .limit(1)
    .get();

export { getBotById, getBots };

import type { TCalendarCursor } from '@sharkord/shared';
import { and, eq, exists, gt, inArray, or, sql } from 'drizzle-orm';
import { db } from '..';
import {
  calendarEventInvitees,
  calendarEvents,
  roles,
  userRoles,
  users
} from '../schema';

const calendarVisibility = (userId: number) =>
  or(
    eq(calendarEvents.creatorId, userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(calendarEventInvitees)
        .where(
          and(
            eq(calendarEventInvitees.eventId, calendarEvents.id),
            or(
              eq(calendarEventInvitees.userId, userId),
              inArray(
                calendarEventInvitees.roleId,
                db
                  .select({ roleId: userRoles.roleId })
                  .from(userRoles)
                  .where(eq(userRoles.userId, userId))
              )
            )
          )
        )
    )
  );

const getCalendarEventsPage = async (
  userId: number,
  limit: number,
  cursor?: TCalendarCursor
) => {
  const rows = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startsAt: calendarEvents.startsAt,
      endsAt: calendarEvents.endsAt,
      creatorId: calendarEvents.creatorId,
      creatorName: users.name,
      createdAt: calendarEvents.createdAt,
      updatedAt: calendarEvents.updatedAt
    })
    .from(calendarEvents)
    .innerJoin(users, eq(calendarEvents.creatorId, users.id))
    .where(
      and(
        calendarVisibility(userId),
        cursor
          ? or(
              gt(calendarEvents.startsAt, cursor.startsAt),
              and(
                eq(calendarEvents.startsAt, cursor.startsAt),
                gt(calendarEvents.id, cursor.id)
              )
            )
          : undefined
      )
    )
    .orderBy(calendarEvents.startsAt, calendarEvents.id)
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const events = rows
    .slice(0, limit)
    .map((event) => ({ ...event, canDelete: event.creatorId === userId }));
  const last = events.at(-1);
  const nextCursor =
    hasMore && last ? { startsAt: last.startsAt, id: last.id } : undefined;
  return { events, nextCursor };
};
const getVisibleCalendarEvent = (userId: number, eventId: number) =>
  db
    .select({ id: calendarEvents.id, creatorId: calendarEvents.creatorId })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), calendarVisibility(userId)))
    .limit(1)
    .get();
const getCalendarInviteTargets = async (
  userIds: number[],
  roleIds: number[]
) => {
  const [foundUsers, foundRoles] = await Promise.all([
    userIds.length
      ? db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, userIds))
      : [],
    roleIds.length
      ? db
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, roleIds))
      : []
  ]);
  return { foundUsers, foundRoles };
};
export {
  getCalendarEventsPage,
  getCalendarInviteTargets,
  getVisibleCalendarEvent
};

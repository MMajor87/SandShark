import {
  CalendarResponseStatus,
  type TCalendarCursor,
  type TCalendarInvitee,
  type TCalendarResponseCounts,
  type TJoinedCalendarEvent
} from '@sandshark/shared';
import {
  and,
  count,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  or,
  sql,
  type SQL
} from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { db } from '..';
import {
  calendarEventInvitees,
  calendarEventResponses,
  calendarEvents,
  roles,
  userRoles,
  users
} from '../schema';

// takes a column as well as an id so the response counts can apply the same rule to
// each responder, which keeps a user who lost their invitation out of the totals
const calendarVisibility = (userId: number | SQLiteColumn | SQL) =>
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

const createEmptyCounts = (): TCalendarResponseCounts => ({
  [CalendarResponseStatus.GOING]: 0,
  [CalendarResponseStatus.MAYBE]: 0,
  [CalendarResponseStatus.DECLINED]: 0
});

const getCalendarEventRelations = async (
  userId: number,
  eventIds: number[]
) => {
  const invitees = new Map<number, TCalendarInvitee[]>();
  const counts = new Map<number, TCalendarResponseCounts>();
  const own = new Map<number, CalendarResponseStatus>();

  if (eventIds.length === 0) return { invitees, counts, own };

  const [userInvitees, roleInvitees, responseCounts, ownResponses] =
    await Promise.all([
      db
        .select({
          eventId: calendarEventInvitees.eventId,
          id: users.id,
          name: users.name
        })
        .from(calendarEventInvitees)
        .innerJoin(users, eq(calendarEventInvitees.userId, users.id))
        .where(inArray(calendarEventInvitees.eventId, eventIds)),
      db
        .select({
          eventId: calendarEventInvitees.eventId,
          id: roles.id,
          name: roles.name
        })
        .from(calendarEventInvitees)
        .innerJoin(roles, eq(calendarEventInvitees.roleId, roles.id))
        .where(inArray(calendarEventInvitees.eventId, eventIds)),
      db
        .select({
          eventId: calendarEventResponses.eventId,
          status: calendarEventResponses.status,
          total: count()
        })
        .from(calendarEventResponses)
        .innerJoin(
          calendarEvents,
          eq(calendarEvents.id, calendarEventResponses.eventId)
        )
        .where(
          and(
            inArray(calendarEventResponses.eventId, eventIds),
            calendarVisibility(calendarEventResponses.userId)
          )
        )
        .groupBy(calendarEventResponses.eventId, calendarEventResponses.status),
      db
        .select({
          eventId: calendarEventResponses.eventId,
          status: calendarEventResponses.status
        })
        .from(calendarEventResponses)
        .where(
          and(
            inArray(calendarEventResponses.eventId, eventIds),
            eq(calendarEventResponses.userId, userId)
          )
        )
    ]);

  const addInvitee = (eventId: number, invitee: TCalendarInvitee) => {
    const list = invitees.get(eventId) ?? [];

    list.push(invitee);
    invitees.set(eventId, list);
  };

  for (const { eventId, id, name } of userInvitees) {
    addInvitee(eventId, { type: 'user', id, name });
  }

  for (const { eventId, id, name } of roleInvitees) {
    addInvitee(eventId, { type: 'role', id, name });
  }

  for (const { eventId, status, total } of responseCounts) {
    const eventCounts = counts.get(eventId) ?? createEmptyCounts();

    eventCounts[status] = total;
    counts.set(eventId, eventCounts);
  }

  for (const { eventId, status } of ownResponses) {
    own.set(eventId, status);
  }

  return { invitees, counts, own };
};

// an event that has not finished yet is upcoming, so one already running still shows
const upcomingFilter = (from: number) =>
  or(
    gte(calendarEvents.startsAt, from),
    and(isNotNull(calendarEvents.endsAt), gte(calendarEvents.endsAt, from))
  );

const getCalendarEventsPage = async (
  userId: number,
  limit: number,
  cursor?: TCalendarCursor,
  from?: number
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
        from ? upcomingFilter(from) : undefined,
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
  const pageRows = rows.slice(0, limit);
  const { invitees, counts, own } = await getCalendarEventRelations(
    userId,
    pageRows.map((event) => event.id)
  );
  const events = pageRows.map((event): TJoinedCalendarEvent => {
    const isOrganizer = event.creatorId === userId;

    return {
      ...event,
      canDelete: isOrganizer,
      canEdit: isOrganizer,
      invitees: invitees.get(event.id) ?? [],
      responseCounts: counts.get(event.id) ?? createEmptyCounts(),
      ownResponse: own.get(event.id) ?? null
    };
  });
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

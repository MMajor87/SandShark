import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  calendarEventInvitees,
  calendarEvents,
  roles,
  userRoles,
  users
} from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, t } from '../../utils/trpc';

const targetSchema = z.object({
  type: z.enum(['user', 'role']),
  id: z.number().int().positive()
});

const getEventsRoute = protectedProcedure.query(async ({ ctx }) => {
  const memberships = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, ctx.user.id));
  const roleIds = memberships.map((membership) => membership.roleId);

  const directInvites = await db
    .select({ eventId: calendarEventInvitees.eventId })
    .from(calendarEventInvitees)
    .where(eq(calendarEventInvitees.userId, ctx.user.id));
  const roleInvites = roleIds.length
    ? await db
        .select({ eventId: calendarEventInvitees.eventId })
        .from(calendarEventInvitees)
        .where(inArray(calendarEventInvitees.roleId, roleIds))
    : [];

  const visibleIds = new Set([
    ...directInvites.map((invite) => invite.eventId),
    ...roleInvites.map((invite) => invite.eventId)
  ]);
  const invitedEventIds = [...visibleIds];

  const events = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startsAt: calendarEvents.startsAt,
      endsAt: calendarEvents.endsAt,
      creatorId: calendarEvents.creatorId,
      createdAt: calendarEvents.createdAt,
      updatedAt: calendarEvents.updatedAt,
      creatorName: users.name
    })
    .from(calendarEvents)
    .innerJoin(users, eq(calendarEvents.creatorId, users.id))
    .orderBy(calendarEvents.startsAt);

  return events
    .filter(
      (event) =>
        event.creatorId === ctx.user.id || invitedEventIds.includes(event.id)
    )
    .map((event) => ({
      ...event,
      canDelete: event.creatorId === ctx.user.id
    }));
});

const createEventRoute = protectedProcedure
  .input(
    z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2_000).optional(),
      startsAt: z.number().int().positive(),
      endsAt: z.number().int().positive().optional(),
      targets: z.array(targetSchema).min(1).max(100)
    })
  )
  .mutation(async ({ input, ctx }) => {
    invariant(!input.endsAt || input.endsAt > input.startsAt, {
      code: 'BAD_REQUEST',
      message: 'The event end time must be after the start time.'
    });

    const uniqueTargets = Array.from(
      new Map(
        input.targets.map((target) => [`${target.type}:${target.id}`, target])
      ).values()
    );
    const userIds = uniqueTargets
      .filter((target) => target.type === 'user')
      .map((target) => target.id);
    const roleIds = uniqueTargets
      .filter((target) => target.type === 'role')
      .map((target) => target.id);

    if (userIds.length) {
      const foundUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, userIds));
      invariant(foundUsers.length === userIds.length, {
        code: 'NOT_FOUND',
        message: 'One or more invited users no longer exist.'
      });
    }

    if (roleIds.length) {
      const foundRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(inArray(roles.id, roleIds));
      invariant(foundRoles.length === roleIds.length, {
        code: 'NOT_FOUND',
        message: 'One or more invited groups no longer exist.'
      });
    }

    const now = Date.now();
    const event = await db
      .insert(calendarEvents)
      .values({
        title: input.title,
        description: input.description || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt || null,
        creatorId: ctx.user.id,
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .get();

    await db.insert(calendarEventInvitees).values(
      uniqueTargets.map((target) => ({
        eventId: event.id,
        userId: target.type === 'user' ? target.id : null,
        roleId: target.type === 'role' ? target.id : null,
        createdAt: now
      }))
    );

    return event;
  });

const deleteEventRoute = protectedProcedure
  .input(z.object({ eventId: z.number().int().positive() }))
  .mutation(async ({ input, ctx }) => {
    const event = await db
      .select({ creatorId: calendarEvents.creatorId })
      .from(calendarEvents)
      .where(eq(calendarEvents.id, input.eventId))
      .get();

    invariant(event, { code: 'NOT_FOUND', message: 'Event not found.' });
    invariant(event.creatorId === ctx.user.id, {
      code: 'FORBIDDEN',
      message: 'Only the event organizer can delete this event.'
    });

    await db.delete(calendarEvents).where(eq(calendarEvents.id, input.eventId));
  });

export const calendarRouter = t.router({
  getAll: getEventsRoute,
  create: createEventRoute,
  delete: deleteEventRoute
});

import type {
  CalendarResponseStatus,
  TCalendarEventInput,
  TCalendarTarget
} from '@sandshark/shared';
import { eq } from 'drizzle-orm';
import { db } from '..';
import {
  calendarEventInvitees,
  calendarEventResponses,
  calendarEvents
} from '../schema';

type TTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const insertInvitees = (
  tx: TTransaction,
  eventId: number,
  targets: TCalendarTarget[],
  now: number
) =>
  tx
    .insert(calendarEventInvitees)
    .values(
      targets.map((target) => ({
        eventId,
        userId: target.type === 'user' ? target.id : null,
        roleId: target.type === 'role' ? target.id : null,
        createdAt: now
      }))
    )
    .run();

const createCalendarEvent = (creatorId: number, input: TCalendarEventInput) => {
  const now = Date.now();
  return db.transaction((tx) => {
    const event = tx
      .insert(calendarEvents)
      .values({
        title: input.title,
        description: input.description || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        creatorId,
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .get();
    insertInvitees(tx, event.id, input.targets, now);
    return event;
  });
};

// invitees are replaced wholesale. responses stay, the read side only counts the ones
// whose user can still see the event, so re-inviting someone brings their answer back
const updateCalendarEvent = (eventId: number, input: TCalendarEventInput) => {
  const now = Date.now();
  return db.transaction((tx) => {
    const event = tx
      .update(calendarEvents)
      .set({
        title: input.title,
        description: input.description || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        updatedAt: now
      })
      .where(eq(calendarEvents.id, eventId))
      .returning()
      .get();
    tx.delete(calendarEventInvitees)
      .where(eq(calendarEventInvitees.eventId, eventId))
      .run();
    insertInvitees(tx, eventId, input.targets, now);
    return event;
  });
};

const setCalendarEventResponse = (
  eventId: number,
  userId: number,
  status: CalendarResponseStatus
) => {
  const now = Date.now();
  return db
    .insert(calendarEventResponses)
    .values({ eventId, userId, status, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [calendarEventResponses.eventId, calendarEventResponses.userId],
      set: { status, updatedAt: now }
    })
    .run();
};

const deleteCalendarEvent = (eventId: number) =>
  db.delete(calendarEvents).where(eq(calendarEvents.id, eventId)).run();
export {
  createCalendarEvent,
  deleteCalendarEvent,
  setCalendarEventResponse,
  updateCalendarEvent
};

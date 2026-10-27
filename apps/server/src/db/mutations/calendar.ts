import type { TCalendarEventInput } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { db } from '..';
import { calendarEventInvitees, calendarEvents } from '../schema';

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
    tx.insert(calendarEventInvitees)
      .values(
        input.targets.map((target) => ({
          eventId: event.id,
          userId: target.type === 'user' ? target.id : null,
          roleId: target.type === 'role' ? target.id : null,
          createdAt: now
        }))
      )
      .run();
    return event;
  });
};
const deleteCalendarEvent = (eventId: number) =>
  db.delete(calendarEvents).where(eq(calendarEvents.id, eventId)).run();
export { createCalendarEvent, deleteCalendarEvent };

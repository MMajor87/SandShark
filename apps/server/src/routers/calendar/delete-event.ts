import { z } from 'zod';
import { config } from '../../config';
import { deleteCalendarEvent } from '../../db/mutations/calendar';
import { getVisibleCalendarEvent } from '../../db/queries/calendar';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const deleteEventRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.calendarWrite,
  logLabel: 'calendarDelete'
})
  .input(z.object({ eventId: z.number().int().positive() }))
  .mutation(({ ctx, input }) => {
    const event = getVisibleCalendarEvent(ctx.user.id, input.eventId);
    invariant(event, { code: 'NOT_FOUND', message: 'Event not found.' });
    invariant(event.creatorId === ctx.user.id, {
      code: 'FORBIDDEN',
      message: 'Only the event organizer can delete this event.'
    });
    deleteCalendarEvent(event.id);
  });
export { deleteEventRoute };

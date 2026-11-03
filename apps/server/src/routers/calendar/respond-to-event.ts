import { zCalendarResponseStatus } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { setCalendarEventResponse } from '../../db/mutations/calendar';
import { getVisibleCalendarEvent } from '../../db/queries/calendar';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// anyone who can see the event may answer, the organizer included
const respondToEventRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.calendarWrite,
  logLabel: 'calendarRespond'
})
  .input(
    z.object({
      eventId: z.number().int().positive(),
      status: zCalendarResponseStatus
    })
  )
  .mutation(({ ctx, input }) => {
    const event = getVisibleCalendarEvent(ctx.user.id, input.eventId);
    invariant(event, { code: 'NOT_FOUND', message: 'Event not found.' });
    setCalendarEventResponse(event.id, ctx.user.id, input.status);
  });
export { respondToEventRoute };

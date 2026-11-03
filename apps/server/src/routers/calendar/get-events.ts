import {
  CALENDAR_PAGE_SIZE,
  zCalendarCursor,
  zCalendarTime
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { getCalendarEventsPage } from '../../db/queries/calendar';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// calendar access belongs to organizers and invitees, not a global permission.
const getEventsRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.calendarRead,
  logLabel: 'calendarRead'
})
  .input(
    z
      .object({
        cursor: zCalendarCursor.optional(),
        // only events that have not finished by this time, the client passes now
        from: zCalendarTime.optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(CALENDAR_PAGE_SIZE)
          .default(CALENDAR_PAGE_SIZE)
      })
      .default({ limit: CALENDAR_PAGE_SIZE })
  )
  .query(({ ctx, input }) =>
    getCalendarEventsPage(ctx.user.id, input.limit, input.cursor, input.from)
  );
export { getEventsRoute };

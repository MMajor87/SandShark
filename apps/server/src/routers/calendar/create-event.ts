import { zCalendarEventInput } from '@sandshark/shared';
import { config } from '../../config';
import { createCalendarEvent } from '../../db/mutations/calendar';
import { assertCalendarTargets } from '../../helpers/assert-calendar-targets';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// any authenticated member may organize an event, matching the existing policy.
const createEventRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.calendarWrite,
  logLabel: 'calendarCreate'
})
  .input(zCalendarEventInput)
  .mutation(async ({ ctx, input }) => {
    const targets = await assertCalendarTargets(input.targets);
    return createCalendarEvent(ctx.user.id, { ...input, targets });
  });
export { createEventRoute };

import { zCalendarEventUpdateInput } from '@sandshark/shared';
import { config } from '../../config';
import { updateCalendarEvent } from '../../db/mutations/calendar';
import { getVisibleCalendarEvent } from '../../db/queries/calendar';
import { assertCalendarTargets } from '../../helpers/assert-calendar-targets';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const updateEventRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.calendarWrite,
  logLabel: 'calendarUpdate'
})
  .input(zCalendarEventUpdateInput)
  .mutation(async ({ ctx, input }) => {
    const { eventId, ...fields } = input;
    const event = getVisibleCalendarEvent(ctx.user.id, eventId);
    invariant(event, { code: 'NOT_FOUND', message: 'Event not found.' });
    invariant(event.creatorId === ctx.user.id, {
      code: 'FORBIDDEN',
      message: 'Only the event organizer can edit this event.'
    });
    const targets = await assertCalendarTargets(fields.targets);
    return updateCalendarEvent(event.id, { ...fields, targets });
  });
export { updateEventRoute };

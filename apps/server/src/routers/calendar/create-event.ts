import { zCalendarEventInput } from '@sharkord/shared';
import { config } from '../../config';
import { createCalendarEvent } from '../../db/mutations/calendar';
import { getCalendarInviteTargets } from '../../db/queries/calendar';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// any authenticated member may organize an event, matching the existing policy.
const createEventRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.calendarWrite,
  logLabel: 'calendarCreate'
})
  .input(zCalendarEventInput)
  .mutation(async ({ ctx, input }) => {
    const targets = [
      ...new Map(
        input.targets.map((target) => [`${target.type}:${target.id}`, target])
      ).values()
    ];
    const userIds = targets
      .filter((target) => target.type === 'user')
      .map((target) => target.id);
    const roleIds = targets
      .filter((target) => target.type === 'role')
      .map((target) => target.id);
    const { foundUsers, foundRoles } = await getCalendarInviteTargets(
      userIds,
      roleIds
    );
    invariant(foundUsers.length === userIds.length, {
      code: 'NOT_FOUND',
      message: 'One or more invited users no longer exist.'
    });
    invariant(foundRoles.length === roleIds.length, {
      code: 'NOT_FOUND',
      message: 'One or more invited groups no longer exist.'
    });
    return createCalendarEvent(ctx.user.id, { ...input, targets });
  });
export { createEventRoute };

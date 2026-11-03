import type { TCalendarTarget } from '@sandshark/shared';
import { getCalendarInviteTargets } from '../db/queries/calendar';
import { invariant } from '../utils/invariant';

// dedupes the invitations and proves every one of them still exists, shared by create
// and update so an edit cannot invite someone a new event could not
const assertCalendarTargets = async (targets: TCalendarTarget[]) => {
  const uniqueTargets = [
    ...new Map(
      targets.map((target) => [`${target.type}:${target.id}`, target])
    ).values()
  ];
  const userIds = uniqueTargets
    .filter((target) => target.type === 'user')
    .map((target) => target.id);
  const roleIds = uniqueTargets
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
  return uniqueTargets;
};

export { assertCalendarTargets };

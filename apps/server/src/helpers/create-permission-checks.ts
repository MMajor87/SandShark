import {
  OWNER_ROLE_ID,
  type ChannelPermission,
  type Permission
} from '@sandshark/shared';
import { channelUserCan } from '../db/queries/channels';
import { getUserRoles } from '../db/queries/roles';
import { getUserById } from '../db/queries/users';
import { invariant } from '../utils/invariant';

// the permission half of a trpc context, shared by websocket sessions and bot requests so
// a bot is checked exactly the way a member with the same roles is. roles are read on
// every call, so a role change applies to the next request without a reconnect
const createPermissionChecks = (userId: number) => {
  const hasPermission = async (targetPermission: Permission | Permission[]) => {
    const user = await getUserById(userId);

    if (!user) return false;

    const roles = await getUserRoles(user.id);

    // owner always has all permissions
    if (roles.some((r) => r.id === OWNER_ROLE_ID)) return true;

    const permissionsSet = new Set<Permission>();

    for (const role of roles) {
      for (const permission of role.permissions) {
        permissionsSet.add(permission);
      }
    }

    if (Array.isArray(targetPermission)) {
      return targetPermission.every((p) => permissionsSet.has(p));
    }

    return permissionsSet.has(targetPermission);
  };

  const hasChannelPermission = async (
    channelId: number,
    targetPermission: ChannelPermission
  ) => channelUserCan(channelId, userId, targetPermission);

  const needsPermission = async (
    targetPermission: Permission | Permission[]
  ) => {
    invariant(await hasPermission(targetPermission), {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions'
    });
  };

  const needsChannelPermission = async (
    channelId: number,
    targetPermission: ChannelPermission
  ) => {
    invariant(await hasChannelPermission(channelId, targetPermission), {
      code: 'FORBIDDEN',
      message: 'Insufficient channel permissions'
    });
  };

  return {
    hasPermission,
    needsPermission,
    hasChannelPermission,
    needsChannelPermission
  };
};

export { createPermissionChecks };

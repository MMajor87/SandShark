import type { TJoinedPublicUser } from '@sandshark/shared';
import { roleSnowflake, type TGuildContext } from './guild';
import { serializeUser } from './user';

// sandshark has no separate join date, the account creation stands in for it
const serializeMember = (user: TJoinedPublicUser, guild: TGuildContext) => {
  const rolesById = new Map(guild.roles.map((role) => [role.id, role]));
  const roles = user.roleIds
    .map((roleId) => rolesById.get(roleId))
    .filter((role) => role !== undefined)
    .map(roleSnowflake);

  return {
    user: serializeUser(user),
    nick: null,
    avatar: null,
    roles,
    joined_at: new Date(user.createdAt).toISOString(),
    premium_since: null,
    deaf: false,
    mute: false,
    flags: 0,
    pending: false,
    communication_disabled_until: null
  };
};

export { serializeMember };

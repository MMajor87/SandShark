import { OWNER_ROLE_ID, type TJoinedPublicUser } from '@sandshark/shared';
import { roleSnowflake, type TGuildContext } from './guild';
import { DiscordPermission, toDiscordPermissions } from './permissions';
import { serializeUser } from './user';

// the union of the member's roles, plus the default role every member holds implicitly,
// as discord's member permission bitfield. channel overrides are not applied, as
// everywhere else in the bot api
const memberPermissionBits = (
  user: Pick<TJoinedPublicUser, 'roleIds'>,
  guild: TGuildContext
) => {
  const held = new Set(user.roleIds);
  let bits = 0n;

  for (const role of guild.roles) {
    if (!role.isDefault && !held.has(role.id)) continue;

    bits |= BigInt(
      toDiscordPermissions(role.permissions, {
        isOwner: role.id === OWNER_ROLE_ID,
        isEveryone: role.isDefault
      })
    );
  }

  return bits;
};

const isAdministrator = (bits: bigint) =>
  (bits & DiscordPermission.ADMINISTRATOR) === DiscordPermission.ADMINISTRATOR;

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

export { isAdministrator, memberPermissionBits, serializeMember };

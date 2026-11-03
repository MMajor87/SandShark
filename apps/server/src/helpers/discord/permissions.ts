import { Permission } from '@sandshark/shared';

// discord permission bits, as documented for api v10
const DiscordPermission = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MOVE_MEMBERS: 1n << 24n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_GUILD_EXPRESSIONS: 1n << 30n,
  MODERATE_MEMBERS: 1n << 40n,
  USE_SOUNDBOARD: 1n << 42n,
  PIN_MESSAGES: 1n << 51n
} as const;

// bits with no sandshark equivalent are never set. viewing and history are not role
// permissions here, a channel the bot cannot see is simply never returned to it
const PERMISSION_BITS: Partial<Record<Permission, bigint>> = {
  [Permission.SEND_MESSAGES]: DiscordPermission.SEND_MESSAGES,
  [Permission.REACT_TO_MESSAGES]: DiscordPermission.ADD_REACTIONS,
  [Permission.PIN_MESSAGES]: DiscordPermission.PIN_MESSAGES,
  [Permission.UPLOAD_FILES]: DiscordPermission.ATTACH_FILES,
  [Permission.JOIN_VOICE_CHANNELS]:
    DiscordPermission.CONNECT | DiscordPermission.SPEAK,
  [Permission.SHARE_SCREEN]: DiscordPermission.STREAM,
  [Permission.USE_SOUNDBOARD]: DiscordPermission.USE_SOUNDBOARD,
  [Permission.MANAGE_CHANNELS]: DiscordPermission.MANAGE_CHANNELS,
  [Permission.MANAGE_ROLES]: DiscordPermission.MANAGE_ROLES,
  [Permission.MANAGE_EMOJIS]: DiscordPermission.MANAGE_GUILD_EXPRESSIONS,
  [Permission.MANAGE_SETTINGS]: DiscordPermission.MANAGE_GUILD,
  [Permission.MANAGE_USERS]:
    DiscordPermission.KICK_MEMBERS |
    DiscordPermission.BAN_MEMBERS |
    DiscordPermission.MODERATE_MEMBERS,
  [Permission.MOVE_MEMBERS]: DiscordPermission.MOVE_MEMBERS,
  [Permission.MANAGE_MESSAGES]: DiscordPermission.MANAGE_MESSAGES,
  [Permission.MANAGE_INVITES]: DiscordPermission.CREATE_INSTANT_INVITE
};

const EVERYONE_BASE_BITS =
  DiscordPermission.VIEW_CHANNEL | DiscordPermission.READ_MESSAGE_HISTORY;

const ALL_MAPPED_BITS = Object.values(PERMISSION_BITS).reduce(
  (bits, bit) => bits | (bit ?? 0n),
  EVERYONE_BASE_BITS
);

const toDiscordPermissions = (
  permissions: Permission[],
  { isOwner = false, isEveryone = false } = {}
) => {
  if (isOwner) {
    return (ALL_MAPPED_BITS | DiscordPermission.ADMINISTRATOR).toString();
  }

  let bits = isEveryone ? EVERYONE_BASE_BITS : 0n;

  for (const permission of permissions) {
    bits |= PERMISSION_BITS[permission] ?? 0n;
  }

  return bits.toString();
};

export { DiscordPermission, toDiscordPermissions };

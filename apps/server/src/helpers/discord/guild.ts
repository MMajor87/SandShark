import { OWNER_ROLE_ID, type TJoinedRole } from '@sandshark/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { getRoles } from '../../db/queries/roles';
import { getSettings } from '../../db/queries/server';
import { userRoles, users } from '../../db/schema';
import { toDiscordPermissions } from './permissions';
import { encodeSnowflake, SnowflakeTag } from './snowflake';
import { hexToColor, userSnowflake } from './user';

// a sandshark server is exactly one guild. its id comes from the owner role, which can
// never be deleted, so the guild id is stable for the life of the server
const getGuildContext = async () => {
  const [settings, roles, owner] = await Promise.all([
    getSettings(),
    getRoles(),
    db
      .select({ id: users.id, createdAt: users.createdAt })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(eq(userRoles.roleId, OWNER_ROLE_ID))
      .limit(1)
      .get()
  ]);
  const ownerRole = roles.find((role) => role.id === OWNER_ROLE_ID);
  const guildId = encodeSnowflake(
    SnowflakeTag.GUILD,
    0,
    ownerRole?.createdAt ?? 0
  );

  return { settings, roles, owner, guildId };
};

type TGuildContext = Awaited<ReturnType<typeof getGuildContext>>;

const roleSnowflake = (role: Pick<TJoinedRole, 'id' | 'createdAt'>) =>
  encodeSnowflake(SnowflakeTag.ROLE, role.id, role.createdAt);

// discord.js finds @everyone as the role whose id is the guild id, so one is synthesised
// with the permissions of the default role. the default role is still listed as itself,
// since members hold it by id
const serializeRoles = ({ roles, guildId }: TGuildContext) => {
  const defaultRole = roles.find((role) => role.isDefault);
  const everyone = {
    id: guildId,
    name: '@everyone',
    color: 0,
    hoist: false,
    icon: null,
    unicode_emoji: null,
    position: 0,
    permissions: toDiscordPermissions(defaultRole?.permissions ?? [], {
      isEveryone: true
    }),
    managed: false,
    mentionable: false,
    flags: 0
  };

  // roles have no order of their own, so newer roles sit lower and the owner role on top
  const listed = [...roles]
    .sort((a, b) => b.id - a.id)
    .map((role, index) => ({
      id: roleSnowflake(role),
      name: role.name,
      color: hexToColor(role.color),
      hoist: false,
      icon: null,
      unicode_emoji: null,
      position: index + 1,
      permissions: toDiscordPermissions(role.permissions, {
        isOwner: role.id === OWNER_ROLE_ID
      }),
      managed: false,
      mentionable: true,
      flags: 0
    }));

  return [everyone, ...listed];
};

const serializeGuild = (guild: TGuildContext) => ({
  id: guild.guildId,
  name: guild.settings.name,
  description: guild.settings.description,
  icon: null,
  splash: null,
  banner: null,
  owner_id: guild.owner ? userSnowflake(guild.owner) : null,
  roles: serializeRoles(guild),
  emojis: [],
  stickers: [],
  features: [],
  verification_level: 0,
  default_message_notifications: 1,
  explicit_content_filter: 0,
  mfa_level: 0,
  nsfw_level: 0,
  premium_tier: 0,
  premium_subscription_count: 0,
  preferred_locale: 'en-US',
  afk_channel_id: null,
  afk_timeout: 300,
  system_channel_id: null,
  system_channel_flags: 0,
  rules_channel_id: null,
  public_updates_channel_id: null,
  max_members: 500_000,
  vanity_url_code: null
});

export {
  getGuildContext,
  roleSnowflake,
  serializeGuild,
  serializeRoles,
  type TGuildContext
};

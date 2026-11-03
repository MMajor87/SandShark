import { UserStatus, type TJoinedUser } from '@sandshark/shared';
import { db } from '../../../db';
import { getChannelsForUser } from '../../../db/queries/channels';
import { categories } from '../../../db/schema';
import {
  serializeCategory,
  serializeGuildChannel
} from '../../../helpers/discord/channel';
import {
  serializeGuild,
  type TGuildContext
} from '../../../helpers/discord/guild';
import { serializeMember } from '../../../helpers/discord/member';
import { serializeUser, userSnowflake } from '../../../helpers/discord/user';
import { getUserStatus } from '../../../utils/wss';
import { getGuildMembers } from '../helpers';

const buildReady = (
  bot: TJoinedUser,
  guildId: string,
  sessionId: string,
  resumeUrl: string
) => {
  const user = serializeUser(bot);

  return {
    v: 10,
    user: { ...user, verified: true, mfa_enabled: false },
    guilds: [{ id: guildId, unavailable: true }],
    session_id: sessionId,
    resume_gateway_url: resumeUrl,
    shard: [0, 1],
    application: { id: user.id, flags: 0 },
    user_settings: {},
    relationships: [],
    private_channels: [],
    presences: []
  };
};

const presenceOf = (
  userId: string,
  guildId: string,
  status: 'online' | 'offline'
) => ({
  user: { id: userId },
  guild_id: guildId,
  status,
  activities: [],
  client_status: status === 'online' ? { desktop: 'online' } : {}
});

// the snowflakes the session hands out, kept so a later delete event that only carries
// a row id can still be described the way discord describes it
type TKnownObjects = {
  channels: Map<number, Record<string, unknown>>;
  members: Map<number, ReturnType<typeof serializeUser>>;
};

const buildGuildCreate = async (bot: TJoinedUser, guild: TGuildContext) => {
  const [allCategories, visibleChannels, members] = await Promise.all([
    db.select().from(categories),
    getChannelsForUser(bot.id),
    getGuildMembers()
  ]);
  const categoriesById = new Map(
    allCategories.map((category) => [category.id, category])
  );
  const guildChannels = visibleChannels.filter((channel) => !channel.isDm);
  const known: TKnownObjects = { channels: new Map(), members: new Map() };

  const channelPayloads = [
    ...allCategories.map((category) =>
      serializeCategory(category, guild.guildId)
    ),
    ...guildChannels.map((channel) => {
      const payload = serializeGuildChannel(
        channel,
        guild.guildId,
        categoriesById
      );

      known.channels.set(channel.id, payload);

      return payload;
    })
  ];

  const memberPayloads = members.map((member) => {
    const payload = serializeMember(member, guild);

    known.members.set(member.id, payload.user);

    return payload;
  });

  const presences = members
    .filter((member) => getUserStatus(member.id) === UserStatus.ONLINE)
    .map((member) =>
      presenceOf(userSnowflake(member), guild.guildId, 'online')
    );

  return {
    known,
    payload: {
      ...serializeGuild(guild),
      joined_at: new Date(bot.createdAt).toISOString(),
      large: false,
      unavailable: false,
      member_count: members.length,
      voice_states: [],
      members: memberPayloads,
      channels: channelPayloads,
      threads: [],
      presences,
      stage_instances: [],
      guild_scheduled_events: [],
      soundboard_sounds: []
    }
  };
};

export { buildGuildCreate, buildReady, presenceOf, type TKnownObjects };

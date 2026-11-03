import { ChannelType, type TCategory, type TChannel } from '@sandshark/shared';
import { encodeSnowflake, SnowflakeTag } from './snowflake';
import { serializeUser, type TDiscordUserSource } from './user';

const DiscordChannelType = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GUILD_CATEGORY: 4
} as const;

const channelSnowflake = (channel: Pick<TChannel, 'id' | 'createdAt'>) =>
  encodeSnowflake(SnowflakeTag.CHANNEL, channel.id, channel.createdAt);

const categorySnowflake = (category: Pick<TCategory, 'id' | 'createdAt'>) =>
  encodeSnowflake(SnowflakeTag.CATEGORY, category.id, category.createdAt);

// overwrites stay empty: a channel the bot may not see is never returned to it at all
const serializeGuildChannel = (
  channel: TChannel,
  guildId: string,
  categoriesById: Map<number, TCategory>
) => {
  let parentId: string | null = null;

  if (channel.categoryId !== null) {
    const category = categoriesById.get(channel.categoryId);

    parentId = category ? categorySnowflake(category) : null;
  }

  const base = {
    id: channelSnowflake(channel),
    guild_id: guildId,
    name: channel.name,
    position: channel.position,
    parent_id: parentId,
    permission_overwrites: [],
    nsfw: false,
    flags: 0
  };

  if (channel.type === ChannelType.VOICE) {
    return {
      ...base,
      type: DiscordChannelType.GUILD_VOICE,
      bitrate: 64_000,
      user_limit: 0,
      rtc_region: null
    };
  }

  return {
    ...base,
    type: DiscordChannelType.GUILD_TEXT,
    topic: channel.topic,
    rate_limit_per_user: 0,
    last_message_id: null
  };
};

const serializeCategory = (category: TCategory, guildId: string) => ({
  id: categorySnowflake(category),
  type: DiscordChannelType.GUILD_CATEGORY,
  guild_id: guildId,
  name: category.name,
  position: category.position,
  parent_id: null,
  permission_overwrites: [],
  nsfw: false,
  flags: 0
});

const serializeDmChannel = (
  channel: TChannel,
  recipient: TDiscordUserSource | undefined
) => ({
  id: channelSnowflake(channel),
  type: DiscordChannelType.DM,
  last_message_id: null,
  flags: 0,
  recipients: recipient ? [serializeUser(recipient)] : []
});

export {
  categorySnowflake,
  channelSnowflake,
  DiscordChannelType,
  serializeCategory,
  serializeDmChannel,
  serializeGuildChannel
};

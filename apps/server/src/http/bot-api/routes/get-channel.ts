import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { getChannelsForUser } from '../../../db/queries/channels';
import { getDirectMessageConversations } from '../../../db/queries/dms';
import { getPublicUserById } from '../../../db/queries/users';
import { categories } from '../../../db/schema';
import {
  serializeCategory,
  serializeDmChannel,
  serializeGuildChannel
} from '../../../helpers/discord/channel';
import { getGuildContext } from '../../../helpers/discord/guild';
import {
  resolveCategorySnowflake,
  resolveChannelSnowflake
} from '../../../helpers/discord/resolve';
import { DiscordErrorCode, notFound } from '../errors';
import type { TBotRouteHandler } from '../types';

const unknownChannel = () =>
  notFound(DiscordErrorCode.UNKNOWN_CHANNEL, 'Channel');

// a channel the bot cannot see reads as unknown, never as forbidden, so a probe cannot
// tell a hidden channel from one that does not exist
const getChannelRoute: TBotRouteHandler = async ({ bot, params }) => {
  const channelParam = params.channelId!;
  const [channelId, categoryId, guild] = await Promise.all([
    resolveChannelSnowflake(channelParam),
    resolveCategorySnowflake(channelParam),
    getGuildContext()
  ]);

  if (categoryId !== undefined) {
    const category = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1)
      .get();

    if (!category) throw unknownChannel();

    return serializeCategory(category, guild.guildId);
  }

  if (channelId === undefined) throw unknownChannel();

  const visibleChannels = await getChannelsForUser(bot.id);
  const channel = visibleChannels.find(({ id }) => id === channelId);

  if (!channel) throw unknownChannel();

  if (channel.isDm) {
    const [conversation] = await getDirectMessageConversations(
      bot.id,
      channel.id
    );
    const recipient = conversation
      ? await getPublicUserById(conversation.userId)
      : undefined;

    return serializeDmChannel(channel, recipient);
  }

  const allCategories = await db.select().from(categories);
  const categoriesById = new Map(
    allCategories.map((category) => [category.id, category])
  );

  return serializeGuildChannel(channel, guild.guildId, categoriesById);
};

export { getChannelRoute };

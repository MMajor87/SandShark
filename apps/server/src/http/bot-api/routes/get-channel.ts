import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { getDirectMessageConversations } from '../../../db/queries/dms';
import { getPublicUserById } from '../../../db/queries/users';
import { categories } from '../../../db/schema';
import {
  serializeCategory,
  serializeDmChannel,
  serializeGuildChannel
} from '../../../helpers/discord/channel';
import { getGuildContext } from '../../../helpers/discord/guild';
import { resolveCategorySnowflake } from '../../../helpers/discord/resolve';
import { DiscordErrorCode, notFound } from '../errors';
import { loadVisibleChannel } from '../helpers';
import type { TBotRouteHandler } from '../types';

const unknownChannel = () =>
  notFound(DiscordErrorCode.UNKNOWN_CHANNEL, 'Channel');

const getChannelRoute: TBotRouteHandler = async ({ bot, params }) => {
  const channelParam = params.channelId!;
  const [categoryId, guild] = await Promise.all([
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

  const channel = await loadVisibleChannel(bot.id, channelParam);

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

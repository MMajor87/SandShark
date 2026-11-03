import { db } from '../../../db';
import { getChannelsForUser } from '../../../db/queries/channels';
import { categories } from '../../../db/schema';
import {
  serializeCategory,
  serializeGuildChannel
} from '../../../helpers/discord/channel';
import { loadGuild } from '../helpers';
import type { TBotRouteHandler } from '../types';

// the same channel list a member with the bot's roles gets on join, minus its dms, which
// discord never lists under a guild
const getGuildChannelsRoute: TBotRouteHandler = async ({ bot, params }) => {
  const guild = await loadGuild(params.guildId);
  const [allCategories, visibleChannels] = await Promise.all([
    db.select().from(categories),
    getChannelsForUser(bot.id)
  ]);
  const categoriesById = new Map(
    allCategories.map((category) => [category.id, category])
  );

  return [
    ...allCategories.map((category) =>
      serializeCategory(category, guild.guildId)
    ),
    ...visibleChannels
      .filter((channel) => !channel.isDm)
      .map((channel) =>
        serializeGuildChannel(channel, guild.guildId, categoriesById)
      )
  ];
};

export { getGuildChannelsRoute };

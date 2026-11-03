import { serializeGuild } from '../../../helpers/discord/guild';
import { loadGuild } from '../helpers';
import type { TBotRouteHandler } from '../types';

const getGuildRoute: TBotRouteHandler = async ({ params }) => {
  const guild = await loadGuild(params.guildId);

  return serializeGuild(guild);
};

export { getGuildRoute };

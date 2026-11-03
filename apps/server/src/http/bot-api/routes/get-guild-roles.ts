import { serializeRoles } from '../../../helpers/discord/guild';
import { loadGuild } from '../helpers';
import type { TBotRouteHandler } from '../types';

const getGuildRolesRoute: TBotRouteHandler = async ({ params }) => {
  const guild = await loadGuild(params.guildId);

  return serializeRoles(guild);
};

export { getGuildRolesRoute };

import { serializeMember } from '../../../helpers/discord/member';
import { resolveUserSnowflake } from '../../../helpers/discord/resolve';
import { DiscordErrorCode, notFound } from '../errors';
import { getGuildMembers, loadGuild } from '../helpers';
import type { TBotRouteHandler } from '../types';

const getGuildMemberRoute: TBotRouteHandler = async ({ params }) => {
  const guild = await loadGuild(params.guildId);
  const userId = await resolveUserSnowflake(params.userId!);
  const members = await getGuildMembers();
  const member = members.find(({ id }) => id === userId);

  if (!member) {
    throw notFound(DiscordErrorCode.UNKNOWN_MEMBER, 'Member');
  }

  return serializeMember(member, guild);
};

export { getGuildMemberRoute };

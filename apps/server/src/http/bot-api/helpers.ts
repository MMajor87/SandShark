import { DELETED_USER_IDENTITY_AND_NAME } from '@sandshark/shared';
import { getPublicUsers } from '../../db/queries/users';
import { getGuildContext } from '../../helpers/discord/guild';
import { DiscordErrorCode, notFound } from './errors';

// every guild route names the guild, and there is only the one
const loadGuild = async (guildId: string | undefined) => {
  const guild = await getGuildContext();

  if (guildId !== guild.guildId) {
    throw notFound(DiscordErrorCode.UNKNOWN_GUILD, 'Guild');
  }

  return guild;
};

// the deleted user placeholder and banned accounts are not members in discord terms
const getGuildMembers = async () => {
  const users = await getPublicUsers();

  return users
    .filter(
      (user) => !user.banned && user.name !== DELETED_USER_IDENTITY_AND_NAME
    )
    .sort((a, b) => a.id - b.id);
};

export { getGuildMembers, loadGuild };

import { getPublicUserById } from '../../../db/queries/users';
import { resolveUserSnowflake } from '../../../helpers/discord/resolve';
import { serializeUser } from '../../../helpers/discord/user';
import { DiscordErrorCode, notFound } from '../errors';
import type { TBotRouteHandler } from '../types';

// every member can see every other member in sandshark, so any existing user is visible
const getUserRoute: TBotRouteHandler = async ({ params }) => {
  const userId = await resolveUserSnowflake(params.userId!);
  const user =
    userId === undefined ? undefined : await getPublicUserById(userId);

  if (!user) {
    throw notFound(DiscordErrorCode.UNKNOWN_USER, 'User');
  }

  return serializeUser(user);
};

export { getUserRoute };

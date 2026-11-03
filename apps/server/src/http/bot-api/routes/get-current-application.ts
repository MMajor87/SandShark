import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { getPublicUserById } from '../../../db/queries/users';
import { bots } from '../../../db/schema';
import { getGuildContext } from '../../../helpers/discord/guild';
import { serializeUser } from '../../../helpers/discord/user';
import type { TBotRouteHandler } from '../types';

// a bot here is its own application, owned by the member who created it, or the server
// owner when that member is gone. discord.py asks for this on every login
const getCurrentApplicationRoute: TBotRouteHandler = async ({ bot }) => {
  const row = await db
    .select({ createdBy: bots.createdBy })
    .from(bots)
    .where(eq(bots.userId, bot.id))
    .limit(1)
    .get();
  const guild = await getGuildContext();
  const ownerId = row?.createdBy ?? (guild.owner ? guild.owner.id : undefined);
  const owner =
    ownerId === undefined ? undefined : await getPublicUserById(ownerId);
  const botUser = serializeUser(bot);

  return {
    id: botUser.id,
    name: bot.name,
    description: '',
    icon: null,
    bot_public: false,
    bot_require_code_grant: false,
    owner: owner ? serializeUser(owner) : botUser,
    team: null,
    verify_key: '',
    flags: 0,
    summary: '',
    bot: botUser
  };
};

export { getCurrentApplicationRoute };

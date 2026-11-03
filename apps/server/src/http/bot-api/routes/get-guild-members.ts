import { z } from 'zod';
import { serializeMember } from '../../../helpers/discord/member';
import { userSnowflake } from '../../../helpers/discord/user';
import { DiscordApiError, DiscordErrorCode } from '../errors';
import { getGuildMembers, loadGuild } from '../helpers';
import type { TBotRouteHandler } from '../types';

const zMembersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(1),
  after: z
    .string()
    .regex(/^\d{1,20}$/)
    .default('0')
});

// discord pages members by user id, so the cursor compares snowflakes, not row ids
const getGuildMembersRoute: TBotRouteHandler = async ({ params, url }) => {
  const query = zMembersQuery.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    after: url.searchParams.get('after') ?? undefined
  });

  if (!query.success) {
    throw new DiscordApiError(
      400,
      DiscordErrorCode.INVALID_FORM_BODY,
      'Invalid Form Body'
    );
  }

  const guild = await loadGuild(params.guildId);
  const members = await getGuildMembers();
  const after = BigInt(query.data.after);

  return members
    .map((member) => ({ member, snowflake: BigInt(userSnowflake(member)) }))
    .filter(({ snowflake }) => snowflake > after)
    .sort((a, b) => (a.snowflake < b.snowflake ? -1 : 1))
    .slice(0, query.data.limit)
    .map(({ member }) => serializeMember(member, guild));
};

export { getGuildMembersRoute };

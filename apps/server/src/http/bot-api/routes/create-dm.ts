import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { getPublicUserById } from '../../../db/queries/users';
import { channels } from '../../../db/schema';
import { serializeDmChannel } from '../../../helpers/discord/channel';
import { resolveUserSnowflake } from '../../../helpers/discord/resolve';
import { callProcedure } from '../call-procedure';
import { createBotCaller } from '../context';
import { DiscordErrorCode, notFound } from '../errors';
import { invalidFormBody, readJsonBody } from '../helpers';
import type { TBotRouteHandler } from '../types';

const zCreateDm = z.object({
  recipient_id: z.string().regex(/^\d{1,20}$/)
});

// opening a dm goes through the same procedure a member uses, so the server's direct
// messages setting and every other check apply to bots too
const createDmRoute: TBotRouteHandler = async ({ bot, info, req }) => {
  const parsed = zCreateDm.safeParse(await readJsonBody(req));

  if (!parsed.success) throw invalidFormBody();

  const userId = await resolveUserSnowflake(parsed.data.recipient_id);

  if (userId === undefined) {
    throw notFound(DiscordErrorCode.UNKNOWN_USER, 'User');
  }

  const caller = createBotCaller(bot, info);
  const { channelId } = await callProcedure(() => caller.dms.open({ userId }), {
    code: DiscordErrorCode.UNKNOWN_USER,
    what: 'User'
  });
  const [channel, recipient] = await Promise.all([
    db.select().from(channels).where(eq(channels.id, channelId)).limit(1).get(),
    getPublicUserById(userId)
  ]);

  if (!channel) {
    throw notFound(DiscordErrorCode.UNKNOWN_CHANNEL, 'Channel');
  }

  return serializeDmChannel(channel, recipient);
};

export { createDmRoute };

import { Permission, zUserName } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { getBotById } from '../../db/queries/bots';
import { renameBot } from '../../helpers/bots';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const renameBotRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'renameBot'
})
  .input(z.object({ botId: z.number().int().positive(), name: zUserName }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_BOTS);

    const bot = await getBotById(input.botId);

    invariant(bot, { code: 'NOT_FOUND', message: 'Bot not found.' });

    await renameBot(bot, input.name, ctx.user.id);
  });

export { renameBotRoute };

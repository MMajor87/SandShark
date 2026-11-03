import { Permission } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { getBotById } from '../../db/queries/bots';
import { resetBotToken } from '../../helpers/bots';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const resetBotTokenRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'resetBotToken'
})
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_BOTS);

    const bot = await getBotById(input.botId);

    invariant(bot, { code: 'NOT_FOUND', message: 'Bot not found.' });

    return resetBotToken(bot, ctx.user.id);
  });

export { resetBotTokenRoute };

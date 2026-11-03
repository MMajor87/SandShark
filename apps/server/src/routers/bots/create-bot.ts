import { Permission, zUserName } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { createBot } from '../../helpers/bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// the token is only ever returned here and by a reset, it is stored hashed
const createBotRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'createBot'
})
  .input(z.object({ name: zUserName }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_BOTS);

    return createBot(input.name, ctx.user.id);
  });

export { createBotRoute };

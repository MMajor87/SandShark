import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { restartHostedBot } from '../../helpers/hosted-bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const restartHostedRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'restartHosted'
})
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await restartHostedBot(bot, ctx.userId);
  });

export { restartHostedRoute };

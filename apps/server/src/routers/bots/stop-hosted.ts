import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { stopHostedBot } from '../../helpers/hosted-bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const stopHostedRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'stopHosted'
})
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    await assertHostedBotAccess(ctx, input.botId);
    await stopHostedBot(input.botId);
  });

export { stopHostedRoute };

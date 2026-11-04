import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { startHostedBot } from '../../helpers/hosted-bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const startHostedRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'startHosted'
})
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    await assertHostedBotAccess(ctx, input.botId);
    await startHostedBot(input.botId);
  });

export { startHostedRoute };

import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { installHostedBotDependencies } from '../../helpers/hosted-bot-code';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const installHostedDependenciesRoute = rateLimitedProcedure(
  protectedProcedure,
  {
    maxRequests: config.rateLimiters.adminCreate.maxRequests,
    windowMs: config.rateLimiters.adminCreate.windowMs,
    logLabel: 'installHostedDependencies'
  }
)
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    await assertHostedBotAccess(ctx, input.botId);
    await installHostedBotDependencies(input.botId);
  });

export { installHostedDependenciesRoute };

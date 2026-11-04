import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { updateHostedBotFromGithub } from '../../helpers/hosted-bot-code';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const updateHostedCodeRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'updateHostedCode'
})
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await updateHostedBotFromGithub(bot, ctx.userId);
  });

export { updateHostedCodeRoute };

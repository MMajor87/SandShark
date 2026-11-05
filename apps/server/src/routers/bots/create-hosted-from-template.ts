import { HostedBotTemplate } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { writeHostedBotTemplate } from '../../helpers/hosted-bot-code';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const createHostedFromTemplateRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'createHostedFromTemplate'
})
  .input(
    z.object({
      botId: z.number().int().positive(),
      template: z.enum(HostedBotTemplate)
    })
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await writeHostedBotTemplate(bot, ctx.userId, input.template);
  });

export { createHostedFromTemplateRoute };

import { HostedBotJsRuntime } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { setHostedBotJsRuntime } from '../../helpers/hosted-bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// bun or node for a javascript bot. a python bot always runs on python
const setHostedJsRuntimeRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'setHostedJsRuntime'
})
  .input(
    z.object({
      botId: z.number().int().positive(),
      jsRuntime: z.enum(HostedBotJsRuntime)
    })
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await setHostedBotJsRuntime(bot, ctx.userId, input.jsRuntime);
  });

export { setHostedJsRuntimeRoute };

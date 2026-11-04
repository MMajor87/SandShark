import {
  HOSTED_BOT_GITHUB_REF_REGEX,
  HOSTED_BOT_GITHUB_URL_REGEX
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { setHostedBotGithubSource } from '../../helpers/hosted-bot-code';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// points the bot at a public github repository. the code is fetched by updateHostedCode
const setHostedSourceRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'setHostedSource'
})
  .input(
    z.object({
      botId: z.number().int().positive(),
      url: z.string().max(512).regex(HOSTED_BOT_GITHUB_URL_REGEX, {
        message: 'This is not a GitHub repository address.'
      }),
      ref: z
        .string()
        .regex(HOSTED_BOT_GITHUB_REF_REGEX, {
          message: 'This is not a branch, tag or commit name.'
        })
        .nullable()
    })
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await setHostedBotGithubSource(bot, ctx.userId, input.url, input.ref);
  });

export { setHostedSourceRoute };

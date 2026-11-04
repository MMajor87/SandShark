import {
  HOSTED_BOT_ENV_NAME_REGEX,
  HOSTED_BOT_MAX_TOKEN_ENV_NAMES
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { RESERVED_ENV_NAMES } from '../../helpers/hosted-bot-env';
import { setHostedBotTokenEnvNames } from '../../helpers/hosted-bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// names the bot reads its token from besides the usual ones
const setHostedTokenEnvNamesRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'setHostedTokenEnvNames'
})
  .input(
    z.object({
      botId: z.number().int().positive(),
      names: z
        .array(
          z
            .string()
            .regex(HOSTED_BOT_ENV_NAME_REGEX)
            .refine((name) => !RESERVED_ENV_NAMES.includes(name), {
              message: 'This variable is set by the server.'
            })
        )
        .max(HOSTED_BOT_MAX_TOKEN_ENV_NAMES)
    })
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await setHostedBotTokenEnvNames(bot, ctx.userId, input.names);
  });

export { setHostedTokenEnvNamesRoute };

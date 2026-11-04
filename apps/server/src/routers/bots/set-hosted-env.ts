import {
  HOSTED_BOT_ENV_NAME_REGEX,
  HOSTED_BOT_MAX_ENV_VALUE_LENGTH
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { RESERVED_ENV_NAMES } from '../../helpers/hosted-bot-env';
import { setHostedBotEnvVar } from '../../helpers/hosted-bots';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// one variable at a time, since the client never holds the values it would need to send
// the whole set back. null removes it
const setHostedEnvRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'setHostedEnv'
})
  .input(
    z.object({
      botId: z.number().int().positive(),
      name: z
        .string()
        .regex(HOSTED_BOT_ENV_NAME_REGEX)
        .refine((name) => !RESERVED_ENV_NAMES.includes(name), {
          message: 'This variable is set by the server.'
        }),
      value: z.string().max(HOSTED_BOT_MAX_ENV_VALUE_LENGTH).nullable()
    })
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    await setHostedBotEnvVar(bot, ctx.userId, input.name, input.value);
  });

export { setHostedEnvRoute };

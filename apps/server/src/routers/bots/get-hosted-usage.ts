import { z } from 'zod';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { HostedBotRuntime } from '../../runtimes/hosted-bot';
import { protectedProcedure } from '../../utils/trpc';

const getHostedUsageRoute = protectedProcedure
  .input(z.object({ botId: z.number().int().positive() }))
  .query(async ({ ctx, input }) => {
    await assertHostedBotAccess(ctx, input.botId);

    return HostedBotRuntime.getUsage(input.botId);
  });

export { getHostedUsageRoute };

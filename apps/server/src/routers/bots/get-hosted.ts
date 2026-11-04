import { z } from 'zod';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { getHostedBotView } from '../../helpers/hosted-bots';
import { protectedProcedure } from '../../utils/trpc';

const getHostedRoute = protectedProcedure
  .input(z.object({ botId: z.number().int().positive() }))
  .query(async ({ ctx, input }) => {
    await assertHostedBotAccess(ctx, input.botId);

    return getHostedBotView(input.botId);
  });

export { getHostedRoute };

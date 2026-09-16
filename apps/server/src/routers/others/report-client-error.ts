import { z } from 'zod';
import { config } from '../../config';
import { logger } from '../../logger';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const reportClientErrorRoute = rateLimitedProcedure(protectedProcedure, {
  ...config.rateLimiters.reportClientError,
  logLabel: 'Report client error'
})
  .input(
    z.object({
      message: z.string().min(1).max(2_000),
      stack: z.string().max(20_000).optional(),
      componentStack: z.string().max(10_000).optional(),
      source: z.enum(['react', 'window', 'unhandled-rejection']),
      clientVersion: z.string().max(100),
      path: z.string().max(2_000),
      userAgent: z.string().max(1_000)
    })
  )
  .mutation(({ ctx, input }) => {
    logger.error(
      '[Client Error] %s',
      JSON.stringify({
        userId: ctx.userId,
        ...input
      })
    );

    return { ok: true };
  });

export { reportClientErrorRoute };

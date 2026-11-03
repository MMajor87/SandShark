import { Permission } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { deleteSoundboardSound } from '../../helpers/soundboard';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const deleteSoundRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.soundboardManage.maxRequests,
  windowMs: config.rateLimiters.soundboardManage.windowMs,
  logLabel: 'deleteSoundboardSound'
})
  .input(z.object({ soundId: z.number().int().min(1) }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDBOARD);

    await deleteSoundboardSound(input.soundId, ctx.user.id);
  });

export { deleteSoundRoute };

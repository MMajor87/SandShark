import { ChannelPermission, Permission, ServerEvents } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { soundboardSoundExists } from '../../db/queries/soundboard';
import { getCurrentVoiceRuntime } from '../../helpers/get-current-voice-runtime';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const playSoundRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.soundboardPlay.maxRequests,
  windowMs: config.rateLimiters.soundboardPlay.windowMs,
  logLabel: 'playSoundboardSound'
})
  .input(z.object({ soundId: z.number().int().min(1) }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.USE_SOUNDBOARD);

    const { channelId } = await getCurrentVoiceRuntime(ctx);
    const exists = await soundboardSoundExists(input.soundId);

    invariant(exists, {
      code: 'NOT_FOUND',
      message: 'Sound not found'
    });

    // a sound is heard by the whole channel, so it needs the same right as speaking in it
    await ctx.needsChannelPermission(channelId, ChannelPermission.SPEAK);

    ctx.pubsub.publish(ServerEvents.SOUNDBOARD_SOUND_PLAY, {
      channelId,
      userId: ctx.user.id,
      soundId: input.soundId
    });
  });

export { playSoundRoute };

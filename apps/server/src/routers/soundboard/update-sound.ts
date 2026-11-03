import {
  Permission,
  REACTION_EMOJI_MAX_LENGTH,
  SOUNDBOARD_NAME_MAX_LENGTH
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { resolveKnownEmojiFileId } from '../../helpers/resolve-known-emoji-file-id';
import { updateSoundboardSound } from '../../helpers/soundboard';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const updateSoundRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.soundboardManage.maxRequests,
  windowMs: config.rateLimiters.soundboardManage.windowMs,
  logLabel: 'updateSoundboardSound'
})
  .input(
    z.object({
      soundId: z.number().int().min(1),
      name: z.string().trim().min(1).max(SOUNDBOARD_NAME_MAX_LENGTH),
      emoji: z.string().min(1).max(REACTION_EMOJI_MAX_LENGTH).nullable()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDBOARD);

    if (input.emoji) await resolveKnownEmojiFileId(input.emoji);

    await updateSoundboardSound(
      input.soundId,
      { name: input.name, emoji: input.emoji },
      ctx.user.id
    );
  });

export { updateSoundRoute };

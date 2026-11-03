import {
  FileSaveType,
  Permission,
  REACTION_EMOJI_MAX_LENGTH,
  SOUNDBOARD_ALLOWED_EXTENSIONS,
  SOUNDBOARD_MAX_FILE_SIZE,
  SOUNDBOARD_MAX_SOUNDS,
  SOUNDBOARD_NAME_MAX_LENGTH
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { countSoundboardSounds } from '../../db/queries/soundboard';
import { fileManager } from '../../helpers/file-manager';
import { resolveKnownEmojiFileId } from '../../helpers/resolve-known-emoji-file-id';
import { createSoundboardSound } from '../../helpers/soundboard';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const addSoundRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.soundboardManage.maxRequests,
  windowMs: config.rateLimiters.soundboardManage.windowMs,
  logLabel: 'addSoundboardSound'
})
  .input(
    z.object({
      fileId: z.string().min(1),
      name: z.string().trim().min(1).max(SOUNDBOARD_NAME_MAX_LENGTH),
      emoji: z.string().min(1).max(REACTION_EMOJI_MAX_LENGTH).nullable()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDBOARD);

    const tempFile = fileManager.getTemporaryFile(input.fileId);

    invariant(tempFile && tempFile.userId === ctx.user.id, {
      code: 'NOT_FOUND',
      message: 'Uploaded file not found'
    });

    invariant(SOUNDBOARD_ALLOWED_EXTENSIONS.includes(tempFile.extension), {
      code: 'BAD_REQUEST',
      message: `Sounds must be one of: ${SOUNDBOARD_ALLOWED_EXTENSIONS.join(', ')}`
    });

    invariant(tempFile.size <= SOUNDBOARD_MAX_FILE_SIZE, {
      code: 'BAD_REQUEST',
      message: `Sounds can be at most ${SOUNDBOARD_MAX_FILE_SIZE / (1024 * 1024)} MB`
    });

    if (input.emoji) await resolveKnownEmojiFileId(input.emoji);

    const soundCount = await countSoundboardSounds();

    invariant(soundCount < SOUNDBOARD_MAX_SOUNDS, {
      code: 'BAD_REQUEST',
      message: `The soundboard is full, it holds at most ${SOUNDBOARD_MAX_SOUNDS} sounds`
    });

    const file = await fileManager.saveFile(
      input.fileId,
      ctx.user.id,
      FileSaveType.SOUNDBOARD_SOUND
    );

    const sound = await createSoundboardSound(
      { name: input.name, emoji: input.emoji, fileId: file.id },
      ctx.user.id
    );

    return sound.id;
  });

export { addSoundRoute };

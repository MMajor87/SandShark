import { z } from 'zod';
import { config } from '../../config';
import { getChannelsForUser } from '../../db/queries/channels';
import { getAccessibleFilesByIds } from '../../db/queries/files';
import { getSettings } from '../../db/queries/server';
import { attachFileToken } from '../../helpers/files-crypto';
import { createMediaAccessToken } from '../../helpers/media-access-token';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const refreshFileAccessRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.getMessages.maxRequests,
  windowMs: config.rateLimiters.getMessages.windowMs,
  logLabel: 'refreshFileAccess'
})
  .input(
    z.object({
      fileIds: z.array(z.number().int().positive()).max(50)
    })
  )
  .query(async ({ input, ctx }) => {
    const [visibleChannels, settings] = await Promise.all([
      getChannelsForUser(ctx.user.id),
      getSettings()
    ]);
    const files = await getAccessibleFilesByIds(
      [...new Set(input.fileIds)],
      visibleChannels.map((channel) => channel.id)
    );

    return {
      files: files.map((file) =>
        attachFileToken(
          file,
          settings.storageSignedUrlsEnabled,
          settings.storageSignedUrlsTtlSeconds
        )
      ),
      mediaAccessToken: createMediaAccessToken(
        ctx.user.id,
        ctx.user.tokenVersion
      )
    };
  });

export { refreshFileAccessRoute };

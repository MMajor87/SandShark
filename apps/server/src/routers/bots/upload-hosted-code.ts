import {
  HOSTED_BOT_MAX_ARCHIVE_SIZE,
  HostedBotSourceType
} from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { assertHostedBotAccess } from '../../helpers/assert-hosted-bot-access';
import { fileManager } from '../../helpers/file-manager';
import { replaceHostedBotCode } from '../../helpers/hosted-bot-code';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// the zip goes through /upload first like any file, and arrives here as that temporary file
const uploadHostedCodeRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'uploadHostedCode'
})
  .input(
    z.object({
      botId: z.number().int().positive(),
      fileId: z.string().min(1).max(64)
    })
  )
  .mutation(async ({ ctx, input }) => {
    const bot = await assertHostedBotAccess(ctx, input.botId);

    const tempFile = fileManager.getTemporaryFile(input.fileId);

    invariant(tempFile && tempFile.userId === ctx.user.id, {
      code: 'NOT_FOUND',
      message: 'Uploaded file not found.'
    });
    invariant(tempFile.extension === '.zip', {
      code: 'BAD_REQUEST',
      message: 'Upload the bot as a .zip file.'
    });
    invariant(tempFile.size <= HOSTED_BOT_MAX_ARCHIVE_SIZE, {
      code: 'BAD_REQUEST',
      message: `The code is larger than ${HOSTED_BOT_MAX_ARCHIVE_SIZE / 1024 / 1024} MB.`
    });

    try {
      await replaceHostedBotCode(bot, ctx.userId, Bun.file(tempFile.path), {
        type: HostedBotSourceType.UPLOAD,
        url: null,
        ref: null
      });
    } finally {
      await fileManager.removeTemporaryFile(tempFile.id);
    }
  });

export { uploadHostedCodeRoute };

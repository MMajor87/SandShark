import { Permission } from '@sandshark/shared';
import { z } from 'zod';
import { config } from '../../config';
import { getBotById } from '../../db/queries/bots';
import { publishBotCommandsChange } from '../../helpers/bot-commands';
import { deleteUserAccount } from '../../helpers/delete-user-account';
import { removeHostedBot } from '../../helpers/hosted-bots';
import { closeBotGatewaySessions } from '../../http/bot-api/gateway';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

// a bot is deleted like any account: its messages move to the deleted user placeholder,
// and the bots row and its token go with the user row through the cascade
const deleteBotRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.adminCreate.maxRequests,
  windowMs: config.rateLimiters.adminCreate.windowMs,
  logLabel: 'deleteBot'
})
  .input(z.object({ botId: z.number().int().positive() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_BOTS);

    const bot = await getBotById(input.botId);

    invariant(bot, { code: 'NOT_FOUND', message: 'Bot not found.' });

    await removeHostedBot(bot.id);
    await deleteUserAccount(bot.id, { wipe: false, deletedBy: ctx.user.id });
    closeBotGatewaySessions(bot.id);
    // its commands went with it, through the cascade
    publishBotCommandsChange(bot.id);
  });

export { deleteBotRoute };

import { Permission } from '@sandshark/shared';
import { getBotById } from '../db/queries/bots';
import { getSettings } from '../db/queries/server';
import { invariant } from '../utils/invariant';
import type { Context } from '../utils/trpc';

// every hosted bot route runs code as the server's own user, so it takes its own permission
// on top of managing bots, and the owner has to have turned hosting on
const assertHostedBotAccess = async (ctx: Context, botId: number) => {
  await ctx.needsPermission(Permission.HOST_BOTS);

  const bot = await getBotById(botId);

  invariant(bot, { code: 'NOT_FOUND', message: 'Bot not found.' });

  const { enableBotHosting } = await getSettings();

  invariant(enableBotHosting, {
    code: 'FORBIDDEN',
    message: 'Bot hosting is turned off on this server.'
  });

  return bot;
};

export { assertHostedBotAccess };

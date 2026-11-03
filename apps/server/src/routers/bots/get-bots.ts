import { Permission } from '@sandshark/shared';
import { getBots } from '../../db/queries/bots';
import { protectedProcedure } from '../../utils/trpc';

const getBotsRoute = protectedProcedure.query(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_BOTS);

  return getBots();
});

export { getBotsRoute };

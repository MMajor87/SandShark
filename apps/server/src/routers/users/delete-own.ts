import { DisconnectCode, OWNER_ROLE_ID } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../../config';
import { db } from '../../db';
import { getUserRoleIds } from '../../db/queries/roles';
import { users } from '../../db/schema';
import { deleteUserAccount } from '../../helpers/delete-user-account';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const deleteOwnRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.updatePassword.maxRequests,
  windowMs: config.rateLimiters.updatePassword.windowMs,
  logLabel: 'deleteOwn'
})
  .input(z.object({ password: z.string().min(4).max(128), wipe: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const user = await db
      .select({ password: users.password, passwordSet: users.passwordSet })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .get();

    invariant(user, { code: 'NOT_FOUND', message: 'User not found.' });

    const roleIds = await getUserRoleIds(ctx.userId);

    invariant(!roleIds.includes(OWNER_ROLE_ID), {
      code: 'FORBIDDEN',
      message: 'The server owner cannot delete their account.'
    });
    invariant(user.passwordSet, {
      code: 'FORBIDDEN',
      message: 'Sign in with your identity provider to delete this account.'
    });

    const valid = await Bun.password.verify(input.password, user.password);

    if (!valid) {
      ctx.throwValidationError('password', 'Current password is incorrect');
    }

    await deleteUserAccount(ctx.userId, {
      wipe: input.wipe,
      deletedBy: ctx.userId
    });

    const sockets = ctx.getUserWs(ctx.userId);

    setTimeout(() => {
      sockets.forEach((socket) =>
        socket.close(DisconnectCode.KICKED, 'Your account has been deleted')
      );
    }, 1000);
  });

export { deleteOwnRoute };

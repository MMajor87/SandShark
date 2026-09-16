import {
  ActivityLogType,
  DisconnectCode,
  OWNER_ROLE_ID
} from '@sharkord/shared';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../../config';
import { db } from '../../db';
import { getUserRoleIds } from '../../db/queries/roles';
import { users } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const resetPasswordRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.updatePassword.maxRequests,
  windowMs: config.rateLimiters.updatePassword.windowMs,
  logLabel: 'resetPassword'
})
  .input(
    z.object({
      userId: z.number().int().positive(),
      newPassword: z.string().min(4).max(128),
      confirmNewPassword: z.string().min(4).max(128)
    })
  )
  .mutation(async ({ ctx, input }) => {
    const actorRoleIds = await getUserRoleIds(ctx.userId);

    invariant(actorRoleIds.includes(OWNER_ROLE_ID), {
      code: 'FORBIDDEN',
      message: "Only server owners can reset another user's password."
    });

    invariant(input.userId !== ctx.userId, {
      code: 'BAD_REQUEST',
      message: 'Use your password settings to change your own password.'
    });

    if (input.newPassword !== input.confirmNewPassword) {
      ctx.throwValidationError(
        'confirmNewPassword',
        'New password and confirmation do not match'
      );
    }

    const targetUser = await db
      .select({ id: users.id, passwordSet: users.passwordSet })
      .from(users)
      .where(eq(users.id, input.userId))
      .get();

    invariant(targetUser, {
      code: 'NOT_FOUND',
      message: 'User not found'
    });

    invariant(targetUser.passwordSet, {
      code: 'FORBIDDEN',
      message:
        'This account signs in through an identity provider, so it has no password to change'
    });

    await db
      .update(users)
      .set({
        password: await Bun.password.hash(input.newPassword),
        tokenVersion: sql`${users.tokenVersion} + 1`
      })
      .where(eq(users.id, targetUser.id))
      .run();

    const sockets = ctx.getUserWs(targetUser.id);
    setTimeout(() => {
      sockets.forEach((socket) =>
        socket.close(DisconnectCode.KICKED, 'Your password was changed')
      );
    }, 0);

    enqueueActivityLog({
      type: ActivityLogType.USER_UPDATED_PASSWORD,
      userId: targetUser.id,
      details: { resetBy: ctx.userId }
    });
  });

export { resetPasswordRoute };

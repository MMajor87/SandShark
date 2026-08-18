import { ActivityLogType, OWNER_ROLE_ID } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { getUserRoleIds } from '../../db/queries/roles';
import { users } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const resetPasswordRoute = protectedProcedure
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
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .get();

    invariant(targetUser, {
      code: 'NOT_FOUND',
      message: 'User not found'
    });

    await db
      .update(users)
      .set({ password: await Bun.password.hash(input.newPassword) })
      .where(eq(users.id, targetUser.id))
      .run();

    enqueueActivityLog({
      type: ActivityLogType.USER_UPDATED_PASSWORD,
      userId: targetUser.id,
      details: { resetBy: ctx.userId }
    });
  });

export { resetPasswordRoute };

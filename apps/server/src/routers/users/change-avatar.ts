import z from 'zod';
import { getPublicUserById } from '../../db/queries/users';
import { changeUserImage } from '../../helpers/change-user-image';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const changeAvatarRoute = protectedProcedure
  .input(
    z.object({
      fileId: z.string().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await changeUserImage(ctx.userId, 'avatar', input.fileId);
    const updatedUser = await getPublicUserById(ctx.userId);
    invariant(updatedUser, {
      code: 'NOT_FOUND',
      message: 'Updated user not found'
    });
    return updatedUser;
  });

export { changeAvatarRoute };

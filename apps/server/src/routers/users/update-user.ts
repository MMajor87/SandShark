import {
  DELETED_USER_IDENTITY_AND_NAME,
  HEX_COLOR_REGEX
} from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { getPublicUserById } from '../../db/queries/users';
import { users } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const updateUserRoute = protectedProcedure
  .input(
    z.object({
      name: z
        .string()
        .min(1)
        .max(24)
        .refine((val) => val !== DELETED_USER_IDENTITY_AND_NAME, {
          message: 'Protected username'
        }),
      profileColor: z.string().regex(HEX_COLOR_REGEX, 'Invalid hex color'),
      bio: z.string().max(160).optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    const updatedUser = await db
      .update(users)
      .set({
        name: input.name,
        profileColor: input.profileColor,
        bio: input.bio ?? null
      })
      .where(eq(users.id, ctx.userId))
      .returning()
      .get();

    const publicUser = await getPublicUserById(updatedUser.id);

    invariant(publicUser, {
      code: 'NOT_FOUND',
      message: 'Updated user not found'
    });

    await publishUser(updatedUser.id, 'update');

    return publicUser;
  });

export { updateUserRoute };

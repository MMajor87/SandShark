import { Permission } from '@sandshark/shared';
import { z } from 'zod';
import { deleteEmoji } from '../../helpers/emojis';
import { protectedProcedure } from '../../utils/trpc';

const deleteEmojiRoute = protectedProcedure
  .input(
    z.object({
      emojiId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_EMOJIS);

    await deleteEmoji(input.emojiId, ctx.user.id);
  });

export { deleteEmojiRoute };

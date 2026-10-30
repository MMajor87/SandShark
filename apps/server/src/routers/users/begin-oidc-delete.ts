import { OWNER_ROLE_ID } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../../config';
import { db } from '../../db';
import { getUserRoleIds } from '../../db/queries/roles';
import { users } from '../../db/schema';
import { createAccountDeleteIntent } from '../../helpers/account-delete-intents';
import { isOidcEnabled } from '../../helpers/oidc/settings';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const beginOidcDeleteRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.updatePassword.maxRequests,
  windowMs: config.rateLimiters.updatePassword.windowMs,
  logLabel: 'beginOidcDelete'
})
  .input(z.object({ wipe: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    const user = await db
      .select({
        passwordSet: users.passwordSet,
        oidcSub: users.oidcSub,
        oidcIssuer: users.oidcIssuer
      })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .get();

    invariant(user, { code: 'NOT_FOUND', message: 'User not found.' });

    const roleIds = await getUserRoleIds(ctx.userId);

    invariant(!roleIds.includes(OWNER_ROLE_ID), {
      code: 'FORBIDDEN',
      message: 'The server owner cannot delete their account.'
    });
    invariant(
      !user.passwordSet &&
        !!user.oidcSub &&
        user.oidcIssuer === config.oidc.issuer &&
        isOidcEnabled(),
      {
        code: 'FORBIDDEN',
        message: 'Identity provider sign in is unavailable for this account.'
      }
    );

    return createAccountDeleteIntent(ctx.userId, input.wipe);
  });

export { beginOidcDeleteRoute };

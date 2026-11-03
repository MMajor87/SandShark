import { ServerEvents } from '@sandshark/shared';
import { protectedProcedure } from '../../utils/trpc';

// a bot's answers that only this member sees, and their removal
const onEphemeralMessageRoute = protectedProcedure.subscription(
  async ({ ctx }) =>
    ctx.pubsub.subscribeFor(ctx.user.id, ServerEvents.BOT_EPHEMERAL_MESSAGE)
);

const onEphemeralMessageDeleteRoute = protectedProcedure.subscription(
  async ({ ctx }) =>
    ctx.pubsub.subscribeFor(
      ctx.user.id,
      ServerEvents.BOT_EPHEMERAL_MESSAGE_DELETE
    )
);

// a command this member ran that the bot never answered
const onInteractionFailedRoute = protectedProcedure.subscription(
  async ({ ctx }) =>
    ctx.pubsub.subscribeFor(ctx.user.id, ServerEvents.BOT_INTERACTION_FAILED)
);

export {
  onEphemeralMessageDeleteRoute,
  onEphemeralMessageRoute,
  onInteractionFailedRoute
};

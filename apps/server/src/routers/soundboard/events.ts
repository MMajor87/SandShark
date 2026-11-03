import { ServerEvents } from '@sandshark/shared';
import { protectedProcedure } from '../../utils/trpc';

const onSoundCreateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUNDBOARD_SOUND_CREATE);
});

const onSoundUpdateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUNDBOARD_SOUND_UPDATE);
});

const onSoundDeleteRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUNDBOARD_SOUND_DELETE);
});

// broadcast like voice reactions: the indicator shows on the voice cards of whichever
// channel a user is looking at, only members of the channel actually hear the sound
const onSoundPlayRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUNDBOARD_SOUND_PLAY);
});

export {
  onSoundCreateRoute,
  onSoundDeleteRoute,
  onSoundPlayRoute,
  onSoundUpdateRoute
};

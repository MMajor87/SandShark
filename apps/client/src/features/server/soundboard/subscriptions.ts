import { logDebug } from '@/helpers/browser-logger';
import { getTRPCClient } from '@/lib/trpc';
import type { TJoinedSoundboardSound } from '@sandshark/shared';
import { handleSubscriptionError } from '../subscription-error';
import {
  addSoundboardSound,
  handleSoundboardSoundPlayed,
  removeSoundboardSound,
  updateSoundboardSound
} from './actions';

const subscribeToSoundboard = () => {
  const trpc = getTRPCClient();

  const onCreateSub = trpc.soundboard.onCreate.subscribe(undefined, {
    onData: (sound: TJoinedSoundboardSound) => {
      logDebug('[EVENTS] soundboard.onCreate', { sound });
      addSoundboardSound(sound);
    },
    onError: handleSubscriptionError('onSoundboardSoundCreate')
  });

  const onUpdateSub = trpc.soundboard.onUpdate.subscribe(undefined, {
    onData: (sound: TJoinedSoundboardSound) => {
      logDebug('[EVENTS] soundboard.onUpdate', { sound });
      updateSoundboardSound(sound);
    },
    onError: handleSubscriptionError('onSoundboardSoundUpdate')
  });

  const onDeleteSub = trpc.soundboard.onDelete.subscribe(undefined, {
    onData: (soundId: number) => {
      logDebug('[EVENTS] soundboard.onDelete', { soundId });
      removeSoundboardSound(soundId);
    },
    onError: handleSubscriptionError('onSoundboardSoundDelete')
  });

  const onPlaySub = trpc.soundboard.onPlay.subscribe(undefined, {
    onData: ({ channelId, userId, soundId }) => {
      logDebug('[EVENTS] soundboard.onPlay', { channelId, userId, soundId });
      handleSoundboardSoundPlayed(channelId, userId, soundId);
    },
    onError: handleSubscriptionError('onSoundboardSoundPlay')
  });

  return () => {
    onCreateSub.unsubscribe();
    onUpdateSub.unsubscribe();
    onDeleteSub.unsubscribe();
    onPlaySub.unsubscribe();
  };
};

export { subscribeToSoundboard };

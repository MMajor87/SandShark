import { store } from '@/features/store';
import { playSoundboardFile } from '@/helpers/soundboard-player';
import type { TJoinedSoundboardSound } from '@sandshark/shared';
import { serverSliceActions } from '../slice';
import { showVoiceReaction } from '../voice/actions';
import { getSoundboardPlayback } from './helpers';

export const addSoundboardSound = (sound: TJoinedSoundboardSound) => {
  store.dispatch(serverSliceActions.addSoundboardSound(sound));
};

export const updateSoundboardSound = (sound: TJoinedSoundboardSound) => {
  store.dispatch(serverSliceActions.updateSoundboardSound(sound));
};

export const removeSoundboardSound = (soundId: number) => {
  store.dispatch(serverSliceActions.removeSoundboardSound({ soundId }));
};

export const handleSoundboardSoundPlayed = (
  channelId: number,
  userId: number,
  soundId: number
) => {
  const playback = getSoundboardPlayback(store.getState(), channelId, soundId);

  if (!playback) return;

  showVoiceReaction(userId, playback.emoji);

  if (!playback.audible) return;

  playSoundboardFile(playback.file, playback.volume).catch(console.error);
};

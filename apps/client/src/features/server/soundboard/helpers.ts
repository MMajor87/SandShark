import { soundboardVolumeSelector } from '@/features/app/selectors';
import type { IRootState } from '@/features/store';
import { SOUNDBOARD_DEFAULT_EMOJI } from '@sandshark/shared';
import { currentVoiceChannelIdSelector } from '../channels/selectors';
import { ownVoiceStateSelector } from '../voice/selectors';
import { soundboardSoundByIdSelector } from './selectors';

// everyone viewing the channel sees who played a sound, only its members who are not
// deafened hear it
export const getSoundboardPlayback = (
  state: IRootState,
  channelId: number,
  soundId: number
) => {
  const sound = soundboardSoundByIdSelector(state, soundId);

  if (!sound) return undefined;

  const currentVoiceChannelId = currentVoiceChannelIdSelector(state);
  const ownVoiceState = ownVoiceStateSelector(state);

  return {
    file: sound.file,
    emoji: sound.emoji ?? SOUNDBOARD_DEFAULT_EMOJI,
    audible: currentVoiceChannelId === channelId && !ownVoiceState.soundMuted,
    volume: soundboardVolumeSelector(state)
  };
};

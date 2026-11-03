import { applyAudioOutputDevice } from '@/helpers/audio-output';
import { getFileUrl } from '@/helpers/get-file-url';
import { getLocalStorageItemAsJSON, LocalStorageKey } from '@/helpers/storage';
import type { TDeviceSettings } from '@/types';
import { SOUNDBOARD_MAX_DURATION_SECONDS, type TFile } from '@sandshark/shared';

export const DEFAULT_SOUNDBOARD_VOLUME = 50;

// sounds may overlap, but a burst of them should not stack into noise
const MAX_PLAYING_SOUNDS = 4;

const playing = new Set<HTMLAudioElement>();

const stopSound = (audio: HTMLAudioElement) => {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  playing.delete(audio);
};

// the selected speaker lives in the devices provider, which saves every change here,
// and the play event arrives outside react
const getPlaybackDeviceId = () => {
  const devices = getLocalStorageItemAsJSON<Partial<TDeviceSettings>>(
    LocalStorageKey.DEVICES_SETTINGS
  );

  return devices?.playbackId;
};

export const playSoundboardFile = async (file: TFile, volume: number) => {
  if (volume <= 0 || playing.size >= MAX_PLAYING_SOUNDS) return;

  const audio = new Audio(getFileUrl(file));

  audio.volume = Math.min(volume, 100) / 100;
  playing.add(audio);

  // uploads are checked for length, this keeps an unchecked one from playing on
  const timeout = setTimeout(
    () => stopSound(audio),
    SOUNDBOARD_MAX_DURATION_SECONDS * 1000
  );

  const finish = () => {
    clearTimeout(timeout);
    stopSound(audio);
  };

  audio.addEventListener('ended', finish, { once: true });
  audio.addEventListener('error', finish, { once: true });

  await applyAudioOutputDevice(audio, getPlaybackDeviceId(), false);

  try {
    await audio.play();
  } catch {
    finish();
  }
};

export const stopAllSoundboardSounds = () => {
  for (const audio of [...playing]) stopSound(audio);
};

import type { IRootState } from '@/features/store';
import { createSelector } from '@reduxjs/toolkit';
import { createCachedSelector } from 're-reselect';

export const soundboardSoundsSelector = (state: IRootState) =>
  state.server.soundboardSounds;

export const sortedSoundboardSoundsSelector = createSelector(
  [soundboardSoundsSelector],
  (sounds) => [...sounds].sort((a, b) => a.name.localeCompare(b.name))
);

export const soundboardSoundByIdSelector = createCachedSelector(
  [soundboardSoundsSelector, (_: IRootState, soundId: number) => soundId],
  (sounds, soundId) => sounds.find((sound) => sound.id === soundId)
)((_, soundId: number) => soundId);

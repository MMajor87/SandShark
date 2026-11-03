import type { TFile, TJoinedSoundboardSound } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { serverSliceActions, serverSliceReducer } from '../../slice';

const file = {
  id: 7,
  name: 'airhorn.mp3',
  _accessToken: 'expired',
  _accessTokenExpiresAt: 1
} as TFile;

const sound = (id: number, userId = 1) =>
  ({
    id,
    name: `sound-${id}`,
    emoji: null,
    userId,
    file
  }) as unknown as TJoinedSoundboardSound;

const withSounds = (...sounds: TJoinedSoundboardSound[]) =>
  sounds.reduce(
    (state, entry) =>
      serverSliceReducer(state, serverSliceActions.addSoundboardSound(entry)),
    serverSliceReducer(undefined, { type: 'init' })
  );

describe('soundboard reducers', () => {
  test('should add a sound once, update it and remove it', () => {
    let state = withSounds(sound(1), sound(1), sound(2));

    expect(state.soundboardSounds.map(({ id }) => id)).toEqual([1, 2]);

    state = serverSliceReducer(
      state,
      serverSliceActions.updateSoundboardSound({ ...sound(1), name: 'Horn' })
    );

    expect(state.soundboardSounds[0]?.name).toBe('Horn');

    state = serverSliceReducer(
      state,
      serverSliceActions.removeSoundboardSound({ soundId: 1 })
    );

    expect(state.soundboardSounds.map(({ id }) => id)).toEqual([2]);
  });

  test('should renew a sound file token and drop a sound whose access was revoked', () => {
    const renewed = { ...file, _accessToken: 'renewed' };
    let state = withSounds(sound(1));

    state = serverSliceReducer(
      state,
      serverSliceActions.refreshFileAccess({
        requestedIds: [7],
        files: [renewed]
      })
    );

    expect(state.soundboardSounds[0]?.file._accessToken).toBe('renewed');

    state = serverSliceReducer(
      state,
      serverSliceActions.refreshFileAccess({ requestedIds: [7], files: [] })
    );

    expect(state.soundboardSounds).toEqual([]);
  });

  test('should drop the sounds of a wiped user and reassign those of a deleted one', () => {
    let state = withSounds(sound(1, 3), sound(2, 4));

    state = serverSliceReducer(
      state,
      serverSliceActions.reassignUser({ userId: 4, deletedUserId: 9 })
    );

    expect(state.soundboardSounds.map(({ userId }) => userId)).toEqual([3, 9]);

    state = serverSliceReducer(
      state,
      serverSliceActions.wipeUser({ userId: 3 })
    );

    expect(state.soundboardSounds.map(({ id }) => id)).toEqual([2]);
  });
});

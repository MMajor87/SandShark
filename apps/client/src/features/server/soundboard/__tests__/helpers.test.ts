import type { IRootState } from '@/features/store';
import type { TFile, TJoinedSoundboardSound } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { getSoundboardPlayback } from '../helpers';

const VOICE_CHANNEL_ID = 2;
const OTHER_CHANNEL_ID = 3;

const file = { id: 7, name: 'airhorn.mp3' } as TFile;

type TStateOptions = {
  emoji?: string | null;
  soundMuted?: boolean;
};

const stateWith = ({
  emoji = 'tada',
  soundMuted = false
}: TStateOptions = {}) =>
  ({
    app: { soundboardVolume: 40 },
    server: {
      soundboardSounds: [
        { id: 1, name: 'Airhorn', emoji, file } as TJoinedSoundboardSound
      ],
      currentVoiceChannelId: VOICE_CHANNEL_ID,
      ownVoiceState: { soundMuted }
    }
  }) as unknown as IRootState;

describe('getSoundboardPlayback', () => {
  test('should be audible at the listener volume in the channel they are in', () => {
    expect(getSoundboardPlayback(stateWith(), VOICE_CHANNEL_ID, 1)).toEqual({
      file,
      emoji: 'tada',
      audible: true,
      volume: 40
    });
  });

  test('should show but not play a sound from another channel', () => {
    const playback = getSoundboardPlayback(stateWith(), OTHER_CHANNEL_ID, 1);

    expect(playback?.emoji).toBe('tada');
    expect(playback?.audible).toBe(false);
  });

  test('should not be audible while the listener is deafened', () => {
    const playback = getSoundboardPlayback(
      stateWith({ soundMuted: true }),
      VOICE_CHANNEL_ID,
      1
    );

    expect(playback?.audible).toBe(false);
  });

  test('should fall back to the default emoji for a sound without one', () => {
    const playback = getSoundboardPlayback(
      stateWith({ emoji: null }),
      VOICE_CHANNEL_ID,
      1
    );

    expect(playback?.emoji).toBe('loud_sound');
  });

  test('should ignore a sound this client does not know', () => {
    expect(
      getSoundboardPlayback(stateWith(), VOICE_CHANNEL_ID, 999)
    ).toBeUndefined();
  });
});

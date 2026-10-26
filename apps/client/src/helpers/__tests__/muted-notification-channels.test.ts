import { afterEach, expect, test } from 'bun:test';
import {
  getMutedNotificationChannelIds,
  setMutedNotificationChannelIds
} from '../muted-notification-channels';
import { LocalStorageKey } from '../storage';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('preserves existing mutes and isolates identical channel IDs across saved servers', () => {
  const values = new Map<string, string>([
    [LocalStorageKey.ACTIVE_SERVER_PROFILE_ID, 'first'],
    [
      LocalStorageKey.MUTED_NOTIFICATION_CHANNELS,
      JSON.stringify({ first: [7], second: [8] })
    ]
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    }
  });
  expect(getMutedNotificationChannelIds()).toEqual([7]);
  setMutedNotificationChannelIds([7, 9]);
  values.set(LocalStorageKey.ACTIVE_SERVER_PROFILE_ID, 'second');
  expect(getMutedNotificationChannelIds()).toEqual([8]);
  setMutedNotificationChannelIds([]);
  values.set(LocalStorageKey.ACTIVE_SERVER_PROFILE_ID, 'first');
  expect(getMutedNotificationChannelIds()).toEqual([7, 9]);
});

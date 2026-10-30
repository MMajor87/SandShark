import { expect, test } from 'bun:test';
import { getSavedOrDefaultVolume } from '../volume-default';

test('new screen shares start muted only when the preference is enabled', () => {
  expect(getSavedOrDefaultVolume({}, 'userscreen-12', true)).toBe(0);
  expect(getSavedOrDefaultVolume({}, 'userscreen-12', false)).toBe(100);
  expect(getSavedOrDefaultVolume({}, 'user-12', true)).toBe(100);
  expect(getSavedOrDefaultVolume({}, 'external-plugin-stream', true)).toBe(100);
});

test('saved screen share choices survive a new stream and preference changes', () => {
  const savedVolumes = { 'userscreen-12': 45, 'userscreen-13': 0 };
  expect(getSavedOrDefaultVolume(savedVolumes, 'userscreen-12', true)).toBe(45);
  expect(getSavedOrDefaultVolume(savedVolumes, 'userscreen-12', false)).toBe(
    45
  );
  expect(getSavedOrDefaultVolume(savedVolumes, 'userscreen-13', false)).toBe(0);
  expect(getSavedOrDefaultVolume(savedVolumes, 'userscreen-14', true)).toBe(0);
});

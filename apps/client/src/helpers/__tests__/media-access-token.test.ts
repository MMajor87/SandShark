import type { TFile } from '@sharkord/shared';
import { afterEach, expect, test } from 'bun:test';
import { getFileUrl } from '../get-file-url';
import {
  getMediaAccessToken,
  setMediaAccessToken
} from '../media-access-token';
import {
  clearCurrentSessionToken,
  setCurrentSessionToken
} from '../server-session';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage'
);
afterEach(() => {
  for (const [name, descriptor] of [
    ['window', originalWindow],
    ['sessionStorage', originalStorage]
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test('only attachment URLs contain media credentials and credentials stay with their session', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key)
    }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://first.example' } }
  });
  setCurrentSessionToken('login-secret');
  setMediaAccessToken('read-only-media');
  const file = {
    name: 'photo #1.png',
    _accessToken: 'file-signature',
    _accessTokenExpiresAt: 123
  } as TFile;
  const url = new URL(getFileUrl(file, true));
  expect(url.searchParams.get('mediaToken')).toBe('read-only-media');
  expect(url.searchParams.get('accessToken')).toBe('file-signature');
  expect(url.toString()).not.toContain('login-secret');
  expect(getFileUrl(file)).not.toContain('mediaToken');
  setCurrentSessionToken('different-session');
  expect(getMediaAccessToken()).toBeUndefined();
  setMediaAccessToken('new-media');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://second.example' } }
  });
  expect(getMediaAccessToken()).toBeUndefined();
  clearCurrentSessionToken();
  expect(getMediaAccessToken()).toBeUndefined();
});

import {
  getLocalStorageItem,
  getLocalStorageItemAsJSON,
  getLocalStorageItemBool,
  getSessionStorageItem,
  LocalStorageKey,
  migrateLegacyStorageKeys,
  SessionStorageKey,
  setLocalStorageItem
} from '@/helpers/storage';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

const original = globalThis.localStorage;
const originalSession = globalThis.sessionStorage;

const createStorage = () => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
};

const breakStorage = () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError');
    }
  });
};

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: original,
    writable: true
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: originalSession,
    writable: true
  });
});

describe('storage', () => {
  it('falls back to defaults when storage access throws', () => {
    breakStorage();

    expect(getLocalStorageItem(LocalStorageKey.DEBUG)).toBeNull();
    expect(getLocalStorageItemBool(LocalStorageKey.DEBUG, true)).toBe(true);
    expect(
      getLocalStorageItemAsJSON(LocalStorageKey.RECENT_EMOJIS, [])
    ).toEqual([]);
    expect(() =>
      setLocalStorageItem(LocalStorageKey.DEBUG, 'true')
    ).not.toThrow();
  });

  it('falls back to the default when the stored json is corrupt', () => {
    setLocalStorageItem(LocalStorageKey.RECENT_EMOJIS, '{not json');

    expect(
      getLocalStorageItemAsJSON(LocalStorageKey.RECENT_EMOJIS, [])
    ).toEqual([]);
  });
});

describe('migrateLegacyStorageKeys', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorage()
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: createStorage()
    });
  });

  it('moves values saved under legacy keys to the new keys', () => {
    localStorage.setItem('sharkord-identity', 'legacy-identity');
    sessionStorage.setItem('sharkord-token', 'legacy-token');

    migrateLegacyStorageKeys();

    expect(getLocalStorageItem(LocalStorageKey.IDENTITY)).toBe(
      'legacy-identity'
    );
    expect(getSessionStorageItem(SessionStorageKey.TOKEN)).toBe('legacy-token');
    expect(localStorage.getItem('sharkord-identity')).toBeNull();
    expect(sessionStorage.getItem('sharkord-token')).toBeNull();
  });

  it('keeps a newer value over the legacy one', () => {
    setLocalStorageItem(LocalStorageKey.LANGUAGE, 'fr');
    localStorage.setItem('sharkord-language', 'en');

    migrateLegacyStorageKeys();

    expect(getLocalStorageItem(LocalStorageKey.LANGUAGE)).toBe('fr');
    expect(localStorage.getItem('sharkord-language')).toBeNull();
  });
});

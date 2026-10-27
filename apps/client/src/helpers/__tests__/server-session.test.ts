import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import {
  saveServerConnection,
  selectServerProfile
} from '../server-connection';
import {
  clearServerSessionByKey,
  getCurrentServerAutoLoginToken,
  getCurrentServerIdentity,
  getCurrentSessionToken,
  saveServerLogin,
  setCurrentSessionToken
} from '../server-session';

const originalWindow = globalThis.window;
const originalLocal = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage'
);
const originalSession = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage'
);
const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
};
const setSecret = mock(async (_input: { key: string; value: string }) => true);
const getSecret = mock(
  async (_key: string): Promise<string | undefined> => undefined
);
const removeSecret = mock(async (_key: string) => true);
beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage()
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage()
  });
  globalThis.window = {
    location: { protocol: 'file:', search: '' },
    sandSharkDesktop: { setSecret, getSecret, removeSecret }
  } as unknown as Window & typeof globalThis;
  setSecret.mockClear();
  getSecret.mockClear();
  removeSecret.mockClear();
  for (const id of ['first', 'second'])
    saveServerConnection({
      serverId: id,
      httpUrl: `https://${id}.example`,
      websocketUrl: `wss://${id}.example`
    });
  selectServerProfile('first');
});
afterEach(() => {
  globalThis.window = originalWindow;
  if (originalLocal)
    Object.defineProperty(globalThis, 'localStorage', originalLocal);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  if (originalSession)
    Object.defineProperty(globalThis, 'sessionStorage', originalSession);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test('desktop identities and secret keys stay scoped to the selected server', async () => {
  await saveServerLogin({
    identity: 'alice',
    token: 'first-token',
    autoLogin: true
  });
  expect(setSecret).toHaveBeenCalledWith({
    key: 'auto-login:first',
    value: 'first-token'
  });
  selectServerProfile('second');
  expect(getCurrentServerIdentity()).toBeUndefined();
  expect(getCurrentSessionToken()).toBeNull();
  await saveServerLogin({
    identity: 'bob',
    token: 'second-token',
    autoLogin: true
  });
  clearServerSessionByKey('first');
  expect(getCurrentServerIdentity()).toBe('bob');
  expect(getCurrentSessionToken()).toBe('second-token');
  expect(removeSecret).toHaveBeenCalledWith('auto-login:first');
});
test('a secret write completing after a profile switch cannot install its token in the new session', async () => {
  const pending = deferred<boolean>();
  setSecret.mockImplementationOnce(() => pending.promise);
  const save = saveServerLogin({
    identity: 'alice',
    token: 'first-token',
    autoLogin: true
  });
  selectServerProfile('second');
  setCurrentSessionToken('second-token');
  pending.resolve(true);
  await expect(save).rejects.toThrow('Server profile changed.');
  expect(getCurrentSessionToken()).toBe('second-token');
  expect(getCurrentServerIdentity()).toBeUndefined();
});
test('a late secret read cannot authenticate a different server profile', async () => {
  const pending = deferred<string | undefined>();
  getSecret.mockImplementationOnce(() => pending.promise);
  const token = getCurrentServerAutoLoginToken();
  selectServerProfile('second');
  pending.resolve('first-token');
  expect(await token).toBeUndefined();
  expect(getCurrentSessionToken()).toBeNull();
});
test('a login response for an earlier profile is rejected before writing identity or secrets', async () => {
  selectServerProfile('second');
  await expect(
    saveServerLogin({
      identity: 'alice',
      token: 'first-token',
      autoLogin: true,
      serverSessionKey: 'first'
    })
  ).rejects.toThrow('Server profile changed.');
  expect(setSecret).not.toHaveBeenCalled();
  expect(getCurrentServerIdentity()).toBeUndefined();
});

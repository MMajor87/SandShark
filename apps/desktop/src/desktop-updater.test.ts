import { expect, mock, spyOn, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createDesktopUpdater } from './desktop-updater.js';

test('concurrent updater initialization attaches one listener set and disposal silences later events', async () => {
  const updater = Object.assign(new EventEmitter(), { autoDownload: true });
  const send = mock(() => {});
  let destroyed = false;
  const load = mock(async () => updater);
  const service = createDesktopUpdater({
    getMainWindow: () => ({
      isDestroyed: () => destroyed,
      webContents: { send }
    }),
    preferences: {
      getUpdateSettings: () => ({
        automaticallyCheck: false,
        automaticallyDownload: false
      })
    },
    isDevelopment: false,
    isPackagedSmokeTest: false,
    writeDesktopLog: () => {},
    loadUpdater: load
  } as unknown as Parameters<typeof createDesktopUpdater>[0]);
  await Promise.all([
    service.configureAutoUpdater(),
    service.configureAutoUpdater()
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(updater.listenerCount('update-available')).toBe(1);
  expect(updater.autoDownload).toBe(false);
  updater.emit('update-available', { version: '2.0.0' });
  expect(send).toHaveBeenCalledTimes(1);
  destroyed = true;
  updater.emit('update-available', { version: '2.0.1' });
  expect(send).toHaveBeenCalledTimes(1);
  service.dispose();
  service.dispose();
  expect(updater.eventNames()).toEqual([]);
  updater.emit('update-available', { version: '2.0.2' });
  expect(send).toHaveBeenCalledTimes(1);
  expect(await service.configureAutoUpdater()).toBeUndefined();
});

test('disposal while the updater loads prevents late registration', async () => {
  const updater = new EventEmitter();
  let resolveLoad!: (value: unknown) => void;
  const service = createDesktopUpdater({
    getMainWindow: () => null,
    preferences: {
      getUpdateSettings: () => ({
        automaticallyCheck: false,
        automaticallyDownload: true
      })
    },
    isDevelopment: false,
    isPackagedSmokeTest: false,
    writeDesktopLog: () => {},
    loadUpdater: () =>
      new Promise((resolve) => {
        resolveLoad = resolve;
      })
  } as unknown as Parameters<typeof createDesktopUpdater>[0]);
  const pending = service.configureAutoUpdater();
  service.dispose();
  resolveLoad(updater);
  expect(await pending).toBeUndefined();
  expect(updater.eventNames()).toEqual([]);
});

test('partial updater registration failure removes listeners before retry', async () => {
  const updater = new EventEmitter();
  const originalOn = updater.on.bind(updater);
  let fail = true;
  updater.on = (
    event: string | symbol,
    listener: (...args: unknown[]) => void
  ) => {
    if (fail && event === 'update-available')
      throw new Error('registration failed');
    return originalOn(event, listener);
  };
  const service = createDesktopUpdater({
    getMainWindow: () => null,
    preferences: {
      getUpdateSettings: () => ({
        automaticallyCheck: false,
        automaticallyDownload: true
      })
    },
    isDevelopment: false,
    isPackagedSmokeTest: false,
    writeDesktopLog: () => {},
    loadUpdater: async () => updater
  } as unknown as Parameters<typeof createDesktopUpdater>[0]);
  expect(await service.configureAutoUpdater()).toBeUndefined();
  expect(updater.eventNames()).toEqual([]);
  fail = false;
  await service.configureAutoUpdater();
  expect(service.isConfigured()).toBe(true);
  expect(updater.listenerCount('checking-for-update')).toBe(1);
  service.dispose();
});

test('checks the selected desktop feed and reports lookup failure without falling back', async () => {
  const setFeedURL = mock(() => {});
  const checkForUpdates = mock(async () => {});
  const updater = Object.assign(new EventEmitter(), {
    setFeedURL,
    checkForUpdates
  });
  const handlers = new Map<string, (event: unknown) => Promise<unknown>>();
  const service = createDesktopUpdater({
    getMainWindow: () => null,
    preferences: {
      getUpdateSettings: () => ({
        automaticallyCheck: false,
        automaticallyDownload: false
      })
    },
    isDevelopment: false,
    isPackagedSmokeTest: false,
    writeDesktopLog: () => {},
    loadUpdater: async () => updater
  } as unknown as Parameters<typeof createDesktopUpdater>[0]);
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json([
      {
        tag_name: 'sandshark-server-v99.0.0',
        draft: false,
        prerelease: false,
        assets: []
      },
      {
        tag_name: 'sandshark-v1.1.2',
        draft: false,
        prerelease: false,
        assets: [{ name: 'latest.yml' }]
      }
    ])
  );
  try {
    service.registerIpc({
      getSenderWindow: () => null,
      handle: (name: string, handler: (event: unknown) => Promise<unknown>) =>
        handlers.set(name, handler)
    } as unknown as Parameters<typeof service.registerIpc>[0]);
    const check = handlers.get('sandshark:check-for-updates');
    if (!check) throw new Error('Missing update handler');
    await check({});
    expect(setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://github.com/MMajor87/SandShark/releases/download/sandshark-v1.1.2/',
      useMultipleRangeRequest: false
    });
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    fetchSpy.mockResolvedValue(new Response(null, { status: 403 }));
    expect(await check({})).toEqual({
      state: 'error',
      message: 'Could not check for SandShark updates.'
    });
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
  } finally {
    fetchSpy.mockRestore();
    service.dispose();
  }
});

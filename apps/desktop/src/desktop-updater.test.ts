import { expect, mock, test } from 'bun:test';
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
  updater.on = (event: string | symbol, listener: (...args: unknown[]) => void) => {
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

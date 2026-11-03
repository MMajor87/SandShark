import { expect, mock, spyOn, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createDesktopUpdater } from './desktop-updater.js';

test('concurrent updater initialization attaches one listener set and disposal silences later events', async () => {
  const updater = Object.assign(new EventEmitter(), {
    autoDownload: true,
    autoInstallOnAppQuit: true
  });
  let automaticallyDownload = false;
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
        automaticallyDownload
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
  expect(updater.autoInstallOnAppQuit).toBe(false);
  automaticallyDownload = true;
  await service.configureAutoUpdater();
  expect(updater.autoDownload).toBe(true);
  expect(updater.autoInstallOnAppQuit).toBe(true);
  automaticallyDownload = false;
  await service.configureAutoUpdater();
  expect(updater.autoInstallOnAppQuit).toBe(false);
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

const createPromptHarness = (responses: number[]) => {
  const updater = Object.assign(new EventEmitter(), {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    setFeedURL: mock(() => {}),
    checkForUpdates: mock(async () => {}),
    downloadUpdate: mock(async () => {}),
    quitAndInstall: mock(() => {})
  });
  const showMessageBox = mock(async () => ({
    response: responses.shift() ?? 1,
    checkboxChecked: false
  }));
  const handlers = new Map<string, (event: unknown) => Promise<unknown>>();
  const service = createDesktopUpdater({
    getMainWindow: () => null,
    preferences: {
      getUpdateSettings: () => ({
        automaticallyCheck: true,
        automaticallyDownload: false
      })
    },
    isDevelopment: false,
    isPackagedSmokeTest: false,
    dialog: { showMessageBox },
    writeDesktopLog: () => {},
    loadUpdater: async () => updater
  } as unknown as Parameters<typeof createDesktopUpdater>[0]);
  service.registerIpc({
    getSenderWindow: () => null,
    handle: (name: string, handler: (event: unknown) => Promise<unknown>) =>
      handlers.set(name, handler)
  } as unknown as Parameters<typeof service.registerIpc>[0]);
  const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json([
      {
        tag_name: 'sandshark-v1.1.4',
        draft: false,
        prerelease: false,
        assets: [{ name: 'latest.yml' }]
      }
    ])
  );
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  return { updater, showMessageBox, handlers, service, fetchSpy, flush };
};

test('launch check prompts to download and then to restart', async () => {
  const { updater, showMessageBox, service, fetchSpy, flush } =
    createPromptHarness([0, 0]);
  try {
    await service.configureAutoUpdater();
    await flush();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    updater.emit('update-available', { version: '1.1.5' });
    await flush();
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    updater.emit('update-downloaded', { version: '1.1.5' });
    await flush();
    expect(showMessageBox).toHaveBeenCalledTimes(2);
    expect(updater.quitAndInstall).toHaveBeenCalledTimes(1);
  } finally {
    fetchSpy.mockRestore();
    service.dispose();
  }
});

test('declining the launch prompt does not download or prompt again', async () => {
  const { updater, showMessageBox, service, fetchSpy, flush } =
    createPromptHarness([1]);
  try {
    await service.configureAutoUpdater();
    await flush();
    updater.emit('update-available', { version: '1.1.5' });
    await flush();
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    updater.emit('update-downloaded', { version: '1.1.5' });
    await flush();
    expect(showMessageBox).toHaveBeenCalledTimes(1);
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    service.dispose();
  }
});

test('a manual check from settings does not prompt', async () => {
  const { updater, showMessageBox, handlers, service, fetchSpy, flush } =
    createPromptHarness([0]);
  try {
    await service.configureAutoUpdater();
    await flush();
    updater.emit('update-not-available');
    const check = handlers.get('sandshark:check-for-updates');
    if (!check) throw new Error('Missing update handler');
    await check({});
    updater.emit('update-available', { version: '1.1.5' });
    await flush();
    expect(showMessageBox).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
    service.dispose();
  }
});

test('logs and reports an updater module that provides no updater', async () => {
  const logs: string[] = [];
  const service = createDesktopUpdater({
    getMainWindow: () => null,
    preferences: {
      getUpdateSettings: () => ({
        automaticallyCheck: true,
        automaticallyDownload: true
      })
    },
    isDevelopment: false,
    isPackagedSmokeTest: false,
    writeDesktopLog: (_category: string, message: string) => {
      logs.push(message);
    },
    loadUpdater: async () => undefined
  } as unknown as Parameters<typeof createDesktopUpdater>[0]);

  expect(await service.configureAutoUpdater()).toBeUndefined();
  expect(logs).toContain('Electron updater module failed to load');
});

// node only exposes commonjs getters through the default export, which is where the
// loader reads autoUpdater from. the getter is not called, it needs a running electron app
test('electron-updater defines autoUpdater on its default export', async () => {
  const { default: electronUpdater } = await import('electron-updater');

  expect(
    Object.getOwnPropertyDescriptor(electronUpdater, 'autoUpdater')
  ).toBeDefined();
});

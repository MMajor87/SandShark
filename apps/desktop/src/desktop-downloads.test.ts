import { expect, mock, test } from 'bun:test';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { EventEmitter } from 'node:events';
import { createDesktopDownloads } from './desktop-downloads.js';
import { createDesktopIpc } from './desktop-ipc.js';

const setup = () => {
  const session = new EventEmitter();
  const sender = {
    id: 7,
    isDestroyed: () => false,
    downloadURL: mock(() => {}),
    send: mock(() => {})
  };
  const window = { isDestroyed: () => false, webContents: sender };
  const save = mock(async () => ({
    canceled: false,
    filePath: 'C:/Downloads/test.txt'
  }));
  const openPath = mock(async () => '');
  const service = createDesktopDownloads({
    getMainWindow: () => window,
    downloadSession: session,
    runtime: {
      app: { getPath: () => 'C:/Downloads' },
      dialog: { showSaveDialog: save },
      shell: { openPath, showItemInFolder: mock(() => {}) }
    }
  } as unknown as Parameters<typeof createDesktopDownloads>[0]);
  const handlers = new Map<string, Parameters<IpcMain['handle']>[1]>();
  const ipc = createDesktopIpc(
    {
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
      removeHandler: (channel) => {
        handlers.delete(channel);
      }
    },
    () => window as unknown as Electron.BrowserWindow
  );
  service.registerIpc(ipc);
  service.registerIpc(ipc);
  const invoke = (channel: string, payload?: unknown) =>
    handlers.get(`sandshark:${channel}`)!(
      { sender } as unknown as IpcMainInvokeEvent,
      payload
    );
  const request = () =>
    invoke('download-file', {
      url: 'https://files.test/file',
      filename: 'test.txt'
    }) as Promise<{ id?: string }>;
  return { service, session, sender, window, save, request, invoke, openPath };
};
const item = (url = 'https://files.test/file') =>
  Object.assign(new EventEmitter(), {
    getURL: () => url,
    getURLChain: () => [url],
    getReceivedBytes: () => 5,
    getTotalBytes: () => 10,
    setSavePath: mock(() => {}),
    cancel: mock(() => {})
  });

test('downloads register once, ignore unrelated events and report completion once', async () => {
  const { service, session, sender, request, invoke, openPath } = setup();
  service.configureDownloads();
  service.configureDownloads();
  expect(session.listenerCount('will-download')).toBe(1);
  const { id } = await request();
  const unrelated = item('https://other.test/file');
  session.emit('will-download', {}, unrelated, sender);
  expect(unrelated.setSavePath).not.toHaveBeenCalled();
  const download = item();
  session.emit('will-download', {}, download, sender);
  expect(download.setSavePath).toHaveBeenCalledWith('C:/Downloads/test.txt');
  download.emit('done', {}, 'completed');
  download.emit('done', {}, 'completed');
  expect(sender.send).toHaveBeenCalledTimes(2);
  expect(download.listenerCount('updated')).toBe(0);
  await invoke('open-downloaded-file', id);
  expect(openPath).toHaveBeenCalledWith('C:/Downloads/test.txt');
  service.dispose();
  service.dispose();
  expect(session.listenerCount('will-download')).toBe(0);
});

test('dialog cancellation and window closure do not start downloads; active downloads are cancelled on disposal', async () => {
  const { service, session, sender, window, save, request } = setup();
  service.configureDownloads();
  save.mockResolvedValueOnce({ canceled: true, filePath: '' });
  expect(await request()).toEqual({});
  expect(sender.downloadURL).not.toHaveBeenCalled();
  const pending = request();
  window.isDestroyed = () => true;
  expect(await pending).toEqual({});
  expect(sender.downloadURL).not.toHaveBeenCalled();
  window.isDestroyed = () => false;
  await request();
  const download = item();
  session.emit('will-download', {}, download, sender);
  service.releaseWindow(sender.id);
  service.dispose();
  expect(download.cancel).toHaveBeenCalledTimes(1);
  expect(download.eventNames()).toEqual([]);
});

test('download payloads reject unsafe URLs and incomplete files cannot be opened', async () => {
  const { invoke, service } = setup();
  await expect(
    invoke('download-file', { url: 'file:///secret', filename: 'test' })
  ).rejects.toThrow('Invalid download request');
  await expect(invoke('open-downloaded-file', 'missing')).rejects.toThrow(
    'no longer available'
  );
  service.dispose();
});

test('disposal while a save dialog is open prevents a late download', async () => {
  const { service, request, sender } = setup();
  const pending = request();
  service.dispose();
  expect(await pending).toEqual({});
  expect(sender.downloadURL).not.toHaveBeenCalled();
});

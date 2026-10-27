import { expect, mock, test } from 'bun:test';
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';
import { createDesktopIpc } from './desktop-ipc.js';
import { assertTrustedRenderer } from './trusted-renderer.js';

test('IPC guards run before payload handling and registration/disposal is idempotent', () => {
  const handlers = new Map<string, Parameters<IpcMain['handle']>[1]>();
  const ipcMain = {
    handle: mock(
      (channel: string, listener: Parameters<IpcMain['handle']>[1]) => {
        handlers.set(channel, listener);
      }
    ),
    removeHandler: mock((channel: string) => {
      handlers.delete(channel);
    })
  };
  let trusted = false;
  const guard = () => {
    if (!trusted) throw new Error('untrusted');
    return {} as BrowserWindow;
  };
  const ipc = createDesktopIpc(ipcMain, guard);
  const operation = mock(() => 'ok');
  ipc.handle('test', operation);
  ipc.handle('test', operation);
  expect(ipcMain.handle).toHaveBeenCalledTimes(1);
  expect(() => handlers.get('test')!({} as IpcMainInvokeEvent)).toThrow(
    'untrusted'
  );
  expect(operation).not.toHaveBeenCalled();
  trusted = true;
  expect(handlers.get('test')!({} as IpcMainInvokeEvent)).toBe('ok');
  ipc.dispose();
  ipc.dispose();
  expect(ipcMain.removeHandler).toHaveBeenCalledTimes(1);
  ipc.handle('test', operation);
  expect(handlers.size).toBe(1);
  ipc.dispose();
});

test('only the live main frame of the expected window and URL is trusted', () => {
  const frame = { url: 'https://renderer.test' };
  const sender = { mainFrame: frame };
  const window = {
    webContents: sender,
    isDestroyed: () => false
  } as unknown as BrowserWindow;
  const event = { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent;
  const allowed = (url: string) => url === frame.url;
  expect(assertTrustedRenderer(event, window, allowed)).toBe(window);
  for (const candidate of [
    { ...event, sender: {} },
    { ...event, senderFrame: null },
    { ...event, senderFrame: { url: frame.url } }
  ]) {
    expect(() =>
      assertTrustedRenderer(candidate as IpcMainInvokeEvent, window, allowed)
    ).toThrow('untrusted renderer');
  }
  expect(() => assertTrustedRenderer(event, null, allowed)).toThrow(
    'untrusted renderer'
  );
  expect(() => assertTrustedRenderer(event, window, () => false)).toThrow(
    'untrusted renderer'
  );
  expect(() =>
    assertTrustedRenderer(
      event,
      { ...window, isDestroyed: () => true } as BrowserWindow,
      allowed
    )
  ).toThrow('untrusted renderer');
});

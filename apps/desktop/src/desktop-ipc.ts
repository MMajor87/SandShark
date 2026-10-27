import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron';

const createDesktopIpc = (
  ipcMain: Pick<IpcMain, 'handle' | 'removeHandler'>,
  getSenderWindow: (event: IpcMainInvokeEvent) => BrowserWindow
) => {
  const channels = new Set<string>();
  const handle: IpcMain['handle'] = (channel, listener) => {
    if (channels.has(channel)) return;
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      getSenderWindow(event);
      return listener(event, ...args);
    });
    channels.add(channel);
  };
  const dispose = () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
    channels.clear();
  };
  return { handle, dispose, getSenderWindow };
};

type TDesktopIpc = ReturnType<typeof createDesktopIpc>;
export { createDesktopIpc, type TDesktopIpc };

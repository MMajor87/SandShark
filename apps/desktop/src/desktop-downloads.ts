import type { BrowserWindow, Session } from 'electron';
import { basename, join } from 'node:path';
import type {
  TDesktopDownloadProgress,
  TDesktopDownloadRequest
} from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';
import { isSafeExternalUrl } from './external-url.js';

const createDesktopDownloads = ({
  getMainWindow,
  downloadSession,
  runtime: { app, dialog, shell }
}: {
  getMainWindow: () => BrowserWindow | null;
  downloadSession: Session;
  runtime: Pick<typeof import('electron'), 'app' | 'dialog' | 'shell'>;
}) => {
  let registered = false;
  let generation = 0;
  const activeDownloads = new Map<
    Electron.DownloadItem,
    { ownerId: number; cleanup: () => void }
  >();
  type TPendingDownload = {
    id: string;
    filename: string;
    savePath: string;
    url: string;
  };
  const pendingDownloadsByWebContentsId = new Map<number, TPendingDownload[]>();
  const completedDownloads = new Map<string, string>();
  const sanitizeDownloadFilename = (value: string) => {
    const filename = basename(value)
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 180);

    return filename || 'download';
  };

  const isDesktopDownloadRequest = (
    value: unknown
  ): value is TDesktopDownloadRequest => {
    if (!value || typeof value !== 'object') return false;

    const request = value as Record<string, unknown>;

    return (
      isSafeExternalUrl(request.url) &&
      typeof request.filename === 'string' &&
      request.filename.length > 0 &&
      request.filename.length <= 512
    );
  };

  const isDownloadId = (value: unknown): value is string =>
    typeof value === 'string' && /^[a-z0-9-]{36}$/i.test(value);

  const sendDownloadProgress = (progress: TDesktopDownloadProgress) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.webContents.send('sandshark:download-progress', progress);
  };

  const configureDownloads = () => {
    if (registered) return;
    registered = true;
    downloadSession.on('will-download', onDownload);
  };
  const onDownload: Parameters<Electron.Session['on']>[1] = (
    _event: Electron.Event,
    item: Electron.DownloadItem,
    webContents: Electron.WebContents
  ) => {
    if (activeDownloads.has(item)) return;
    const pendingDownloads = pendingDownloadsByWebContentsId.get(
      webContents.id
    );
    if (!pendingDownloads?.length) return;

    const matchingIndex = pendingDownloads.findIndex(
      (download) =>
        download.url === item.getURL() ||
        item.getURLChain().includes(download.url)
    );
    if (matchingIndex < 0) return;
    const index = matchingIndex;
    const [download] = pendingDownloads.splice(index, 1);

    if (!download) return;
    if (pendingDownloads.length === 0) {
      pendingDownloadsByWebContentsId.delete(webContents.id);
    }

    item.setSavePath(download.savePath);
    sendDownloadProgress({
      id: download.id,
      filename: download.filename,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: 'progressing'
    });

    const updated = (_updatedEvent: Electron.Event, state: string) => {
      sendDownloadProgress({
        id: download.id,
        filename: download.filename,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state: state === 'interrupted' ? 'interrupted' : 'progressing'
      });
    };

    const done = (
      _doneEvent: Electron.Event,
      state: Electron.DownloadItem['getState'] extends () => infer S ? S : never
    ) => {
      cleanup();
      if (state === 'completed') {
        completedDownloads.set(download.id, download.savePath);
        while (completedDownloads.size > 32) {
          const oldestId = completedDownloads.keys().next().value;
          if (!oldestId) break;
          completedDownloads.delete(oldestId);
        }
      }

      sendDownloadProgress({
        id: download.id,
        filename: download.filename,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state
      });
    };
    const cleanup = () => {
      item.removeListener('updated', updated);
      item.removeListener('done', done);
      activeDownloads.delete(item);
    };
    activeDownloads.set(item, { ownerId: webContents.id, cleanup });
    item.on('updated', updated);
    item.once('done', done);
  };

  const releaseWindow = (ownerId: number) => {
    pendingDownloadsByWebContentsId.delete(ownerId);
    for (const [item, active] of activeDownloads) {
      if (active.ownerId !== ownerId) continue;
      active.cleanup();
      item.cancel();
    }
  };
  const dispose = () => {
    generation += 1;
    if (registered) downloadSession.removeListener('will-download', onDownload);
    registered = false;
    for (const [item, active] of activeDownloads) {
      active.cleanup();
      item.cancel();
    }
    pendingDownloadsByWebContentsId.clear();
    completedDownloads.clear();
  };
  const registerIpc = (ipc: TDesktopIpc) => {
    const { getSenderWindow } = ipc;
    ipc.handle('sandshark:download-file', async (event, request: unknown) => {
      const window = getSenderWindow(event);

      if (!isDesktopDownloadRequest(request)) {
        throw new Error('Invalid download request.');
      }

      const filename = sanitizeDownloadFilename(request.filename);
      const requestGeneration = generation;
      const result = await dialog.showSaveDialog(window, {
        title: 'Save download',
        defaultPath: join(app.getPath('downloads'), filename)
      });

      if (
        requestGeneration !== generation ||
        result.canceled ||
        !result.filePath ||
        window.isDestroyed() ||
        event.sender.isDestroyed()
      )
        return {};

      const id = crypto.randomUUID();
      const pendingDownloads =
        pendingDownloadsByWebContentsId.get(event.sender.id) ?? [];

      pendingDownloads.push({
        id,
        filename,
        savePath: result.filePath,
        url: request.url
      });
      pendingDownloadsByWebContentsId.set(event.sender.id, pendingDownloads);
      try {
        event.sender.downloadURL(request.url);
      } catch (error) {
        const index = pendingDownloads.findIndex(
          (download) => download.id === id
        );
        if (index >= 0) pendingDownloads.splice(index, 1);
        if (!pendingDownloads.length)
          pendingDownloadsByWebContentsId.delete(event.sender.id);
        throw error;
      }

      return { id };
    });
    ipc.handle('sandshark:open-downloaded-file', async (event, id: unknown) => {
      getSenderWindow(event);

      if (!isDownloadId(id) || !completedDownloads.has(id)) {
        throw new Error('The downloaded file is no longer available.');
      }

      const error = await shell.openPath(completedDownloads.get(id)!);
      if (error) throw new Error(error);
    });
    ipc.handle('sandshark:show-downloaded-file', (event, id: unknown) => {
      getSenderWindow(event);

      if (!isDownloadId(id) || !completedDownloads.has(id)) {
        throw new Error('The downloaded file is no longer available.');
      }

      shell.showItemInFolder(completedDownloads.get(id)!);
    });
  };
  return { configureDownloads, dispose, releaseWindow, registerIpc };
};
export { createDesktopDownloads };

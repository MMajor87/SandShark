import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

const assertTrustedRenderer = (
  event: IpcMainInvokeEvent,
  window: BrowserWindow | null,
  isAllowedUrl: (url: string) => boolean
) => {
  if (
    !window ||
    window.isDestroyed() ||
    event.sender !== window.webContents ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !isAllowedUrl(event.senderFrame.url)
  ) {
    throw new Error('Desktop action was requested by an untrusted renderer.');
  }
  return window;
};

export { assertTrustedRenderer };

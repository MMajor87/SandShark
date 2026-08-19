import { contextBridge, ipcRenderer } from 'electron';
import type {
  TSandSharkDesktopAPI,
  TDesktopDownloadProgress,
  TDesktopDownloadRequest,
  TDesktopCaptureDiagnostic,
  TApplicationAudioCapture,
  TDesktopLogDiagnostic,
  THardwareAccelerationSettings,
  TDesktopUpdateSettings,
  TDesktopUpdateStatus,
  TDesktopSecretRequest,
  TDesktopNotification,
  TDesktopNotificationTarget,
  TPushToTalkConfig,
  TTrayStatus,
  TWindowBehavior,
  TStartAtLoginSettings,
  TTaskbarStatus
} from './desktop-api.js';

const invoke = <T,>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload).catch((error: unknown) => {
    console.error(`Desktop action failed: ${channel}`, error);
    throw error instanceof Error
      ? error
      : new Error('The desktop action could not be completed.');
  });

const desktopApi: TSandSharkDesktopAPI = {
  getVersion: () => invoke<string>('sandshark:get-version'),
  minimize: () => invoke<void>('sandshark:minimize'),
  maximize: () => invoke<void>('sandshark:maximize'),
  close: () => invoke<void>('sandshark:close'),
  showNotification: (options: TDesktopNotification) =>
    invoke<void>('sandshark:show-notification', options),
  onNotificationClick: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      target: TDesktopNotificationTarget
    ) => listener(target);

    ipcRenderer.on('sandshark:notification-click', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:notification-click', handler);
    };
  },
  openExternal: (url: string) => invoke<void>('sandshark:open-external', url),
  getDesktopCaptureSources: () =>
    invoke('sandshark:get-desktop-capture-sources'),
  setDesktopCaptureSource: (sourceId: string) =>
    invoke<void>('sandshark:set-desktop-capture-source', sourceId),
  startApplicationAudioCapture: (sourceId: string) =>
    invoke<TApplicationAudioCapture>(
      'sandshark:start-application-audio-capture',
      sourceId
    ),
  stopApplicationAudioCapture: () =>
    invoke<void>('sandshark:stop-application-audio-capture'),
  onApplicationAudioData: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      captureId: unknown,
      data: unknown
    ) => {
      if (typeof captureId !== 'string' || !(data instanceof Uint8Array)) return;

      listener(captureId, data);
    };

    ipcRenderer.on('sandshark:application-audio-data', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:application-audio-data', handler);
    };
  },
  reportDesktopCaptureDiagnostic: (diagnostic: TDesktopCaptureDiagnostic) =>
    invoke<void>('sandshark:report-desktop-capture-diagnostic', diagnostic),
  showDesktopCaptureLog: () =>
    invoke<void>('sandshark:show-desktop-capture-log'),
  reportDesktopDiagnostic: (diagnostic: TDesktopLogDiagnostic) =>
    invoke<void>('sandshark:report-desktop-diagnostic', diagnostic),
  openLogFolder: () => invoke<void>('sandshark:open-log-folder'),
  setPushToTalk: (config: TPushToTalkConfig) =>
    invoke('sandshark:set-push-to-talk', config),
  clearPushToTalk: () => invoke<void>('sandshark:clear-push-to-talk'),
  onPushToTalk: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, active: unknown) => {
      if (typeof active === 'boolean') listener(active);
    };

    ipcRenderer.on('sandshark:push-to-talk', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:push-to-talk', handler);
    };
  },
  setTrayStatus: (status: TTrayStatus) =>
    invoke<void>('sandshark:set-tray-status', status),
  onTrayAction: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, action: unknown) => {
      if (action === 'toggle-mic' || action === 'toggle-sound') {
        listener(action);
      }
    };

    ipcRenderer.on('sandshark:tray-action', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:tray-action', handler);
    };
  },
  setTaskbarStatus: (status: TTaskbarStatus) =>
    invoke<void>('sandshark:set-taskbar-status', status),
  flashTaskbar: () => invoke<void>('sandshark:flash-taskbar'),
  getWindowBehavior: () =>
    invoke<TWindowBehavior>('sandshark:get-window-behavior'),
  setWindowBehavior: (behavior: TWindowBehavior) =>
    invoke<void>('sandshark:set-window-behavior', behavior),
  getStartAtLogin: () =>
    invoke<TStartAtLoginSettings>('sandshark:get-start-at-login'),
  setStartAtLogin: (enabled: boolean) =>
    invoke<TStartAtLoginSettings>('sandshark:set-start-at-login', enabled),
  getHardwareAcceleration: () =>
    invoke<THardwareAccelerationSettings>(
      'sandshark:get-hardware-acceleration'
    ),
  setHardwareAcceleration: (enabled: boolean) =>
    invoke<THardwareAccelerationSettings>(
      'sandshark:set-hardware-acceleration',
      enabled
    ),
  getUpdateSettings: () =>
    invoke<TDesktopUpdateSettings>('sandshark:get-update-settings'),
  setUpdateSettings: (settings: TDesktopUpdateSettings) =>
    invoke<TDesktopUpdateSettings>('sandshark:set-update-settings', settings),
  getUpdateStatus: () =>
    invoke<TDesktopUpdateStatus>('sandshark:get-update-status'),
  checkForUpdates: () =>
    invoke<TDesktopUpdateStatus>('sandshark:check-for-updates'),
  downloadUpdate: () =>
    invoke<TDesktopUpdateStatus>('sandshark:download-update'),
  installUpdate: () => invoke<void>('sandshark:install-update'),
  onUpdateStatus: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => {
      if (!status || typeof status !== 'object') return;

      listener(status as TDesktopUpdateStatus);
    };

    ipcRenderer.on('sandshark:update-status', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:update-status', handler);
    };
  },
  getSecret: (key: string) =>
    invoke<string | undefined>('sandshark:get-secret', key),
  setSecret: (request: TDesktopSecretRequest) =>
    invoke<boolean>('sandshark:set-secret', request),
  removeSecret: (key: string) => invoke<void>('sandshark:remove-secret', key),
  readyForDeepLinks: () => invoke<string[]>('sandshark:ready-for-deep-links'),
  onDeepLink: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, url: unknown) => {
      if (typeof url === 'string') listener(url);
    };

    ipcRenderer.on('sandshark:deep-link', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:deep-link', handler);
    };
  },
  downloadFile: (request: TDesktopDownloadRequest) =>
    invoke<{ id?: string }>('sandshark:download-file', request),
  onDownloadProgress: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: TDesktopDownloadProgress
    ) => listener(progress);

    ipcRenderer.on('sandshark:download-progress', handler);

    return () => {
      ipcRenderer.removeListener('sandshark:download-progress', handler);
    };
  },
  openDownloadedFile: (id: string) =>
    invoke<void>('sandshark:open-downloaded-file', id),
  showDownloadedFile: (id: string) =>
    invoke<void>('sandshark:show-downloaded-file', id)
};

contextBridge.exposeInMainWorld('sandSharkDesktop', desktopApi);

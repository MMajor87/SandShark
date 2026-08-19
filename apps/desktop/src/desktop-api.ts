export type TDesktopNotification = {
  title: string;
  body?: string;
  silent?: boolean;
  target?: TDesktopNotificationTarget;
};

export type TDesktopNotificationTarget = {
  profileId?: string;
  channelId: number;
  messageId: number;
  isDm: boolean;
};

export type TDesktopCaptureSource = {
  id: string;
  name: string;
  type: 'screen' | 'window';
  thumbnailDataUrl?: string;
};

export type TDesktopCaptureDiagnostic = {
  stage: string;
  details?: Record<string, boolean | number | string | undefined>;
};

export type TApplicationAudioCapture = {
  active: boolean;
  captureId?: string;
  sampleRate?: number;
  channels?: number;
  format?: 'f32' | 's16';
  reason?: string;
};

export type TDesktopLogDiagnostic = {
  category: string;
  message: string;
  details?: Record<string, boolean | number | string | undefined>;
};

export type TPushToTalkConfig = {
  input:
    | {
        type: 'keyboard';
        keyCode: number;
      }
    | {
        type: 'mouse';
        button: number;
      };
  modifiers: {
    control: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
};

export type TPushToTalkRegistration = {
  registered: boolean;
  error?: string;
};

export type TTrayStatus = {
  serverName?: string;
  micMuted: boolean;
  soundMuted: boolean;
  unreadCount: number;
};

export type TTrayAction = 'toggle-mic' | 'toggle-sound';

export type TTaskbarStatus = {
  unreadCount: number;
  mentionCount: number;
};

export type TWindowBehavior = {
  closeToTray: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
};

export type TStartAtLoginSettings = {
  enabled: boolean;
  supported: boolean;
};

export type THardwareAccelerationSettings = {
  enabled: boolean;
  restartRequired: boolean;
};

export type TDesktopUpdateSettings = {
  automaticallyCheck: boolean;
  automaticallyDownload: boolean;
};

export type TDesktopUpdateStatus = {
  state:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'unsupported';
  version?: string;
  percent?: number;
  message?: string;
};

export type TDesktopSecretRequest = {
  key: string;
  value: string;
};

export type TDesktopDownloadRequest = {
  url: string;
  filename: string;
};

export type TDesktopDownloadProgress = {
  id: string;
  filename: string;
  receivedBytes: number;
  totalBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
};

export type TSandSharkDesktopAPI = {
  getVersion: () => Promise<string>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  showNotification: (options: TDesktopNotification) => Promise<void>;
  onNotificationClick: (
    listener: (target: TDesktopNotificationTarget) => void
  ) => () => void;
  openExternal: (url: string) => Promise<void>;
  getDesktopCaptureSources: () => Promise<TDesktopCaptureSource[]>;
  setDesktopCaptureSource: (sourceId: string) => Promise<void>;
  startApplicationAudioCapture: (
    sourceId: string
  ) => Promise<TApplicationAudioCapture>;
  stopApplicationAudioCapture: () => Promise<void>;
  onApplicationAudioData: (
    listener: (captureId: string, data: Uint8Array) => void
  ) => () => void;
  reportDesktopCaptureDiagnostic: (
    diagnostic: TDesktopCaptureDiagnostic
  ) => Promise<void>;
  showDesktopCaptureLog: () => Promise<void>;
  reportDesktopDiagnostic: (diagnostic: TDesktopLogDiagnostic) => Promise<void>;
  openLogFolder: () => Promise<void>;
  setPushToTalk: (
    config: TPushToTalkConfig
  ) => Promise<TPushToTalkRegistration>;
  clearPushToTalk: () => Promise<void>;
  onPushToTalk: (listener: (active: boolean) => void) => () => void;
  setTrayStatus: (status: TTrayStatus) => Promise<void>;
  onTrayAction: (listener: (action: TTrayAction) => void) => () => void;
  setTaskbarStatus: (status: TTaskbarStatus) => Promise<void>;
  flashTaskbar: () => Promise<void>;
  getWindowBehavior: () => Promise<TWindowBehavior>;
  setWindowBehavior: (behavior: TWindowBehavior) => Promise<void>;
  getStartAtLogin: () => Promise<TStartAtLoginSettings>;
  setStartAtLogin: (enabled: boolean) => Promise<TStartAtLoginSettings>;
  getHardwareAcceleration: () => Promise<THardwareAccelerationSettings>;
  setHardwareAcceleration: (
    enabled: boolean
  ) => Promise<THardwareAccelerationSettings>;
  getUpdateSettings: () => Promise<TDesktopUpdateSettings>;
  setUpdateSettings: (
    settings: TDesktopUpdateSettings
  ) => Promise<TDesktopUpdateSettings>;
  getUpdateStatus: () => Promise<TDesktopUpdateStatus>;
  checkForUpdates: () => Promise<TDesktopUpdateStatus>;
  downloadUpdate: () => Promise<TDesktopUpdateStatus>;
  installUpdate: () => Promise<void>;
  onUpdateStatus: (
    listener: (status: TDesktopUpdateStatus) => void
  ) => () => void;
  getSecret: (key: string) => Promise<string | undefined>;
  setSecret: (request: TDesktopSecretRequest) => Promise<boolean>;
  removeSecret: (key: string) => Promise<void>;
  readyForDeepLinks: () => Promise<string[]>;
  onDeepLink: (listener: (url: string) => void) => () => void;
  downloadFile: (request: TDesktopDownloadRequest) => Promise<{ id?: string }>;
  onDownloadProgress: (
    listener: (progress: TDesktopDownloadProgress) => void
  ) => () => void;
  openDownloadedFile: (id: string) => Promise<void>;
  showDownloadedFile: (id: string) => Promise<void>;
};

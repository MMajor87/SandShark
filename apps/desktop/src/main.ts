import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  shell,
  Tray,
  screen,
  safeStorage,
  type IpcMainInvokeEvent
} from 'electron';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  uIOhook,
  type UiohookKeyboardEvent,
  type UiohookMouseEvent
} from 'uiohook-napi';
import type {
  TDesktopCaptureSource,
  TDesktopCaptureDiagnostic,
  TDesktopLogDiagnostic,
  TDesktopDownloadProgress,
  TDesktopDownloadRequest,
  THardwareAccelerationSettings,
  TDesktopUpdateSettings,
  TDesktopUpdateStatus,
  TDesktopSecretRequest,
  TDesktopNotification,
  TDesktopNotificationTarget,
  TPushToTalkConfig,
  TPushToTalkRegistration,
  TStartAtLoginSettings,
  TTaskbarStatus,
  TTrayStatus,
  TWindowBehavior
} from './desktop-api.js';

app.setName('SandShark');
app.setAppUserModelId('com.sandshark.desktop');

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;
const developmentRendererUrl =
  process.env.SANDSHARK_RENDERER_URL ?? 'http://127.0.0.1:5173';
const smokeTestUserDataArgPrefix = '--sandshark-smoke-user-data-dir=';
const smokeTestUserDataDir = process.argv
  .find((arg) => arg.startsWith(smokeTestUserDataArgPrefix))
  ?.slice(smokeTestUserDataArgPrefix.length);

if (smokeTestUserDataDir) {
  app.setPath('userData', smokeTestUserDataDir);
}

const desktopIconPath = isDevelopment
  ? join(currentDirectory, '../sandshark.png')
  : undefined;
const trayIconPath = isDevelopment
  ? join(currentDirectory, '../sandshark.png')
  : join(process.resourcesPath, 'sandshark.png');
const startAtLoginArgs = ['--sandshark-start-minimized'];
const isStartAtLoginSupported = process.platform === 'win32';
const deepLinkSchemes = ['sandshark', 'sharkord'];
const youtubeDesktopReferrer = 'https://sandshark.localhost/';
const crashRecoveryWindowMs = 60_000;
const maximumCrashRecoveryReloads = 2;

const getDesktopPreferencesPath = () =>
  join(app.getPath('userData'), 'desktop-preferences.json');
const getDesktopSecretsPath = () =>
  join(app.getPath('userData'), 'desktop-secrets.json');
const getDesktopCaptureLogPath = () =>
  join(app.getPath('logs'), 'screen-capture.log');
const getChromiumMediaLogPath = () =>
  join(app.getPath('logs'), 'chromium-media.log');
const getDesktopAppLogPath = () => join(app.getPath('logs'), 'sandshark.log');

type TDesktopLogDetails = Record<string, boolean | number | string | undefined>;

const sensitiveLogKeyPattern =
  /(token|secret|password|authorization|cookie|session|credential|key)/i;
const messageContentLogKeyPattern = /(message|content|body|text|markdown)/i;

const sanitizeLogDetails = (details: TDesktopLogDetails = {}) =>
  Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (value === undefined) return [key, undefined];
      if (sensitiveLogKeyPattern.test(key)) return [key, '[redacted]'];
      if (messageContentLogKeyPattern.test(key)) return [key, '[omitted]'];
      if (typeof value === 'string') return [key, value.slice(0, 2_000)];

      return [key, value];
    })
  );

const writeDesktopLog = (
  category: string,
  message: string,
  details: TDesktopLogDetails = {}
) => {
  try {
    const logPath = getDesktopAppLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(
      logPath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        category,
        message,
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        chromiumVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
        platform: process.platform,
        isPackaged: app.isPackaged,
        details: sanitizeLogDetails(details)
      })}\n`,
      'utf8'
    );
  } catch (error) {
    console.error('SandShark could not write desktop diagnostics.', error);
  }
};

const ensureLogFiles = () => {
  try {
    const logDirectory = app.getPath('logs');
    mkdirSync(logDirectory, { recursive: true });
    for (const logPath of [
      getDesktopAppLogPath(),
      getDesktopCaptureLogPath(),
      getChromiumMediaLogPath()
    ]) {
      if (!existsSync(logPath)) writeFileSync(logPath, '', 'utf8');
    }
  } catch (error) {
    console.error('SandShark could not create log files.', error);
  }
};

// Chromium reduces native audio-device startup failures to a generic DOM error.
// Keep its verbose output narrowly scoped to media components for diagnosis.
try {
  const chromiumMediaLogPath = getChromiumMediaLogPath();
  mkdirSync(dirname(chromiumMediaLogPath), { recursive: true });
  if (!existsSync(chromiumMediaLogPath)) {
    writeFileSync(chromiumMediaLogPath, '', 'utf8');
  }
  app.commandLine.appendSwitch('enable-logging', 'file');
  app.commandLine.appendSwitch('log-file', chromiumMediaLogPath);
  app.commandLine.appendSwitch(
    'vmodule',
    'audio*=2,media*=2,media_stream*=2,webrtc*=2'
  );
} catch (error) {
  console.error(
    'SandShark could not configure Chromium media diagnostics.',
    error
  );
}

const writeDesktopCaptureDiagnostic = (
  stage: string,
  details: Record<string, boolean | number | string | undefined> = {}
) => {
  writeDesktopLog('screen-capture', stage, details);

  try {
    const logPath = getDesktopCaptureLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(
      logPath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        version: app.getVersion(),
        platform: process.platform,
        stage,
        ...sanitizeLogDetails(details)
      })}\n`,
      'utf8'
    );
  } catch (error) {
    console.error(
      'SandShark could not write screen capture diagnostics.',
      error
    );
  }
};

const isDesktopCaptureDiagnostic = (
  value: unknown
): value is TDesktopCaptureDiagnostic => {
  if (!value || typeof value !== 'object') return false;

  const diagnostic = value as Record<string, unknown>;

  if (
    typeof diagnostic.stage !== 'string' ||
    diagnostic.stage.length === 0 ||
    diagnostic.stage.length > 128
  ) {
    return false;
  }

  if (diagnostic.details === undefined) return true;
  if (!diagnostic.details || typeof diagnostic.details !== 'object')
    return false;

  return Object.entries(diagnostic.details as Record<string, unknown>).every(
    ([key, detail]) =>
      key.length <= 128 &&
      (typeof detail === 'string'
        ? detail.length <= 2_000
        : typeof detail === 'boolean' ||
          (typeof detail === 'number' && Number.isFinite(detail)) ||
          detail === undefined)
  );
};

const isDesktopSecretKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 512 &&
  !/[\x00-\x1f]/.test(value);

const isDesktopSecretRequest = (
  value: unknown
): value is TDesktopSecretRequest => {
  if (!value || typeof value !== 'object') return false;

  const request = value as Record<string, unknown>;

  return (
    isDesktopSecretKey(request.key) &&
    typeof request.value === 'string' &&
    request.value.length <= 4096
  );
};

const isDesktopUpdateSettings = (
  value: unknown
): value is TDesktopUpdateSettings => {
  if (!value || typeof value !== 'object') return false;

  const settings = value as Record<string, unknown>;

  return (
    typeof settings.automaticallyCheck === 'boolean' &&
    typeof settings.automaticallyDownload === 'boolean'
  );
};

const getDesktopSecrets = () => {
  try {
    const value = JSON.parse(
      readFileSync(getDesktopSecretsPath(), 'utf8')
    ) as unknown;
    return value && typeof value === 'object'
      ? (value as Record<string, string>)
      : {};
  } catch {
    return {} as Record<string, string>;
  }
};

const saveDesktopSecrets = (secrets: Record<string, string>) => {
  writeFileSync(getDesktopSecretsPath(), JSON.stringify(secrets), 'utf8');
};

const getDesktopSecret = (key: string) => {
  if (!safeStorage.isEncryptionAvailable()) return undefined;

  try {
    const value = getDesktopSecrets()[key];
    return value
      ? safeStorage.decryptString(Buffer.from(value, 'base64'))
      : undefined;
  } catch {
    return undefined;
  }
};

const setDesktopSecret = (key: string, value: string) => {
  if (!safeStorage.isEncryptionAvailable()) return false;

  const secrets = getDesktopSecrets();
  secrets[key] = safeStorage.encryptString(value).toString('base64');
  saveDesktopSecrets(secrets);
  return true;
};

const removeDesktopSecret = (key: string) => {
  const secrets = getDesktopSecrets();
  if (!(key in secrets)) return;
  delete secrets[key];
  saveDesktopSecrets(secrets);
};

type TDesktopPreferences = {
  hardwareAccelerationEnabled?: boolean;
  updateSettings?: Partial<TDesktopUpdateSettings>;
};

const loadDesktopPreferences = (): TDesktopPreferences => {
  try {
    const preferences = JSON.parse(
      readFileSync(getDesktopPreferencesPath(), 'utf8')
    ) as unknown;

    return preferences && typeof preferences === 'object'
      ? (preferences as TDesktopPreferences)
      : {};
  } catch {
    return {};
  }
};

let desktopPreferences = loadDesktopPreferences();
let hardwareAccelerationEnabled =
  desktopPreferences.hardwareAccelerationEnabled !== false;
const hardwareAccelerationEnabledAtLaunch = hardwareAccelerationEnabled;

if (!hardwareAccelerationEnabled) app.disableHardwareAcceleration();

const saveHardwareAccelerationEnabled = () => {
  try {
    desktopPreferences = {
      ...desktopPreferences,
      hardwareAccelerationEnabled
    };
    writeFileSync(
      getDesktopPreferencesPath(),
      JSON.stringify(desktopPreferences),
      'utf8'
    );
  } catch {
    console.warn(
      'SandShark hardware acceleration preference could not be saved.'
    );
  }
};

const getHardwareAccelerationSettings = (): THardwareAccelerationSettings => ({
  enabled: hardwareAccelerationEnabled,
  restartRequired:
    hardwareAccelerationEnabled !== hardwareAccelerationEnabledAtLaunch
});

const DEFAULT_UPDATE_SETTINGS: TDesktopUpdateSettings = {
  automaticallyCheck: true,
  automaticallyDownload: false
};
let updateSettings: TDesktopUpdateSettings = {
  ...DEFAULT_UPDATE_SETTINGS,
  ...desktopPreferences.updateSettings
};

const isDesktopLogDiagnostic = (
  value: unknown
): value is TDesktopLogDiagnostic => {
  if (!value || typeof value !== 'object') return false;

  const diagnostic = value as Record<string, unknown>;

  if (
    typeof diagnostic.category !== 'string' ||
    diagnostic.category.length === 0 ||
    diagnostic.category.length > 64 ||
    !/^[a-z0-9-]+$/i.test(diagnostic.category)
  ) {
    return false;
  }

  if (
    typeof diagnostic.message !== 'string' ||
    diagnostic.message.length === 0 ||
    diagnostic.message.length > 256
  ) {
    return false;
  }

  if (diagnostic.details === undefined) return true;
  if (!diagnostic.details || typeof diagnostic.details !== 'object')
    return false;

  return Object.entries(diagnostic.details as Record<string, unknown>).every(
    ([key, detail]) =>
      key.length <= 128 &&
      (typeof detail === 'string'
        ? detail.length <= 2_000
        : typeof detail === 'boolean' ||
          (typeof detail === 'number' && Number.isFinite(detail)) ||
          detail === undefined)
  );
};
let updateStatus: TDesktopUpdateStatus = {
  state: 'unsupported',
  message:
    'Automatic updates are not configured for this private SandShark build.'
};
let autoUpdaterConfigured = false;

const saveUpdateSettings = () => {
  try {
    desktopPreferences = { ...desktopPreferences, updateSettings };
    writeFileSync(
      getDesktopPreferencesPath(),
      JSON.stringify(desktopPreferences),
      'utf8'
    );
  } catch {
    console.warn('SandShark update preferences could not be saved.');
  }
};

const publishUpdateStatus = (status: TDesktopUpdateStatus) => {
  if (status.state === 'error') {
    writeDesktopLog('updates', 'Update failure', {
      state: status.state,
      version: status.version,
      percent: status.percent,
      message: status.message
    });
  }

  updateStatus = status;
  mainWindow?.webContents.send('sandshark:update-status', status);
};

const configureAutoUpdater = () => {
  if (autoUpdaterConfigured) return;
  autoUpdaterConfigured = true;

  publishUpdateStatus(updateStatus);
};

const checkForUpdates = async (): Promise<TDesktopUpdateStatus> => {
  configureAutoUpdater();
  writeDesktopLog('updates', 'Update check requested', {
    state: updateStatus.state
  });
  return updateStatus;
};

const downloadUpdate = async (): Promise<TDesktopUpdateStatus> => {
  configureAutoUpdater();
  writeDesktopLog('updates', 'Update download requested', {
    state: updateStatus.state
  });
  return updateStatus;
};

const addDesktopRendererParams = (rendererUrl: string) => {
  const url = new URL(rendererUrl);
  url.searchParams.set('desktop', '1');
  url.searchParams.set('desktopVersion', app.getVersion());

  return url.toString();
};

const getDevelopmentRendererUrl = () =>
  addDesktopRendererParams(developmentRendererUrl);

const getPackagedRendererUrl = () =>
  addDesktopRendererParams(
    pathToFileURL(
      join(process.resourcesPath, 'renderer', 'index.html')
    ).toString()
  );

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let selectedDesktopCaptureSourceId: string | undefined;
let deepLinkRendererReady = false;
let pendingDeepLinks: string[] = [];
let crashRecoveryDialogVisible = false;
let crashRecoveryReloads: number[] = [];
type TPendingDownload = {
  id: string;
  filename: string;
  savePath: string;
  url: string;
};
const pendingDownloadsByWebContentsId = new Map<number, TPendingDownload[]>();
const completedDownloads = new Map<string, string>();
let pushToTalkConfig: TPushToTalkConfig | undefined;
let pushToTalkIsHeld = false;
let globalInputHookStarted = false;
let trayStatus: TTrayStatus = {
  micMuted: false,
  soundMuted: false,
  unreadCount: 0
};
let taskbarStatus: TTaskbarStatus = {
  unreadCount: 0,
  mentionCount: 0
};
const DEFAULT_WINDOW_BEHAVIOR: TWindowBehavior = {
  closeToTray: false,
  minimizeToTray: false,
  startMinimized: false
};
type TStoredWindowState = TWindowBehavior & {
  bounds?: Electron.Rectangle;
  maximized: boolean;
};
let windowState: TStoredWindowState = {
  ...DEFAULT_WINDOW_BEHAVIOR,
  maximized: false
};
let saveWindowStateTimer: ReturnType<typeof setTimeout> | undefined;

const openDesktopLogFolder = async () => {
  ensureLogFiles();

  const error = await shell.openPath(app.getPath('logs'));
  if (error) throw new Error(error);
};

const canReloadAfterCrash = () => {
  const now = Date.now();
  crashRecoveryReloads = crashRecoveryReloads.filter(
    (timestamp) => now - timestamp < crashRecoveryWindowMs
  );

  return crashRecoveryReloads.length < maximumCrashRecoveryReloads;
};

const showCrashRecoveryDialog = async (
  process: 'renderer' | 'gpu',
  details: TDesktopLogDetails
) => {
  if (crashRecoveryDialogVisible) return;

  crashRecoveryDialogVisible = true;
  const reloadAvailable = canReloadAfterCrash();
  const buttons = reloadAvailable
    ? ['Reload SandShark', 'Open log folder', 'Close SandShark']
    : ['Open log folder', 'Close SandShark'];
  const closeButtonIndex = buttons.length - 1;
  const targetWindow =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;

  try {
    const result = targetWindow
      ? await dialog.showMessageBox(targetWindow, {
          type: 'error',
          title: 'SandShark needs to recover',
          message:
            process === 'renderer'
              ? 'The SandShark interface stopped unexpectedly.'
              : 'The graphics process stopped unexpectedly.',
          detail: reloadAvailable
            ? 'Your local diagnostic logs have been preserved. You can reload SandShark or open the log folder for troubleshooting.'
            : 'SandShark has already attempted to recover twice in the last minute. Its logs have been preserved; close the app to avoid a restart loop.',
          buttons,
          defaultId: reloadAvailable ? 0 : closeButtonIndex,
          cancelId: closeButtonIndex,
          noLink: true
        })
      : await dialog.showMessageBox({
          type: 'error',
          title: 'SandShark needs to recover',
          message:
            process === 'renderer'
              ? 'The SandShark interface stopped unexpectedly.'
              : 'The graphics process stopped unexpectedly.',
          detail: reloadAvailable
            ? 'Your local diagnostic logs have been preserved. You can reload SandShark or open the log folder for troubleshooting.'
            : 'SandShark has already attempted to recover twice in the last minute. Its logs have been preserved; close the app to avoid a restart loop.',
          buttons,
          defaultId: reloadAvailable ? 0 : closeButtonIndex,
          cancelId: closeButtonIndex,
          noLink: true
        });

    if (result.response === buttons.indexOf('Open log folder')) {
      writeDesktopLog('crash-recovery', 'Crash log folder opened', {
        process,
        ...details
      });
      await openDesktopLogFolder();
      setTimeout(() => {
        void showCrashRecoveryDialog(process, details);
      }, 0);
      return;
    }

    if (reloadAvailable && result.response === 0) {
      crashRecoveryReloads.push(Date.now());
      writeDesktopLog('crash-recovery', 'Reload requested after crash', {
        process,
        ...details
      });
      deepLinkRendererReady = false;
      mainWindow?.webContents.reloadIgnoringCache();
      return;
    }

    writeDesktopLog('crash-recovery', 'App closed after crash', {
      process,
      ...details
    });
    app.quit();
  } catch (error) {
    writeDesktopLog('crash-recovery', 'Crash recovery dialog failed', {
      process,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    crashRecoveryDialogVisible = false;
  }
};

const getWindowStatePath = () =>
  join(app.getPath('userData'), 'window-state.json');

const isWindowBehavior = (value: unknown): value is TWindowBehavior => {
  if (!value || typeof value !== 'object') return false;

  const behavior = value as Record<string, unknown>;

  return (
    typeof behavior.closeToTray === 'boolean' &&
    typeof behavior.minimizeToTray === 'boolean' &&
    typeof behavior.startMinimized === 'boolean'
  );
};

const isRectangle = (value: unknown): value is Electron.Rectangle => {
  if (!value || typeof value !== 'object') return false;

  const bounds = value as Record<string, unknown>;

  return ['x', 'y', 'width', 'height'].every(
    (key) => typeof bounds[key] === 'number' && Number.isFinite(bounds[key])
  );
};

const loadWindowState = () => {
  try {
    const statePath = getWindowStatePath();
    if (!existsSync(statePath)) return;

    const value = JSON.parse(readFileSync(statePath, 'utf8')) as unknown;
    if (!value || typeof value !== 'object') return;

    const state = value as Record<string, unknown>;
    const storedState = value as Record<string, unknown>;
    if (!isWindowBehavior(state)) return;

    windowState = {
      closeToTray: state.closeToTray,
      minimizeToTray: state.minimizeToTray,
      startMinimized: state.startMinimized,
      bounds: isRectangle(storedState.bounds) ? storedState.bounds : undefined,
      maximized: storedState.maximized === true
    };
  } catch {
    console.warn('SandShark window state could not be restored.');
  }
};

const saveWindowState = () => {
  try {
    writeFileSync(getWindowStatePath(), JSON.stringify(windowState), 'utf8');
  } catch {
    console.warn('SandShark window state could not be saved.');
  }
};

const scheduleWindowStateSave = () => {
  if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);

  saveWindowStateTimer = setTimeout(() => {
    saveWindowStateTimer = undefined;
    saveWindowState();
  }, 250);
};

const getRestoredBounds = (): Electron.Rectangle | undefined => {
  const bounds = windowState.bounds;
  if (!bounds) return undefined;

  const display = screen.getAllDisplays().find((candidate) => {
    const area = candidate.workArea;
    const overlapWidth = Math.max(
      0,
      Math.min(bounds.x + bounds.width, area.x + area.width) -
        Math.max(bounds.x, area.x)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(bounds.y + bounds.height, area.y + area.height) -
        Math.max(bounds.y, area.y)
    );

    return overlapWidth * overlapHeight >= 10_000;
  });

  if (!display) return undefined;

  const workArea = display.workArea;
  const width = Math.min(Math.max(bounds.width, 960), workArea.width);
  const height = Math.min(Math.max(bounds.height, 640), workArea.height);

  return {
    x: Math.min(
      Math.max(bounds.x, workArea.x),
      workArea.x + workArea.width - width
    ),
    y: Math.min(
      Math.max(bounds.y, workArea.y),
      workArea.y + workArea.height - height
    ),
    width,
    height
  };
};

const getStartAtLoginSettings = (): TStartAtLoginSettings => {
  if (!isStartAtLoginSupported) {
    return { enabled: false, supported: false };
  }

  const settings = app.getLoginItemSettings({
    path: process.execPath,
    args: startAtLoginArgs
  });

  return { enabled: settings.openAtLogin, supported: true };
};

const setStartAtLogin = (enabled: boolean): TStartAtLoginSettings => {
  if (!isStartAtLoginSupported) {
    return { enabled: false, supported: false };
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: startAtLoginArgs
  });

  return getStartAtLoginSettings();
};

const showMainWindow = () => {
  if (!mainWindow) {
    void createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const getTrayTooltip = () => {
  const serverName = trayStatus.serverName?.trim();
  const unreadSuffix =
    trayStatus.unreadCount > 0
      ? ` (${trayStatus.unreadCount.toLocaleString()} unread)`
      : '';
  const tooltip = serverName
    ? `SandShark - ${serverName}${unreadSuffix}`
    : `SandShark${unreadSuffix}`;

  return tooltip.slice(0, 127);
};

const getTaskbarOverlayIcon = (count: number, color: string) => {
  const label = count > 99 ? '99+' : count.toString();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="${color}"/><text x="16" y="21" fill="#ffffff" font-family="Segoe UI, sans-serif" font-size="${
    label.length > 2 ? '11' : '15'
  }" font-weight="700" text-anchor="middle">${label}</text></svg>`;

  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  );
};

const updateTaskbar = () => {
  if (process.platform !== 'win32' || !mainWindow) return;

  const count = taskbarStatus.mentionCount || taskbarStatus.unreadCount;
  if (count === 0) {
    mainWindow.setOverlayIcon(null, '');
    return;
  }

  const isMention = taskbarStatus.mentionCount > 0;
  mainWindow.setOverlayIcon(
    getTaskbarOverlayIcon(count, isMention ? '#dc2626' : '#2563eb'),
    isMention
      ? `${count.toLocaleString()} unread mention${count === 1 ? '' : 's'}`
      : `${count.toLocaleString()} unread message${count === 1 ? '' : 's'}`
  );
};

const updateTray = () => {
  if (!tray) return;

  tray.setToolTip(getTrayTooltip());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open SandShark', click: showMainWindow },
      { type: 'separator' },
      {
        label: 'Mute Microphone',
        type: 'checkbox',
        checked: trayStatus.micMuted,
        click: () => {
          mainWindow?.webContents.send('sandshark:tray-action', 'toggle-mic');
        }
      },
      {
        label: 'Deafen',
        type: 'checkbox',
        checked: trayStatus.soundMuted,
        click: () => {
          mainWindow?.webContents.send('sandshark:tray-action', 'toggle-sound');
        }
      },
      { type: 'separator' },
      {
        label: trayStatus.serverName
          ? `Server: ${trayStatus.serverName}`
          : 'No server connected',
        enabled: false
      },
      ...(trayStatus.unreadCount > 0
        ? [
            {
              label: `${trayStatus.unreadCount.toLocaleString()} unread message${
                trayStatus.unreadCount === 1 ? '' : 's'
              }`,
              enabled: false
            }
          ]
        : []),
      { type: 'separator' },
      { label: 'Quit SandShark', click: () => app.quit() }
    ])
  );
};

const createTray = () => {
  if (tray) return;

  const icon = nativeImage.createFromPath(trayIconPath);

  if (icon.isEmpty()) {
    console.warn('SandShark tray icon could not be loaded.');
    return;
  }

  tray = new Tray(icon);
  tray.on('click', showMainWindow);
  updateTray();
};

const isPushToTalkConfig = (value: unknown): value is TPushToTalkConfig => {
  if (!value || typeof value !== 'object') return false;

  const config = value as Record<string, unknown>;

  const input = config.input as Record<string, unknown> | undefined;
  const modifiers = config.modifiers as Record<string, unknown> | undefined;

  const hasValidModifiers =
    !!modifiers &&
    ['control', 'shift', 'alt', 'meta'].every(
      (key) => typeof modifiers[key] === 'boolean'
    );

  if (!input || !hasValidModifiers) return false;

  if (input.type === 'keyboard') {
    return (
      typeof input.keyCode === 'number' &&
      Number.isInteger(input.keyCode) &&
      input.keyCode > 0 &&
      input.keyCode <= 65_535
    );
  }

  return (
    input.type === 'mouse' &&
    typeof input.button === 'number' &&
    Number.isInteger(input.button) &&
    input.button >= 1 &&
    input.button <= 5
  );
};

const sendPushToTalkState = (active: boolean) => {
  if (pushToTalkIsHeld === active) return;

  pushToTalkIsHeld = active;
  mainWindow?.webContents.send('sandshark:push-to-talk', active);
};

const handleGlobalKeyDown = (event: UiohookKeyboardEvent) => {
  if (
    pushToTalkConfig?.input.type === 'keyboard' &&
    event.keycode === pushToTalkConfig.input.keyCode &&
    hasMatchingModifiers(event)
  ) {
    sendPushToTalkState(true);
  }
};

const handleGlobalKeyUp = (event: UiohookKeyboardEvent) => {
  if (
    pushToTalkConfig?.input.type === 'keyboard' &&
    event.keycode === pushToTalkConfig.input.keyCode
  ) {
    sendPushToTalkState(false);
  }
};

const hasMatchingModifiers = (
  event: Pick<
    UiohookKeyboardEvent | UiohookMouseEvent,
    'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
  >
) => {
  const modifiers = pushToTalkConfig?.modifiers;

  return (
    !!modifiers &&
    event.ctrlKey === modifiers.control &&
    event.shiftKey === modifiers.shift &&
    event.altKey === modifiers.alt &&
    event.metaKey === modifiers.meta
  );
};

const handleGlobalMouseDown = (event: UiohookMouseEvent) => {
  if (
    pushToTalkConfig?.input.type === 'mouse' &&
    typeof event.button === 'number' &&
    event.button === pushToTalkConfig.input.button &&
    hasMatchingModifiers(event)
  ) {
    sendPushToTalkState(true);
  }
};

const handleGlobalMouseUp = (event: UiohookMouseEvent) => {
  if (
    pushToTalkConfig?.input.type === 'mouse' &&
    typeof event.button === 'number' &&
    event.button === pushToTalkConfig.input.button
  ) {
    sendPushToTalkState(false);
  }
};

const startGlobalInputHook = () => {
  if (globalInputHookStarted) return;

  uIOhook.on('keydown', handleGlobalKeyDown);
  uIOhook.on('keyup', handleGlobalKeyUp);
  uIOhook.on('mousedown', handleGlobalMouseDown);
  uIOhook.on('mouseup', handleGlobalMouseUp);
  uIOhook.start();
  globalInputHookStarted = true;
};

const stopGlobalInputHook = () => {
  if (!globalInputHookStarted) return;

  sendPushToTalkState(false);
  uIOhook.removeListener('keydown', handleGlobalKeyDown);
  uIOhook.removeListener('keyup', handleGlobalKeyUp);
  uIOhook.removeListener('mousedown', handleGlobalMouseDown);
  uIOhook.removeListener('mouseup', handleGlobalMouseUp);
  uIOhook.stop();
  globalInputHookStarted = false;
};

const setPushToTalk = (config: TPushToTalkConfig): TPushToTalkRegistration => {
  if (process.platform !== 'win32') {
    return {
      registered: false,
      error: 'Global push-to-talk is currently available on Windows only.'
    };
  }

  try {
    pushToTalkConfig = config;
    startGlobalInputHook();

    return { registered: true };
  } catch {
    pushToTalkConfig = undefined;
    stopGlobalInputHook();

    return {
      registered: false,
      error: 'The selected key is unavailable for global push-to-talk.'
    };
  }
};

const isSafeExternalUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2_048) return false;

  try {
    const url = new URL(value);

    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

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
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send('sandshark:download-progress', progress);
};

const configureDownloads = () => {
  session.defaultSession.on('will-download', (_event, item, webContents) => {
    const pendingDownloads = pendingDownloadsByWebContentsId.get(
      webContents.id
    );
    if (!pendingDownloads?.length) return;

    const matchingIndex = pendingDownloads.findIndex(
      (download) => download.url === item.getURL()
    );
    const index = matchingIndex >= 0 ? matchingIndex : 0;
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

    item.on('updated', (_updatedEvent, state) => {
      sendDownloadProgress({
        id: download.id,
        filename: download.filename,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes(),
        state: state === 'interrupted' ? 'interrupted' : 'progressing'
      });
    });

    item.once('done', (_doneEvent, state) => {
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
    });
  });
};

const isSandSharkDeepLink = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2_048) return false;

  try {
    const url = new URL(value);

    return (
      (url.protocol === 'sandshark:' || url.protocol === 'sharkord:') &&
      !url.username &&
      !url.password &&
      (!!url.hostname || url.pathname.length > 1)
    );
  } catch {
    return false;
  }
};

const handleDeepLink = (url: string) => {
  if (!isSandSharkDeepLink(url)) return false;

  if (deepLinkRendererReady && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sandshark:deep-link', url);
    return true;
  }

  if (pendingDeepLinks.at(-1) !== url) {
    pendingDeepLinks = [...pendingDeepLinks.slice(-15), url];
  }

  return true;
};

const handleDeepLinksFromArguments = (arguments_: readonly string[]) => {
  let hasDeepLink = false;

  for (const argument of arguments_) {
    if (handleDeepLink(argument)) hasDeepLink = true;
  }

  if (hasDeepLink) showMainWindow();
};

const registerDeepLinkProtocols = () => {
  for (const scheme of deepLinkSchemes) {
    if (isDevelopment && process.argv[1]) {
      app.setAsDefaultProtocolClient(scheme, process.execPath, [
        resolve(process.argv[1])
      ]);
      continue;
    }

    app.setAsDefaultProtocolClient(scheme);
  }
};

const isDesktopNotification = (
  value: unknown
): value is TDesktopNotification => {
  if (!value || typeof value !== 'object') return false;

  const notification = value as Record<string, unknown>;

  return (
    typeof notification.title === 'string' &&
    notification.title.length > 0 &&
    notification.title.length <= 200 &&
    (notification.body === undefined ||
      (typeof notification.body === 'string' &&
        notification.body.length <= 2_000)) &&
    (notification.silent === undefined ||
      typeof notification.silent === 'boolean')
  );
};

const isDesktopNotificationTarget = (
  value: unknown
): value is TDesktopNotificationTarget => {
  if (!value || typeof value !== 'object') return false;

  const target = value as Record<string, unknown>;

  return (
    (target.profileId === undefined ||
      (typeof target.profileId === 'string' &&
        target.profileId.length <= 200)) &&
    typeof target.channelId === 'number' &&
    Number.isSafeInteger(target.channelId) &&
    target.channelId > 0 &&
    typeof target.messageId === 'number' &&
    Number.isSafeInteger(target.messageId) &&
    target.messageId > 0 &&
    typeof target.isDm === 'boolean'
  );
};

const isTrayStatus = (value: unknown): value is TTrayStatus => {
  if (!value || typeof value !== 'object') return false;

  const status = value as Record<string, unknown>;

  return (
    (status.serverName === undefined ||
      (typeof status.serverName === 'string' &&
        status.serverName.length <= 200)) &&
    typeof status.micMuted === 'boolean' &&
    typeof status.soundMuted === 'boolean' &&
    typeof status.unreadCount === 'number' &&
    Number.isSafeInteger(status.unreadCount) &&
    status.unreadCount >= 0 &&
    status.unreadCount <= 1_000_000
  );
};

const isTaskbarStatus = (value: unknown): value is TTaskbarStatus => {
  if (!value || typeof value !== 'object') return false;

  const status = value as Record<string, unknown>;

  return ['unreadCount', 'mentionCount'].every(
    (key) =>
      typeof status[key] === 'number' &&
      Number.isSafeInteger(status[key]) &&
      status[key] >= 0 &&
      status[key] <= 1_000_000
  );
};

const getSenderWindow = (event: IpcMainInvokeEvent) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);

  if (!senderWindow || senderWindow !== mainWindow) {
    throw new Error('Desktop action was requested by an untrusted renderer.');
  }

  return senderWindow;
};

const isAllowedRendererUrl = (value: string) => {
  try {
    const url = new URL(value);

    if (isDevelopment) {
      return url.origin === new URL(developmentRendererUrl).origin;
    }

    const rendererDirectory = join(process.resourcesPath, 'renderer');

    if (url.protocol !== 'file:') return false;

    const rendererPath = fileURLToPath(url);
    const relativePath = relative(rendererDirectory, rendererPath);

    return !relativePath.startsWith('..') && !isAbsolute(relativePath);
  } catch {
    return false;
  }
};

const configureWebContents = (window: BrowserWindow) => {
  const handleNavigation = (event: Electron.Event, url: string) => {
    if (isAllowedRendererUrl(url)) return;

    event.preventDefault();

    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
      return;
    }

    handleDeepLink(url);
  };

  window.webContents.on('will-navigate', handleNavigation);
  window.webContents.on('will-redirect', handleNavigation);
  window.webContents.on('did-start-loading', () => {
    deepLinkRendererReady = false;
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      writeDesktopLog('renderer', 'Renderer load failed', {
        errorCode,
        errorDescription,
        urlProtocol: (() => {
          try {
            return new URL(validatedURL).protocol;
          } catch {
            return undefined;
          }
        })()
      });
    }
  );

  window.webContents.on('render-process-gone', (_event, details) => {
    if (window !== mainWindow) return;

    const crashDetails = {
      reason: details.reason,
      exitCode: details.exitCode
    };
    writeDesktopLog('crash', 'Renderer process exited', crashDetails);
    void showCrashRecoveryDialog('renderer', crashDetails);
  });

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    } else {
      handleDeepLink(url);
    }

    return { action: 'deny' };
  });
};

const configureMediaPermissions = () => {
  const canUseMedia = (
    webContents: Electron.WebContents | null,
    permission: string
  ) => {
    if (!webContents) return false;

    const senderWindow = BrowserWindow.fromWebContents(webContents);
    const isTrustedMainWindow =
      senderWindow === mainWindow && isAllowedRendererUrl(webContents.getURL());

    return (
      isTrustedMainWindow &&
      (permission === 'media' || permission === 'display-capture')
    );
  };

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission) => {
      const granted = canUseMedia(webContents, permission);

      if (permission === 'media') {
        writeDesktopCaptureDiagnostic('permission-check', {
          permission,
          granted,
          hasWebContents: Boolean(webContents)
        });
      }

      return granted;
    }
  );

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const granted = canUseMedia(webContents, permission);

      if (permission === 'media' || permission === 'display-capture') {
        writeDesktopCaptureDiagnostic('permission-request', {
          permission,
          granted,
          hasWebContents: Boolean(webContents)
        });
      }

      callback(granted);
    }
  );

  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      const sourceId = selectedDesktopCaptureSourceId;
      selectedDesktopCaptureSourceId = undefined;

      writeDesktopCaptureDiagnostic('display-media-request', {
        audioRequested: request.audioRequested,
        videoRequested: request.videoRequested,
        userGesture: request.userGesture,
        sourceSelected: Boolean(sourceId),
        sourceType: sourceId?.startsWith('screen:')
          ? 'screen'
          : sourceId?.startsWith('window:')
            ? 'window'
            : undefined
      });

      if (!sourceId) {
        writeDesktopCaptureDiagnostic('display-media-denied', {
          reason: 'no-source-selected'
        });
        callback({});
        return;
      }

      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 0, height: 0 },
          fetchWindowIcons: false
        });
        const source = sources.find((candidate) => candidate.id === sourceId);

        if (!source) {
          writeDesktopCaptureDiagnostic('display-media-denied', {
            reason: 'source-not-found'
          });
          callback({});
          return;
        }

        const includeLoopbackAudio =
          request.audioRequested && process.platform === 'win32';
        writeDesktopCaptureDiagnostic('display-media-granted', {
          sourceType: source.id.startsWith('screen:') ? 'screen' : 'window',
          loopbackAudio: includeLoopbackAudio
        });
        callback(
          includeLoopbackAudio
            ? { video: source, audio: 'loopback' }
            : { video: source }
        );
      } catch (error) {
        console.error(
          'SandShark could not grant screen capture access.',
          error
        );
        writeDesktopCaptureDiagnostic('display-media-handler-error', {
          error: error instanceof Error ? error.message : String(error)
        });
        callback({});
      }
    }
  );
};

const configureYouTubeEmbedIdentity = () => {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        'https://www.youtube.com/*',
        'https://youtube.com/*',
        'https://www.youtube-nocookie.com/*',
        'https://youtube-nocookie.com/*'
      ]
    },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };

      requestHeaders.Referer ??= youtubeDesktopReferrer;
      requestHeaders.Origin ??= youtubeDesktopReferrer.slice(0, -1);

      callback({ requestHeaders });
    }
  );
};

const registerDesktopIpcHandlers = () => {
  ipcMain.handle('sandshark:get-version', (event) => {
    getSenderWindow(event);
    return app.getVersion();
  });
  ipcMain.handle('sandshark:minimize', (event) => {
    getSenderWindow(event).minimize();
  });
  ipcMain.handle('sandshark:maximize', (event) => {
    const window = getSenderWindow(event);

    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.handle('sandshark:close', (event) => {
    getSenderWindow(event).close();
  });
  ipcMain.handle('sandshark:show-notification', (event, options: unknown) => {
    getSenderWindow(event);

    if (!isDesktopNotification(options)) {
      throw new Error('Invalid desktop notification options.');
    }

    if (
      options.target !== undefined &&
      !isDesktopNotificationTarget(options.target)
    ) {
      throw new Error('Invalid desktop notification target.');
    }

    if (!Notification.isSupported()) {
      throw new Error(
        'Desktop notifications are not supported on this system.'
      );
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      silent: options.silent,
      icon: trayIconPath
    });

    if (options.target && isDesktopNotificationTarget(options.target)) {
      notification.on('click', () => {
        showMainWindow();
        mainWindow?.webContents.send(
          'sandshark:notification-click',
          options.target
        );
      });
    }

    notification.show();
  });
  ipcMain.handle('sandshark:open-external', async (event, url: unknown) => {
    getSenderWindow(event);

    if (!isSafeExternalUrl(url)) {
      throw new Error('Only HTTP and HTTPS links can be opened externally.');
    }

    await shell.openExternal(url);
  });
  ipcMain.handle('sandshark:get-desktop-capture-sources', async (event) => {
    getSenderWindow(event);

    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 640, height: 360 },
      fetchWindowIcons: false
    });

    return sources.slice(0, 64).map<TDesktopCaptureSource>((source) => ({
      id: source.id,
      name: source.name || 'Untitled source',
      type: source.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnailDataUrl: source.thumbnail.isEmpty()
        ? undefined
        : source.thumbnail.toDataURL()
    }));
  });
  ipcMain.handle(
    'sandshark:set-desktop-capture-source',
    (event, sourceId: unknown) => {
      getSenderWindow(event);

      if (typeof sourceId !== 'string' || !/^(screen|window):/.test(sourceId)) {
        throw new Error('Invalid desktop capture source.');
      }

      selectedDesktopCaptureSourceId = sourceId;
      writeDesktopCaptureDiagnostic('source-selected', {
        sourceType: sourceId.startsWith('screen:') ? 'screen' : 'window'
      });
    }
  );
  ipcMain.handle(
    'sandshark:report-desktop-capture-diagnostic',
    (event, diagnostic: unknown) => {
      getSenderWindow(event);

      if (!isDesktopCaptureDiagnostic(diagnostic)) {
        throw new Error('Invalid desktop capture diagnostic.');
      }

      writeDesktopCaptureDiagnostic(
        `renderer-${diagnostic.stage}`,
        diagnostic.details
      );
    }
  );
  ipcMain.handle('sandshark:show-desktop-capture-log', (event) => {
    getSenderWindow(event);
    const logPath = getDesktopCaptureLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    if (!existsSync(logPath)) writeFileSync(logPath, '', 'utf8');
    shell.showItemInFolder(logPath);
  });
  ipcMain.handle(
    'sandshark:report-desktop-diagnostic',
    (event, diagnostic: unknown) => {
      getSenderWindow(event);

      if (!isDesktopLogDiagnostic(diagnostic)) {
        throw new Error('Invalid desktop diagnostic.');
      }

      writeDesktopLog(
        diagnostic.category,
        diagnostic.message,
        diagnostic.details
      );
    }
  );
  ipcMain.handle('sandshark:open-log-folder', async (event) => {
    getSenderWindow(event);
    await openDesktopLogFolder();
  });
  ipcMain.handle('sandshark:set-push-to-talk', (event, config: unknown) => {
    getSenderWindow(event);

    if (!isPushToTalkConfig(config)) {
      throw new Error('Invalid push-to-talk configuration.');
    }

    return setPushToTalk(config);
  });
  ipcMain.handle('sandshark:clear-push-to-talk', (event) => {
    getSenderWindow(event);
    pushToTalkConfig = undefined;
    stopGlobalInputHook();
  });
  ipcMain.handle('sandshark:set-tray-status', (event, status: unknown) => {
    getSenderWindow(event);

    if (!isTrayStatus(status)) {
      throw new Error('Invalid tray status.');
    }

    trayStatus = status;
    updateTray();
  });
  ipcMain.handle('sandshark:set-taskbar-status', (event, status: unknown) => {
    getSenderWindow(event);

    if (!isTaskbarStatus(status)) {
      throw new Error('Invalid taskbar status.');
    }

    taskbarStatus = status;
    updateTaskbar();
  });
  ipcMain.handle('sandshark:flash-taskbar', (event) => {
    const window = getSenderWindow(event);

    if (process.platform === 'win32' && !window.isFocused()) {
      window.flashFrame(true);
    }
  });
  ipcMain.handle('sandshark:get-window-behavior', (event) => {
    getSenderWindow(event);
    const { closeToTray, minimizeToTray, startMinimized } = windowState;
    return { closeToTray, minimizeToTray, startMinimized };
  });
  ipcMain.handle(
    'sandshark:set-window-behavior',
    (event, behavior: unknown) => {
      getSenderWindow(event);

      if (!isWindowBehavior(behavior)) {
        throw new Error('Invalid window behavior.');
      }

      windowState = { ...windowState, ...behavior };
      saveWindowState();
    }
  );
  ipcMain.handle('sandshark:get-start-at-login', (event) => {
    getSenderWindow(event);
    return getStartAtLoginSettings();
  });
  ipcMain.handle('sandshark:set-start-at-login', (event, enabled: unknown) => {
    getSenderWindow(event);

    if (typeof enabled !== 'boolean') {
      throw new Error('Invalid start-at-login setting.');
    }

    return setStartAtLogin(enabled);
  });
  ipcMain.handle('sandshark:get-hardware-acceleration', (event) => {
    getSenderWindow(event);
    return getHardwareAccelerationSettings();
  });
  ipcMain.handle(
    'sandshark:set-hardware-acceleration',
    (event, enabled: unknown) => {
      getSenderWindow(event);

      if (typeof enabled !== 'boolean') {
        throw new Error('Invalid hardware acceleration setting.');
      }

      hardwareAccelerationEnabled = enabled;
      saveHardwareAccelerationEnabled();
      return getHardwareAccelerationSettings();
    }
  );
  ipcMain.handle('sandshark:get-update-settings', (event) => {
    getSenderWindow(event);
    return updateSettings;
  });
  ipcMain.handle(
    'sandshark:set-update-settings',
    (event, settings: unknown) => {
      getSenderWindow(event);

      if (!isDesktopUpdateSettings(settings)) {
        throw new Error('Invalid update settings.');
      }

      updateSettings = settings;
      saveUpdateSettings();
      configureAutoUpdater();

      return updateSettings;
    }
  );
  ipcMain.handle('sandshark:get-update-status', (event) => {
    getSenderWindow(event);
    return updateStatus;
  });
  ipcMain.handle('sandshark:check-for-updates', async (event) => {
    getSenderWindow(event);
    return checkForUpdates();
  });
  ipcMain.handle('sandshark:download-update', async (event) => {
    getSenderWindow(event);
    return downloadUpdate();
  });
  ipcMain.handle('sandshark:install-update', (event) => {
    getSenderWindow(event);

    if (updateStatus.state !== 'downloaded') {
      throw new Error('No downloaded update is ready to install.');
    }

    throw new Error('Automatic updates are not configured for this build.');
  });
  ipcMain.handle('sandshark:get-secret', (event, key: unknown) => {
    getSenderWindow(event);
    if (!isDesktopSecretKey(key))
      throw new Error('Invalid desktop secret key.');
    return getDesktopSecret(key);
  });
  ipcMain.handle('sandshark:set-secret', (event, request: unknown) => {
    getSenderWindow(event);
    if (!isDesktopSecretRequest(request)) {
      throw new Error('Invalid desktop secret request.');
    }
    return setDesktopSecret(request.key, request.value);
  });
  ipcMain.handle('sandshark:remove-secret', (event, key: unknown) => {
    getSenderWindow(event);
    if (!isDesktopSecretKey(key))
      throw new Error('Invalid desktop secret key.');
    removeDesktopSecret(key);
  });
  ipcMain.handle('sandshark:ready-for-deep-links', (event) => {
    getSenderWindow(event);
    deepLinkRendererReady = true;

    const links = pendingDeepLinks;
    pendingDeepLinks = [];
    return links;
  });
  ipcMain.handle('sandshark:download-file', async (event, request: unknown) => {
    const window = getSenderWindow(event);

    if (!isDesktopDownloadRequest(request)) {
      throw new Error('Invalid download request.');
    }

    const filename = sanitizeDownloadFilename(request.filename);
    const result = await dialog.showSaveDialog(window, {
      title: 'Save download',
      defaultPath: join(app.getPath('downloads'), filename)
    });

    if (result.canceled || !result.filePath) return {};

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
    event.sender.downloadURL(request.url);

    return { id };
  });
  ipcMain.handle(
    'sandshark:open-downloaded-file',
    async (event, id: unknown) => {
      getSenderWindow(event);

      if (!isDownloadId(id) || !completedDownloads.has(id)) {
        throw new Error('The downloaded file is no longer available.');
      }

      const error = await shell.openPath(completedDownloads.get(id)!);
      if (error) throw new Error(error);
    }
  );
  ipcMain.handle('sandshark:show-downloaded-file', (event, id: unknown) => {
    getSenderWindow(event);

    if (!isDownloadId(id) || !completedDownloads.has(id)) {
      throw new Error('The downloaded file is no longer available.');
    }

    shell.showItemInFolder(completedDownloads.get(id)!);
  });
};

const createMainWindow = async () => {
  const restoredBounds = getRestoredBounds();

  mainWindow = new BrowserWindow({
    width: restoredBounds?.width ?? 1440,
    height: restoredBounds?.height ?? 900,
    x: restoredBounds?.x,
    y: restoredBounds?.y,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'SandShark',
    autoHideMenuBar: true,
    icon: desktopIconPath,
    backgroundColor: '#14171a',
    webPreferences: {
      preload: join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });

  mainWindow.removeMenu();
  configureWebContents(mainWindow);
  updateTaskbar();

  // Electron reports HTML fullscreen requests but does not promote the native
  // window automatically. Keep the browser's stream-card fullscreen in sync.
  mainWindow.webContents.on('enter-html-full-screen', () => {
    mainWindow?.setFullScreen(true);
  });
  mainWindow.webContents.on('leave-html-full-screen', () => {
    mainWindow?.setFullScreen(false);
  });

  mainWindow.once('ready-to-show', () => {
    const launchedAtLogin = process.argv.includes(startAtLoginArgs[0]);
    if (!windowState.startMinimized && !launchedAtLogin) mainWindow?.show();
  });

  if (windowState.maximized) mainWindow.maximize();

  mainWindow.on('close', (event) => {
    if (!windowState.closeToTray || !tray) return;

    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('minimize', () => {
    if (!windowState.minimizeToTray || !tray) return;

    mainWindow?.hide();
  });

  mainWindow.on('resize', () => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    windowState.bounds = mainWindow.getBounds();
    scheduleWindowStateSave();
  });

  mainWindow.on('move', () => {
    if (!mainWindow || mainWindow.isMaximized()) return;
    windowState.bounds = mainWindow.getBounds();
    scheduleWindowStateSave();
  });

  mainWindow.on('maximize', () => {
    windowState.maximized = true;
    scheduleWindowStateSave();
  });

  mainWindow.on('unmaximize', () => {
    if (!mainWindow) return;
    windowState.maximized = false;
    windowState.bounds = mainWindow.getBounds();
    scheduleWindowStateSave();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    deepLinkRendererReady = false;
  });

  mainWindow.on('focus', () => {
    mainWindow?.flashFrame(false);
  });

  if (isDevelopment) {
    await mainWindow.loadURL(getDevelopmentRendererUrl());
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadURL(getPackagedRendererUrl());
};

registerDeepLinkProtocols();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('child-process-gone', (_event, details) => {
    if (details.type !== 'GPU') return;

    const crashDetails = {
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName
    };
    writeDesktopLog('crash', 'GPU process exited', crashDetails);
    void showCrashRecoveryDialog('gpu', crashDetails);
  });

  app.on('second-instance', (_event, commandLine) => {
    handleDeepLinksFromArguments(commandLine);
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLinksFromArguments([url]);
  });

  app.whenReady().then(() => {
    ensureLogFiles();
    writeDesktopLog('startup', 'SandShark desktop starting', {
      desktopVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromiumVersion: process.versions.chrome,
      hardwareAccelerationEnabled,
      autoUpdatesConfigured: autoUpdaterConfigured
    });
    Menu.setApplicationMenu(null);
    loadWindowState();
    registerDesktopIpcHandlers();
    configureMediaPermissions();
    configureYouTubeEmbedIdentity();
    configureDownloads();
    createTray();
    void createMainWindow();
    configureAutoUpdater();
    handleDeepLinksFromArguments(process.argv);

    app.on('activate', () => {
      showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  pushToTalkConfig = undefined;
  stopGlobalInputHook();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  writeDesktopLog('lifecycle', 'SandShark desktop quitting');
  if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
  if (mainWindow && !mainWindow.isMaximized()) {
    windowState.bounds = mainWindow.getBounds();
  }
  windowState.maximized = mainWindow?.isMaximized() ?? false;
  saveWindowState();
  tray?.destroy();
  tray = null;
});

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  Notification,
  screen,
  session,
  shell,
  Tray,
  type IpcMainInvokeEvent
} from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeJsonAtomically } from './atomic-json.js';
import type {
  TDesktopNotification,
  TDesktopNotificationTarget,
  TStartAtLoginSettings,
  TTaskbarStatus,
  TTrayStatus,
  TWindowBehavior
} from './desktop-api.js';
import type { TDesktopLogDetails } from './diagnostics.js';
import { openDesktopLogFolder, writeDesktopLog } from './diagnostics.js';
import { isSafeExternalUrl } from './external-url.js';
import { startOidcLogin } from './oidc-login.js';
import { assertTrustedRenderer } from './trusted-renderer.js';

import type { TDesktopIpc } from './desktop-ipc.js';
const createDesktopWindow = ({
  currentDirectory,
  isDevelopment,
  developmentRendererUrl,
  isPackagedSmokeTest,
  onRendererReset,
  onClosed
}: {
  currentDirectory: string;
  isDevelopment: boolean;
  developmentRendererUrl: string;
  isPackagedSmokeTest: boolean;
  onRendererReset: () => void;
  onClosed: (id: number) => void;
}) => {
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
  let deepLinkRendererReady = false;
  let pendingDeepLinks: string[] = [];
  let crashRecoveryDialogVisible = false;
  let crashRecoveryReloads: number[] = [];
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
          showCrashRecoveryDialog(process, details).catch(console.error);
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
        bounds: isRectangle(storedState.bounds)
          ? storedState.bounds
          : undefined,
        maximized: storedState.maximized === true
      };
    } catch {
      console.warn('SandShark window state could not be restored.');
    }
  };

  const saveWindowState = () => {
    try {
      writeJsonAtomically(getWindowStatePath(), windowState);
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
      createMainWindow().catch(console.error);
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
            mainWindow?.webContents.send(
              'sandshark:tray-action',
              'toggle-sound'
            );
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

  const getSenderWindow = (event: IpcMainInvokeEvent) =>
    assertTrustedRenderer(event, mainWindow, isAllowedRendererUrl);

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
        shell.openExternal(url).catch(console.error);
        return;
      }

      handleDeepLink(url);
    };

    window.webContents.on('will-navigate', handleNavigation);
    window.webContents.on('will-redirect', handleNavigation);
    window.webContents.on(
      'did-start-navigation',
      (_event, _url, isInPlace, isMainFrame) => {
        if (!isMainFrame || isInPlace) return;
        deepLinkRendererReady = false;
        onRendererReset();
      }
    );

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
      onRendererReset();

      const crashDetails = {
        reason: details.reason,
        exitCode: details.exitCode
      };
      writeDesktopLog('crash', 'Renderer process exited', crashDetails);
      showCrashRecoveryDialog('renderer', crashDetails).catch(console.error);
    });

    window.webContents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) {
        shell.openExternal(url).catch(console.error);
      } else {
        handleDeepLink(url);
      }

      return { action: 'deny' };
    });
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

  const registerIpc = (desktopIpc: TDesktopIpc) => {
    desktopIpc.handle(
      'sandshark:start-oidc-login',
      (event, payload: unknown) => {
        if (!payload || typeof payload !== 'object')
          throw new Error('Invalid authentication request.');
        const { serverUrl, invite } = payload as {
          serverUrl?: unknown;
          invite?: unknown;
        };
        const senderWindow = getSenderWindow(event);
        if (typeof serverUrl !== 'string' || serverUrl.length > 2048)
          throw new Error('Invalid authentication server URL.');
        if (
          invite !== undefined &&
          (typeof invite !== 'string' || invite.length > 256)
        ) {
          throw new Error('Invalid invite code.');
        }
        return startOidcLogin(senderWindow, serverUrl, invite);
      }
    );
    desktopIpc.handle('sandshark:get-version', (event) => {
      getSenderWindow(event);
      return app.getVersion();
    });
    desktopIpc.handle('sandshark:minimize', (event) => {
      getSenderWindow(event).minimize();
    });
    desktopIpc.handle('sandshark:maximize', (event) => {
      const window = getSenderWindow(event);

      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    });
    desktopIpc.handle('sandshark:close', (event) => {
      getSenderWindow(event).close();
    });
    desktopIpc.handle(
      'sandshark:show-notification',
      (event, options: unknown) => {
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
      }
    );
    desktopIpc.handle(
      'sandshark:open-external',
      async (event, url: unknown) => {
        getSenderWindow(event);

        if (!isSafeExternalUrl(url)) {
          throw new Error(
            'Only HTTP and HTTPS links can be opened externally.'
          );
        }

        await shell.openExternal(url);
      }
    );
    desktopIpc.handle('sandshark:set-tray-status', (event, status: unknown) => {
      getSenderWindow(event);

      if (!isTrayStatus(status)) {
        throw new Error('Invalid tray status.');
      }

      trayStatus = status;
      updateTray();
    });
    desktopIpc.handle(
      'sandshark:set-taskbar-status',
      (event, status: unknown) => {
        getSenderWindow(event);

        if (!isTaskbarStatus(status)) {
          throw new Error('Invalid taskbar status.');
        }

        taskbarStatus = status;
        updateTaskbar();
      }
    );
    desktopIpc.handle('sandshark:flash-taskbar', (event) => {
      const window = getSenderWindow(event);

      if (process.platform === 'win32' && !window.isFocused()) {
        window.flashFrame(true);
      }
    });
    desktopIpc.handle('sandshark:get-window-behavior', (event) => {
      getSenderWindow(event);
      const { closeToTray, minimizeToTray, startMinimized } = windowState;
      return { closeToTray, minimizeToTray, startMinimized };
    });
    desktopIpc.handle(
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
    desktopIpc.handle('sandshark:get-start-at-login', (event) => {
      getSenderWindow(event);
      return getStartAtLoginSettings();
    });
    desktopIpc.handle(
      'sandshark:set-start-at-login',
      (event, enabled: unknown) => {
        getSenderWindow(event);

        if (typeof enabled !== 'boolean') {
          throw new Error('Invalid start-at-login setting.');
        }

        return setStartAtLogin(enabled);
      }
    );
    desktopIpc.handle('sandshark:ready-for-deep-links', (event) => {
      getSenderWindow(event);
      deepLinkRendererReady = true;

      const links = pendingDeepLinks;
      pendingDeepLinks = [];
      return links;
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

    // electron reports HTML fullscreen requests but does not promote the native
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

    const ownerWebContentsId = mainWindow.webContents.id;
    mainWindow.on('closed', () => {
      onClosed(ownerWebContentsId);
      onRendererReset();
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

  const dispose = () => {
    if (saveWindowStateTimer) clearTimeout(saveWindowStateTimer);
    if (mainWindow && !mainWindow.isMaximized()) {
      windowState.bounds = mainWindow.getBounds();
    }
    windowState.maximized = mainWindow?.isMaximized() ?? false;
    saveWindowState();
    tray?.destroy();
    tray = null;
  };
  return {
    getMainWindow: () => mainWindow,
    getSenderWindow,
    isAllowedRendererUrl,
    registerIpc,
    registerDeepLinkProtocols,
    handleDeepLinksFromArguments,
    showCrashRecoveryDialog,
    showMainWindow,
    loadWindowState,
    createTray,
    createMainWindow,
    configureYouTubeEmbedIdentity,
    dispose
  };
};
export { createDesktopWindow };

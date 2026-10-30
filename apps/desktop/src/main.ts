import {
  app,
  dialog,
  ipcMain,
  Menu,
  safeStorage,
  session,
  shell
} from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uIOhook } from 'uiohook-napi';
import { createApplicationAudio } from './application-audio.js';
import { writeJsonAtomically } from './atomic-json.js';
import { createDesktopCapture } from './desktop-capture.js';
import { createDesktopDownloads } from './desktop-downloads.js';
import { createDesktopIpc } from './desktop-ipc.js';
import { createDesktopUpdater } from './desktop-updater.js';
import { createDesktopWindow } from './desktop-window.js';
import {
  configureChromiumMediaLogging,
  ensureLogFiles,
  registerDiagnosticsIpc,
  writeDesktopCaptureDiagnostic,
  writeDesktopLog
} from './diagnostics.js';
import { createDesktopPreferences } from './preferences.js';
import { createPushToTalk } from './push-to-talk.js';

app.setName('SandShark');
app.setAppUserModelId('com.sandshark.desktop');
app.on('before-quit', () => {
  applicationAudio.stopApplicationAudioCapture();
});

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;
const developmentRendererUrl =
  process.env.SANDSHARK_RENDERER_URL ?? 'http://127.0.0.1:5173';
const smokeTestUserDataDir = process.env.SANDSHARK_SMOKE_USER_DATA_DIR;
const isPackagedSmokeTest = process.env.SANDSHARK_SMOKE_TEST === '1';

if (smokeTestUserDataDir) {
  app.setPath('userData', smokeTestUserDataDir);
}

configureChromiumMediaLogging();

const preferences = createDesktopPreferences({ app, safeStorage });
if (!preferences.getHardwareAccelerationSettings().enabled)
  app.disableHardwareAcceleration();

const windowController = createDesktopWindow({
  currentDirectory,
  isDevelopment,
  developmentRendererUrl,
  isPackagedSmokeTest,
  onRendererReset: () => {
    pushToTalk.dispose();
    applicationAudio.stopApplicationAudioCapture();
  },
  onBlur: () => pushToTalk.releaseHeld(),
  onClosed: (id) => downloads?.releaseWindow(id)
});
const { getMainWindow, getSenderWindow, isAllowedRendererUrl } =
  windowController;
const pushToTalk = createPushToTalk(uIOhook, (active) => {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send('sandshark:push-to-talk', active);
});
const updater = createDesktopUpdater({
  writeDesktopLog,
  getMainWindow,
  preferences,
  isDevelopment,
  isPackagedSmokeTest
});

const getProcessAudioCaptureExecutablePath = () =>
  isDevelopment
    ? join(currentDirectory, '../native/bin/ProcessAudioCapture.exe')
    : join(process.resourcesPath, 'native', 'ProcessAudioCapture.exe');

const applicationAudio = createApplicationAudio({
  getExecutablePath: getProcessAudioCaptureExecutablePath,
  writeDesktopCaptureDiagnostic
});

const capture = createDesktopCapture(
  getProcessAudioCaptureExecutablePath,
  applicationAudio,
  isAllowedRendererUrl,
  getMainWindow
);

const desktopIpc = createDesktopIpc(ipcMain, getSenderWindow);

let downloads: ReturnType<typeof createDesktopDownloads>;

windowController.registerDeepLinkProtocols();

const hasSingleInstanceLock =
  isPackagedSmokeTest || app.requestSingleInstanceLock();

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
    windowController
      .showCrashRecoveryDialog('gpu', crashDetails)
      .catch(console.error);
  });

  app.on('second-instance', (_event, commandLine) => {
    windowController.handleDeepLinksFromArguments(commandLine);
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    windowController.handleDeepLinksFromArguments([url]);
  });

  app.whenReady().then(() => {
    ensureLogFiles();
    writeDesktopLog('startup', 'SandShark desktop starting', {
      desktopVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromiumVersion: process.versions.chrome,
      hardwareAccelerationEnabled:
        preferences.getHardwareAccelerationSettings().enabled,
      autoUpdatesConfigured: updater.isConfigured()
    });
    Menu.setApplicationMenu(null);
    windowController.loadWindowState();
    downloads = createDesktopDownloads({
      getMainWindow,
      downloadSession: session.defaultSession,
      runtime: { app, dialog, shell }
    });
    downloads.registerIpc(desktopIpc);
    preferences.registerIpc(desktopIpc);
    registerDiagnosticsIpc(desktopIpc);
    updater.registerIpc(desktopIpc);
    pushToTalk.registerIpc(desktopIpc);
    applicationAudio.registerIpc(desktopIpc);
    capture.registerIpc(desktopIpc);
    windowController.registerIpc(desktopIpc);
    capture.configureMediaPermissions();
    windowController.configureYouTubeEmbedIdentity();
    downloads.configureDownloads();
    windowController.createTray();
    windowController
      .createMainWindow()
      .then(async () => {
        if (!isPackagedSmokeTest) return;
        const window = getMainWindow();
        if (!window) throw new Error('Smoke test renderer is unavailable.');
        const result = await window.webContents
          .executeJavaScript(`(async () => {
        const bridge = window.sandSharkDesktop;
        return { version: await bridge.getVersion(), hardware: await bridge.getHardwareAcceleration(),
          updates: await bridge.getUpdateSettings(), behavior: await bridge.getWindowBehavior() };
      })()`);
        writeJsonAtomically(
          join(app.getPath('userData'), 'smoke-ready.json'),
          result
        );
      })
      .catch(console.error);
    updater.configureAutoUpdater().catch(console.error);
    windowController.handleDeepLinksFromArguments(process.argv);

    app.on('activate', () => {
      windowController.showMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  pushToTalk.dispose();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (app.isReady()) capture.dispose();
  downloads?.dispose();
  pushToTalk.dispose();
  updater.dispose();
  desktopIpc.dispose();
  writeDesktopLog('lifecycle', 'SandShark desktop quitting');
  windowController.dispose();
});

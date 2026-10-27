import type { BrowserWindow } from 'electron';
import type { autoUpdater as ElectronAutoUpdater } from 'electron-updater';
import type { TDesktopUpdateStatus } from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';
import type { writeDesktopLog as TWriteDesktopLog } from './diagnostics.js';
import {
  isDesktopUpdateSettings,
  type createDesktopPreferences
} from './preferences.js';

type TUpdaterOptions = {
  getMainWindow: () => BrowserWindow | null;
  writeDesktopLog: typeof TWriteDesktopLog;
  preferences: ReturnType<typeof createDesktopPreferences>;
  isDevelopment: boolean;
  isPackagedSmokeTest: boolean;
  loadUpdater?: () => Promise<typeof ElectronAutoUpdater>;
};
const createDesktopUpdater = ({
  getMainWindow,
  writeDesktopLog,
  preferences,
  isDevelopment,
  isPackagedSmokeTest,
  loadUpdater = () =>
    import('electron-updater').then(({ autoUpdater }) => autoUpdater)
}: TUpdaterOptions) => {
  let disposed = false;
  const removeListeners: (() => void)[] = [];
  let updateStatus: TDesktopUpdateStatus = { state: 'idle' };
  let autoUpdaterConfigured = false;
  let autoUpdater: typeof ElectronAutoUpdater | undefined;
  let autoUpdaterLoadPromise:
    | Promise<typeof ElectronAutoUpdater | undefined>
    | undefined;

  const publishUpdateStatus = (status: TDesktopUpdateStatus) => {
    if (status.state === 'error') {
      writeDesktopLog('updates', 'Update failure', {
        state: status.state,
        version: status.version,
        percent: status.percent,
        message: status.message
      });
    }

    if (disposed) return;
    updateStatus = status;
    const window = getMainWindow();
    if (window && !window.isDestroyed())
      window.webContents.send('sandshark:update-status', status);
  };

  const configureAutoUpdater = async (): Promise<
    typeof ElectronAutoUpdater | undefined
  > => {
    if (disposed) return undefined;
    if (isDevelopment || isPackagedSmokeTest) {
      publishUpdateStatus({
        state: 'unsupported',
        message: 'Updates are only available in installed SandShark builds.'
      });
      return undefined;
    }

    if (autoUpdaterConfigured && autoUpdater) {
      autoUpdater.autoDownload =
        preferences.getUpdateSettings().automaticallyDownload;
      return autoUpdater;
    }

    if (!autoUpdaterLoadPromise) {
      autoUpdaterLoadPromise = loadUpdater().catch((error) => {
        writeDesktopLog('updates', 'Electron updater module failed to load', {
          error: error instanceof Error ? error.message : String(error)
        });
        publishUpdateStatus({
          state: 'error',
          message: 'Automatic updates are unavailable in this build.'
        });
        return undefined;
      });
    }

    const loadedAutoUpdater = await autoUpdaterLoadPromise;
    if (!loadedAutoUpdater || disposed) return undefined;
    if (autoUpdaterConfigured) return loadedAutoUpdater;

    try {
      autoUpdater = loadedAutoUpdater;
      autoUpdater.autoDownload =
        preferences.getUpdateSettings().automaticallyDownload;
      autoUpdater.allowPrerelease = false;
      autoUpdater.autoInstallOnAppQuit = true;
      const listen: typeof loadedAutoUpdater.on = (event, listener) => {
        removeListeners.push(() =>
          loadedAutoUpdater.removeListener(event, listener)
        );
        return loadedAutoUpdater.on(event, listener);
      };

      listen('checking-for-update', () => {
        publishUpdateStatus({ state: 'checking' });
      });
      listen('update-available', (info) => {
        publishUpdateStatus({ state: 'available', version: info.version });
      });
      listen('update-not-available', () => {
        publishUpdateStatus({ state: 'not-available' });
      });
      listen('download-progress', (progress) => {
        publishUpdateStatus({
          state: 'downloading',
          percent: Math.round(progress.percent)
        });
      });
      listen('update-downloaded', (info) => {
        publishUpdateStatus({ state: 'downloaded', version: info.version });
      });
      listen('error', (error) => {
        writeDesktopLog('updates', 'Electron updater error', {
          error: error.message
        });
        publishUpdateStatus({
          state: 'error',
          message: 'Could not check for SandShark updates.'
        });
      });

      autoUpdaterConfigured = true;
      if (preferences.getUpdateSettings().automaticallyCheck)
        checkForUpdates().catch(console.error);
      return autoUpdater;
    } catch (error) {
      for (const remove of removeListeners.splice(0)) remove();
      autoUpdaterConfigured = false;
      autoUpdater = undefined;
      autoUpdaterLoadPromise = undefined;
      writeDesktopLog('updates', 'Electron updater configuration failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      publishUpdateStatus({
        state: 'error',
        message: 'Automatic updates are unavailable in this build.'
      });
      return undefined;
    }
  };

  const checkForUpdates = async (): Promise<TDesktopUpdateStatus> => {
    const configuredAutoUpdater = await configureAutoUpdater();
    writeDesktopLog('updates', 'Update check requested', {
      state: updateStatus.state
    });

    if (!configuredAutoUpdater) return updateStatus;

    try {
      await configuredAutoUpdater.checkForUpdates();
    } catch (error) {
      writeDesktopLog('updates', 'Electron updater check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return updateStatus;
  };

  const downloadUpdate = async (): Promise<TDesktopUpdateStatus> => {
    const configuredAutoUpdater = await configureAutoUpdater();
    writeDesktopLog('updates', 'Update download requested', {
      state: updateStatus.state
    });

    if (!configuredAutoUpdater) return updateStatus;

    try {
      await configuredAutoUpdater.downloadUpdate();
    } catch (error) {
      writeDesktopLog('updates', 'Electron updater download failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return updateStatus;
  };

  const dispose = () => {
    disposed = true;
    for (const remove of removeListeners.splice(0)) remove();
    autoUpdaterConfigured = false;
    autoUpdater = undefined;
  };
  const registerIpc = (ipc: TDesktopIpc) => {
    const { getSenderWindow } = ipc;
    ipc.handle('sandshark:get-update-settings', (event) => {
      getSenderWindow(event);
      return preferences.getUpdateSettings();
    });
    ipc.handle('sandshark:set-update-settings', (event, settings: unknown) => {
      getSenderWindow(event);

      if (!isDesktopUpdateSettings(settings)) {
        throw new Error('Invalid update settings.');
      }

      preferences.setUpdateSettings(settings);
      configureAutoUpdater().catch(console.error);

      return preferences.getUpdateSettings();
    });
    ipc.handle('sandshark:get-update-status', (event) => {
      getSenderWindow(event);
      return updateStatus;
    });
    ipc.handle('sandshark:check-for-updates', async (event) => {
      getSenderWindow(event);
      return checkForUpdates();
    });
    ipc.handle('sandshark:download-update', async (event) => {
      getSenderWindow(event);
      return downloadUpdate();
    });
    ipc.handle('sandshark:install-update', (event) => {
      getSenderWindow(event);

      if (updateStatus.state !== 'downloaded') {
        throw new Error('No downloaded update is ready to install.');
      }

      if (!autoUpdater) {
        throw new Error('The updater is not available in this build.');
      }

      autoUpdater.quitAndInstall();
    });
  };
  return {
    configureAutoUpdater,
    dispose,
    registerIpc,
    isConfigured: () => autoUpdaterConfigured
  };
};
export { createDesktopUpdater };

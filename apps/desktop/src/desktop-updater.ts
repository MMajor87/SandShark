import type { BrowserWindow, Dialog, MessageBoxOptions } from 'electron';
import type { autoUpdater as ElectronAutoUpdater } from 'electron-updater';
import type { TDesktopUpdateStatus } from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';
import { getDesktopReleaseUrl } from './desktop-release.js';
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
  dialog: Pick<Dialog, 'showMessageBox'>;
  loadUpdater?: () => Promise<typeof ElectronAutoUpdater>;
};
const createDesktopUpdater = ({
  getMainWindow,
  writeDesktopLog,
  preferences,
  isDevelopment,
  isPackagedSmokeTest,
  dialog,
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
  // only the check started at launch prompts, a check from settings shows its result there
  let promptForUpdate = false;
  // an update accepted from the prompt still installs on quit when auto download is off
  let installAcceptedUpdateOnQuit = false;

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

  const showUpdatePrompt = async (options: MessageBoxOptions) => {
    const window = getMainWindow();
    // a dialog parented to a window hidden in the tray would never be seen
    const { response } =
      window && !window.isDestroyed() && window.isVisible()
        ? await dialog.showMessageBox(window, options)
        : await dialog.showMessageBox(options);

    return response;
  };

  const promptToDownload = async (version: string) => {
    const response = await showUpdatePrompt({
      type: 'info',
      title: 'Update available',
      message: `SandShark ${version} is available.`,
      detail: 'Do you want to download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (disposed || response !== 0) {
      promptForUpdate = false;
      return;
    }

    installAcceptedUpdateOnQuit = true;

    await downloadUpdate();
  };

  const promptToInstall = async (version: string) => {
    promptForUpdate = false;

    const response = await showUpdatePrompt({
      type: 'info',
      title: 'Update ready',
      message: `SandShark ${version} is ready to install.`,
      detail:
        'Restart now to finish updating, or it will install the next time you close SandShark.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (disposed || response !== 0 || !autoUpdater) return;

    writeDesktopLog('updates', 'Update install accepted from prompt', {
      version
    });
    autoUpdater.quitAndInstall();
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
      const automaticallyDownload =
        preferences.getUpdateSettings().automaticallyDownload;
      autoUpdater.autoDownload = automaticallyDownload;
      autoUpdater.autoInstallOnAppQuit =
        automaticallyDownload || installAcceptedUpdateOnQuit;
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
      const automaticallyDownload =
        preferences.getUpdateSettings().automaticallyDownload;
      autoUpdater.autoDownload = automaticallyDownload;
      autoUpdater.allowPrerelease = false;
      autoUpdater.autoInstallOnAppQuit =
        automaticallyDownload || installAcceptedUpdateOnQuit;
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

        if (promptForUpdate && !loadedAutoUpdater.autoDownload)
          promptToDownload(info.version).catch(console.error);
      });
      listen('update-not-available', () => {
        promptForUpdate = false;
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

        if (promptForUpdate) promptToInstall(info.version).catch(console.error);
      });
      listen('error', (error) => {
        promptForUpdate = false;
        writeDesktopLog('updates', 'Electron updater error', {
          error: error.message
        });
        publishUpdateStatus({
          state: 'error',
          message: 'Could not check for SandShark updates.'
        });
      });

      autoUpdaterConfigured = true;
      if (preferences.getUpdateSettings().automaticallyCheck) {
        promptForUpdate = true;
        checkForUpdates().catch(console.error);
      }
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
      const url = await getDesktopReleaseUrl();
      configuredAutoUpdater.setFeedURL({
        provider: 'generic',
        url,
        useMultipleRangeRequest: false
      });
      await configuredAutoUpdater.checkForUpdates();
    } catch (error) {
      writeDesktopLog('updates', 'Electron updater check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      publishUpdateStatus({
        state: 'error',
        message: 'Could not check for SandShark updates.'
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

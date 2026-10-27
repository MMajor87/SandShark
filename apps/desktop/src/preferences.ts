import type { TDesktopIpc } from './desktop-ipc.js';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeJsonAtomically } from './atomic-json.js';
import type {
  TDesktopSecretRequest,
  TDesktopUpdateSettings,
  THardwareAccelerationSettings
} from './desktop-api.js';
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

const createDesktopPreferences = ({
  app,
  safeStorage
}: Pick<typeof import('electron'), 'app' | 'safeStorage'>) => {
  const getDesktopPreferencesPath = () =>
    join(app.getPath('userData'), 'desktop-preferences.json');
  const getDesktopSecretsPath = () =>
    join(app.getPath('userData'), 'desktop-secrets.json');

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
    writeJsonAtomically(getDesktopSecretsPath(), secrets);
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

  const saveHardwareAccelerationEnabled = () => {
    try {
      desktopPreferences = {
        ...desktopPreferences,
        hardwareAccelerationEnabled
      };
      writeJsonAtomically(getDesktopPreferencesPath(), desktopPreferences);
    } catch {
      console.warn(
        'SandShark hardware acceleration preference could not be saved.'
      );
    }
  };

  const getHardwareAccelerationSettings =
    (): THardwareAccelerationSettings => ({
      enabled: hardwareAccelerationEnabled,
      restartRequired:
        hardwareAccelerationEnabled !== hardwareAccelerationEnabledAtLaunch
    });

  const DEFAULT_UPDATE_SETTINGS: TDesktopUpdateSettings = {
    automaticallyCheck: true,
    automaticallyDownload: true
  };
  let updateSettings: TDesktopUpdateSettings = {
    ...DEFAULT_UPDATE_SETTINGS,
    ...desktopPreferences.updateSettings
  };

  const saveUpdateSettings = () => {
    try {
      desktopPreferences = { ...desktopPreferences, updateSettings };
      writeJsonAtomically(getDesktopPreferencesPath(), desktopPreferences);
    } catch {
      console.warn('SandShark update preferences could not be saved.');
    }
  };

  const setHardwareAcceleration = (enabled: boolean) => {
    hardwareAccelerationEnabled = enabled;
    saveHardwareAccelerationEnabled();
    return getHardwareAccelerationSettings();
  };
  const getUpdateSettings = () => updateSettings;
  const setUpdateSettings = (settings: TDesktopUpdateSettings) => {
    updateSettings = settings;
    saveUpdateSettings();
    return updateSettings;
  };
  const registerIpc = (ipc: TDesktopIpc) => {
    const { getSenderWindow } = ipc;
    ipc.handle('sandshark:get-hardware-acceleration', (event) => {
      getSenderWindow(event);
      return getHardwareAccelerationSettings();
    });
    ipc.handle(
      'sandshark:set-hardware-acceleration',
      (event, enabled: unknown) => {
        getSenderWindow(event);

        if (typeof enabled !== 'boolean') {
          throw new Error('Invalid hardware acceleration setting.');
        }

        setHardwareAcceleration(enabled);
        return getHardwareAccelerationSettings();
      }
    );
    ipc.handle('sandshark:get-secret', (event, key: unknown) => {
      getSenderWindow(event);
      if (!isDesktopSecretKey(key))
        throw new Error('Invalid desktop secret key.');
      return getDesktopSecret(key);
    });
    ipc.handle('sandshark:set-secret', (event, request: unknown) => {
      getSenderWindow(event);
      if (!isDesktopSecretRequest(request)) {
        throw new Error('Invalid desktop secret request.');
      }
      return setDesktopSecret(request.key, request.value);
    });
    ipc.handle('sandshark:remove-secret', (event, key: unknown) => {
      getSenderWindow(event);
      if (!isDesktopSecretKey(key))
        throw new Error('Invalid desktop secret key.');
      removeDesktopSecret(key);
    });
  };
  return {
    registerIpc,
    getDesktopSecret,
    setDesktopSecret,
    removeDesktopSecret,
    getHardwareAccelerationSettings,
    setHardwareAcceleration,
    getUpdateSettings,
    setUpdateSettings
  };
};
export {
  createDesktopPreferences,
  isDesktopSecretKey,
  isDesktopSecretRequest,
  isDesktopUpdateSettings
};

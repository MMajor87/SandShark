import path from 'path';
import {
  IS_DEVELOPMENT,
  IS_TEST,
  SANDSHARK_MEDIASOUP_BIN_NAME,
  SERVER_VERSION
} from '../utils/env';
import { getAppDataPath } from '../utils/fs';
import { migrateLegacyDataPath } from './migrate-legacy-data-path';

const getDataPath = (): string => {
  if (IS_TEST) {
    return path.resolve(process.cwd(), './data-test');
  }

  const INJECTED_DATA_PATH = process.env.SANDSHARK_DATA_PATH;

  if (INJECTED_DATA_PATH) {
    return path.resolve(INJECTED_DATA_PATH);
  }

  if (IS_DEVELOPMENT) {
    return path.resolve(process.cwd(), './data');
  }

  const appDataPath = getAppDataPath();

  return migrateLegacyDataPath(
    path.join(appDataPath, 'sharkord'),
    path.join(appDataPath, 'sandshark')
  );
};

const getMediasoupBinaryPath = (): string | undefined => {
  if (IS_DEVELOPMENT) {
    return undefined;
  }

  return path.join(
    getDataPath(),
    'mediasoup',
    SANDSHARK_MEDIASOUP_BIN_NAME || 'mediasoup-worker'
  );
};

const DATA_PATH = getDataPath();
const MEDIASOUP_BINARY_PATH = getMediasoupBinaryPath();
const DB_PATH = path.join(DATA_PATH, 'db.sqlite');
const BACKUPS_PATH = path.join(DATA_PATH, 'backups');
const LOGS_PATH = path.join(DATA_PATH, 'logs');
const COMBINED_LOG_PATH = path.join(LOGS_PATH, 'combined.log');
const PUBLIC_PATH = path.join(DATA_PATH, 'public');
const TMP_PATH = path.join(DATA_PATH, 'tmp');
const UPLOADS_PATH = path.join(DATA_PATH, 'uploads');
const INTERFACE_PATH = path.resolve(DATA_PATH, 'interface', SERVER_VERSION);
const DRIZZLE_PATH = path.resolve(DATA_PATH, 'drizzle');
const MEDIASOUP_PATH = path.resolve(DATA_PATH, 'mediasoup');
const CONFIG_INI_PATH = path.resolve(DATA_PATH, 'config.ini');
const PLUGINS_PATH = path.join(DATA_PATH, 'plugins');
const PLUGINS_DATA_PATH = path.join(DATA_PATH, 'plugin-data');
const HOSTED_BOTS_PATH = path.join(DATA_PATH, 'hosted-bots');
const HOSTED_BOT_LOGS_PATH = path.join(LOGS_PATH, 'hosted-bots');
const SRC_MIGRATIONS_PATH = path.join(process.cwd(), 'src', 'db', 'migrations');

export {
  BACKUPS_PATH,
  COMBINED_LOG_PATH,
  CONFIG_INI_PATH,
  DATA_PATH,
  DB_PATH,
  DRIZZLE_PATH,
  HOSTED_BOT_LOGS_PATH,
  HOSTED_BOTS_PATH,
  INTERFACE_PATH,
  LOGS_PATH,
  MEDIASOUP_BINARY_PATH,
  MEDIASOUP_PATH,
  PLUGINS_DATA_PATH,
  PLUGINS_PATH,
  PUBLIC_PATH,
  SRC_MIGRATIONS_PATH,
  TMP_PATH,
  UPLOADS_PATH
};

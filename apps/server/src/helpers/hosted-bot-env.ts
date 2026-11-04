import { HOSTED_BOT_DEFAULT_TOKEN_ENV_NAMES } from '@sandshark/shared';
import { config } from '../config';
import { BOT_GATEWAY_PATH } from '../http/bot-api/gateway/protocol';
import { getHost } from './get-host';

// what a bot still needs from the host to run at all. nothing else of the server's own
// environment is passed on, since it can hold the server's secrets
const PASSED_THROUGH = [
  'PATH',
  'Path',
  'SystemRoot',
  'SYSTEMROOT',
  'WINDIR',
  'TEMP',
  'TMP',
  'TMPDIR',
  'HOME',
  'USERPROFILE',
  'LANG',
  'TZ'
];

// set by the server for every bot, an admin variable of the same name never replaces them
const RESERVED_ENV_NAMES = [
  'SANDSHARK_API_URL',
  'SANDSHARK_GATEWAY_URL',
  'BUN_BE_BUN',
  'NODE_OPTIONS',
  'BUN_OPTIONS'
];

// the bot runs on this machine, so it reaches the server on the loopback address whatever
// the public address is
const getLocalOrigin = () =>
  `http://${getHost(config.server.host, '127.0.0.1')}:${config.server.port}`;

// what installing dependencies runs with: no token, and none of the admin's variables,
// since an install runs the packages' own scripts
const buildInstallEnv = () => {
  const result: Record<string, string> = {};

  for (const name of PASSED_THROUGH) {
    const value = process.env[name];

    if (value !== undefined) result[name] = value;
  }

  // the compiled server binary acts as the plain bun cli with this set, so bots need no
  // runtime of their own. bun itself ignores it
  result.BUN_BE_BUN = '1';

  return result;
};

const buildHostedBotEnv = ({
  token,
  env,
  tokenEnvNames
}: {
  token: string;
  env: Record<string, string>;
  tokenEnvNames: string[];
}) => {
  const origin = getLocalOrigin();
  const result = buildInstallEnv();

  for (const [name, value] of Object.entries(env)) {
    if (!RESERVED_ENV_NAMES.includes(name)) result[name] = value;
  }

  for (const name of [
    ...HOSTED_BOT_DEFAULT_TOKEN_ENV_NAMES,
    ...tokenEnvNames
  ]) {
    result[name] = token;
  }

  result.SANDSHARK_API_URL = `${origin}/api`;
  result.SANDSHARK_GATEWAY_URL = `${origin.replace(/^http/, 'ws')}${BOT_GATEWAY_PATH}`;
  result.NODE_ENV = 'production';

  return result;
};

export { buildHostedBotEnv, buildInstallEnv, RESERVED_ENV_NAMES };

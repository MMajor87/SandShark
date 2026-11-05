import { getErrorMessage } from '@sandshark/shared';
import fs from 'fs/promises';
import { parse, stringify } from 'ini';
import z from 'zod';
import { applyEnvOverrides } from './helpers/apply-env-overrides';
import { ensureServerDirs } from './helpers/ensure-server-dirs';
import { getPrivateIp, getPublicIp } from './helpers/network';
import { CONFIG_INI_PATH } from './helpers/paths';
import { deepMerge } from './utils/deep-merge';
import { IS_DEVELOPMENT, IS_TEST } from './utils/env';

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
};

const zRateLimiter = z.object({
  maxRequests: z.coerce.number().int().positive(),
  windowMs: z.coerce.number().int().positive()
});

const zFailedAttemptsLimiter = z.object({
  maxFailures: z.coerce.number().int().positive(),
  windowMs: z.coerce.number().int().positive(),
  blockMs: z.coerce.number().int().positive(),
  maxBlockMs: z.coerce.number().int().positive()
});

const zConfig = z.object({
  server: z.object({
    host: z.string().trim(),
    port: z.coerce.number().int().positive(),
    debug: z.coerce.boolean(),
    autoupdate: z.coerce.boolean(),
    monitor: z.coerce.boolean(),
    backupDatabase: z.coerce.boolean(),
    maxRequestBodyBytes: z.coerce.number().int().positive(),
    allowedOrigins: z
      .preprocess(
        (value) => {
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') return value.split(',');

          return [value];
        },
        z.array(z.string().trim().min(1))
      )
      .default(['*']),
    trustedProxies: z
      .preprocess(
        (value) => {
          if (Array.isArray(value)) return value;
          if (typeof value === 'string') return value.split(',');

          return [value];
        },
        z.array(z.string().trim().min(1))
      )
      .default([])
  }),
  oidc: z.object({
    enabled: z.coerce.boolean(),
    issuer: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
    redirectUri: z.string(),
    disableLocalLogin: z.coerce.boolean()
  }),
  webRtc: z.object({
    port: z.coerce.number().int().positive(),
    announcedAddress: z.string(),
    maxBitrate: z.coerce.number().int().positive()
  }),
  rateLimiters: z.object({
    enabled: z.coerce.boolean(),
    sendAndEditMessage: zRateLimiter,
    joinVoiceChannel: zRateLimiter,
    moveMembers: zRateLimiter,
    login: zRateLimiter,
    loginLockout: zFailedAttemptsLimiter,
    joinServer: zRateLimiter,
    upload: zRateLimiter,
    search: zRateLimiter,
    calendarRead: zRateLimiter,
    calendarWrite: zRateLimiter,
    signalTyping: zRateLimiter,
    getMessages: zRateLimiter,
    markAsRead: zRateLimiter,
    toggleMessageReaction: zRateLimiter,
    addEmoji: zRateLimiter,
    openDirectMessage: zRateLimiter,
    handshake: zRateLimiter,
    updatePassword: zRateLimiter,
    adminCreate: zRateLimiter,
    voiceTransport: zRateLimiter,
    voiceStream: zRateLimiter,
    voiceReaction: zRateLimiter,
    soundboardPlay: zRateLimiter,
    soundboardManage: zRateLimiter,
    useSecretToken: zRateLimiter,
    pluginExecute: zRateLimiter,
    pluginRoute: zRateLimiter,
    oidc: zRateLimiter,
    reportClientError: zRateLimiter,
    botApi: zRateLimiter,
    botApiAuthFailure: zRateLimiter,
    botAutocomplete: zRateLimiter
  })
});

type TConfig = z.infer<typeof zConfig>;

const defaultConfig: TConfig = {
  server: {
    host: '',
    port: 4991,
    debug: IS_DEVELOPMENT,
    autoupdate: false,
    monitor: true,
    backupDatabase: true,
    maxRequestBodyBytes: 256 * 1024,
    allowedOrigins: ['*'],
    trustedProxies: [
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      'fc00::/7'
    ]
  },
  oidc: {
    enabled: false,
    issuer: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    disableLocalLogin: false
  },
  webRtc: {
    port: 40000,
    announcedAddress: '',
    maxBitrate: 30_000_000 // 30 Mbps
  },
  rateLimiters: {
    enabled: true,
    sendAndEditMessage: {
      maxRequests: 15,
      windowMs: 60_000
    },
    joinVoiceChannel: {
      maxRequests: 20,
      windowMs: 60_000
    },
    moveMembers: {
      maxRequests: 20,
      windowMs: 60_000
    },
    login: {
      maxRequests: 5,
      windowMs: 60_000
    },
    loginLockout: {
      maxFailures: 20,
      windowMs: 15 * 60_000,
      blockMs: 15 * 60_000,
      maxBlockMs: 24 * 60 * 60_000
    },
    joinServer: {
      maxRequests: 5,
      windowMs: 60_000
    },
    upload: {
      maxRequests: 30,
      windowMs: 60_000
    },
    calendarRead: { maxRequests: 60, windowMs: 60_000 },
    calendarWrite: { maxRequests: 20, windowMs: 60_000 },
    search: {
      maxRequests: 15,
      windowMs: 60_000
    },
    signalTyping: {
      maxRequests: 40,
      windowMs: 5_000
    },
    getMessages: {
      maxRequests: 60,
      windowMs: 10_000
    },
    markAsRead: {
      maxRequests: 60,
      windowMs: 10_000
    },
    toggleMessageReaction: {
      maxRequests: 60,
      windowMs: 10_000
    },
    addEmoji: {
      maxRequests: 10,
      windowMs: 60_000
    },
    openDirectMessage: {
      maxRequests: 10,
      windowMs: 60_000
    },
    handshake: {
      maxRequests: 10,
      windowMs: 60_000
    },
    updatePassword: {
      maxRequests: 5,
      windowMs: 60_000
    },
    adminCreate: {
      maxRequests: 60,
      windowMs: 60_000
    },
    voiceTransport: {
      maxRequests: 30,
      windowMs: 60_000
    },
    voiceStream: {
      maxRequests: 200,
      windowMs: 60_000
    },
    voiceReaction: {
      maxRequests: 20,
      windowMs: 30_000
    },
    soundboardPlay: {
      maxRequests: 5,
      windowMs: 10_000
    },
    soundboardManage: {
      maxRequests: 20,
      windowMs: 60_000
    },
    useSecretToken: {
      maxRequests: 5,
      windowMs: 60_000
    },
    pluginExecute: {
      maxRequests: 60,
      windowMs: 60_000
    },
    pluginRoute: {
      maxRequests: 300,
      windowMs: 60_000
    },
    oidc: {
      maxRequests: 30,
      windowMs: 60_000
    },
    reportClientError: {
      maxRequests: 20,
      windowMs: 60_000
    },
    // discord allows a bot 50 requests a second across every route
    botApi: {
      maxRequests: 50,
      windowMs: 1_000
    },
    botApiAuthFailure: {
      maxRequests: 20,
      windowMs: 60_000
    },
    // a member typing into an option the bot completes asks once a pause
    botAutocomplete: {
      maxRequests: 60,
      windowMs: 60_000
    }
  }
};

let config: TConfig = structuredClone(defaultConfig);

await ensureServerDirs();

const configExists = await fs.exists(CONFIG_INI_PATH);

if (!configExists) {
  // config does not exist, create it with the default config
  await fs.writeFile(CONFIG_INI_PATH, stringify(config));
} else {
  try {
    // config exists, we need to make sure it is up to date with the schema
    // to make this easy, we will read the existing config, merge it with the default config, and write it back to the file
    // this way we don't have to worry about migrating old config files when we add/remove config options
    const existingConfigText = await fs.readFile(CONFIG_INI_PATH, {
      encoding: 'utf-8'
    });

    const existingConfig = parse(existingConfigText) as Partial<TConfig>;
    const mergedConfig = deepMerge(config, existingConfig);

    config = zConfig.parse(mergedConfig);

    await fs.writeFile(CONFIG_INI_PATH, stringify(config));
  } catch (error) {
    // something went wrong, just log the error and overwrite the config file with the default config
    console.error(
      `Error reading or parsing config.ini. Overwriting with default config. Error: ${getErrorMessage(error)}`
    );

    await fs.writeFile(CONFIG_INI_PATH, stringify(config));
  }
}

const envOverridesMap: Record<string, string> = {
  'server.host': 'SANDSHARK_HOST',
  'server.port': 'SANDSHARK_PORT',
  'server.debug': 'SANDSHARK_DEBUG',
  'server.autoupdate': 'SANDSHARK_AUTOUPDATE',
  'server.monitor': 'SANDSHARK_MONITOR',
  'server.backupDatabase': 'SANDSHARK_BACKUP_DATABASE',
  'server.maxRequestBodyBytes': 'SANDSHARK_MAX_REQUEST_BODY_BYTES',
  'server.allowedOrigins': 'SANDSHARK_ALLOWED_ORIGINS',
  'server.trustedProxies': 'SANDSHARK_TRUSTED_PROXIES',
  'oidc.enabled': 'SANDSHARK_OIDC_ENABLED',
  'oidc.issuer': 'SANDSHARK_OIDC_ISSUER',
  'oidc.clientId': 'SANDSHARK_OIDC_CLIENT_ID',
  'oidc.clientSecret': 'SANDSHARK_OIDC_CLIENT_SECRET',
  'oidc.redirectUri': 'SANDSHARK_OIDC_REDIRECT_URI',
  'oidc.disableLocalLogin': 'SANDSHARK_OIDC_DISABLE_LOCAL_LOGIN',
  'webRtc.port': 'SANDSHARK_WEBRTC_PORT',
  'webRtc.announcedAddress': 'SANDSHARK_WEBRTC_ANNOUNCED_ADDRESS',
  'webRtc.maxBitrate': 'SANDSHARK_WEBRTC_MAX_BITRATE',
  'rateLimiters.enabled': 'SANDSHARK_RATE_LIMITERS_ENABLED'
};

// validated again after the overrides, otherwise an env var could put a value
// in the config that does not match its type at all
config = zConfig.parse(applyEnvOverrides(config, envOverridesMap));
config = IS_TEST ? config : deepFreeze(config);

const SERVER_PRIVATE_IP = await getPrivateIp();

// only used as the mediasoup announced address when the operator has not set
// one, so an explicit announcedAddress makes the third party lookup pointless
const SERVER_PUBLIC_IP = config.webRtc.announcedAddress
  ? undefined
  : await getPublicIp();

export {
  config,
  deepFreeze,
  defaultConfig,
  envOverridesMap,
  SERVER_PRIVATE_IP,
  SERVER_PUBLIC_IP,
  zConfig
};

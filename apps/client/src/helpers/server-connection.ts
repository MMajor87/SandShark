import type { TServerInfo } from '@sharkord/shared';
import { isDesktopClient } from '@/platform/environment';
import {
  getLocalStorageItemAsJSON,
  getLocalStorageItem,
  LocalStorageKey,
  removeLocalStorageItem,
  setLocalStorageItem,
  setLocalStorageItemAsJSON
} from './storage';

export type TServerConnectionConfig = {
  httpUrl: string;
  websocketUrl: string;
  displayName?: string;
  serverId?: string;
};

export type TServerProfile = TServerConnectionConfig & {
  id: string;
  icon?: string;
  lastConnected: number;
  preferences: Record<string, unknown>;
};

const normalizeServerUrl = (value: string) => {
  const input = value.trim();

  if (!input) {
    throw new Error('Enter a Sharkord server URL.');
  }

  const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error('Use an HTTP or HTTPS server URL.');
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Enter the server origin without a path, query, or hash.');
  }

  return url.origin;
};

const getWebSocketUrl = (httpUrl: string) => {
  const url = new URL(httpUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  return url.origin;
};

const getBrowserServerConnection = (): TServerConnectionConfig => {
  const httpUrl =
    import.meta.env.MODE === 'development'
      ? 'http://localhost:4991'
      : window.location.origin;

  return {
    httpUrl,
    websocketUrl: getWebSocketUrl(httpUrl)
  };
};

const getLegacyServerConnection = () => {
  const stored = getLocalStorageItemAsJSON<TServerConnectionConfig>(
    LocalStorageKey.SERVER_CONNECTION
  );

  if (!stored?.httpUrl || !stored.websocketUrl) return undefined;

  try {
    const httpUrl = normalizeServerUrl(stored.httpUrl);

    return {
      ...stored,
      httpUrl,
      websocketUrl: getWebSocketUrl(httpUrl)
    };
  } catch {
    return undefined;
  }
};

const getServerProfiles = (): TServerProfile[] => {
  const profiles = getLocalStorageItemAsJSON<TServerProfile[]>(
    LocalStorageKey.SERVER_PROFILES,
    []
  );

  return (profiles ?? [])
    .flatMap((profile) => {
      if (!profile?.id || !profile.httpUrl) return [];

      try {
        const httpUrl = normalizeServerUrl(profile.httpUrl);

        // Older SandShark builds did not persist every profile metadata field.
        // Reconstruct those values so existing servers remain selectable.
        return [
          {
            ...profile,
            httpUrl,
            websocketUrl: getWebSocketUrl(httpUrl),
            lastConnected:
              typeof profile.lastConnected === 'number'
                ? profile.lastConnected
                : 0,
            preferences: profile.preferences ?? {}
          }
        ];
      } catch {
        return [];
      }
    })
    .sort((left, right) => right.lastConnected - left.lastConnected);
};

const saveServerProfiles = (profiles: TServerProfile[]) => {
  setLocalStorageItemAsJSON(LocalStorageKey.SERVER_PROFILES, profiles);
};

const getActiveServerProfileId = () =>
  getLocalStorageItem(LocalStorageKey.ACTIVE_SERVER_PROFILE_ID) ?? undefined;

const setActiveServerProfileId = (profileId: string | undefined) => {
  if (profileId) {
    setLocalStorageItem(LocalStorageKey.ACTIVE_SERVER_PROFILE_ID, profileId);
    return;
  }

  removeLocalStorageItem(LocalStorageKey.ACTIVE_SERVER_PROFILE_ID);
};

const getActiveServerProfile = () => {
  const profiles = getServerProfiles();
  const activeProfileId = getActiveServerProfileId();
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);

  if (activeProfile) return activeProfile;

  if (profiles.length > 0) {
    setActiveServerProfileId(profiles[0]!.id);
    return profiles[0];
  }

  const legacyConnection = getLegacyServerConnection();

  if (!legacyConnection) return profiles[0];

  const profile: TServerProfile = {
    ...legacyConnection,
    id: legacyConnection.serverId ?? legacyConnection.httpUrl,
    icon: `${legacyConnection.httpUrl}/favicon.ico`,
    lastConnected: Date.now(),
    preferences: {}
  };

  saveServerProfiles([profile, ...profiles]);
  setActiveServerProfileId(profile.id);

  return profile;
};

const getStoredServerConnection = () => getActiveServerProfile();

const getServerConnection = () => {
  if (!isDesktopClient()) {
    return getBrowserServerConnection();
  }

  return getStoredServerConnection();
};

const saveServerConnection = (
  config: TServerConnectionConfig,
  options?: {
    existingProfileId?: string;
    icon?: string;
    preferences?: Record<string, unknown>;
  }
) => {
  const profiles = getServerProfiles();
  const profileId = config.serverId ?? config.httpUrl;
  const existingProfile = profiles.find(
    (profile) =>
      profile.id === options?.existingProfileId || profile.id === profileId
  );
  const profile: TServerProfile = {
    ...existingProfile,
    ...config,
    id: profileId,
    icon:
      options?.icon ??
      existingProfile?.icon ??
      `${config.httpUrl}/favicon.ico`,
    lastConnected: existingProfile?.lastConnected ?? Date.now(),
    preferences: options?.preferences ?? existingProfile?.preferences ?? {}
  };
  const withoutReplacedProfile = profiles.filter(
    (item) =>
      item.id !== profileId && item.id !== options?.existingProfileId
  );

  saveServerProfiles([profile, ...withoutReplacedProfile]);
  setActiveServerProfileId(profile.id);

  // Keep the previous single-server value available for a seamless downgrade.
  setLocalStorageItemAsJSON(LocalStorageKey.SERVER_CONNECTION, config);

  return profile;
};

const selectServerProfile = (profileId: string) => {
  const profile = getServerProfiles().find((item) => item.id === profileId);

  if (!profile) return undefined;

  setActiveServerProfileId(profile.id);
  setLocalStorageItemAsJSON(LocalStorageKey.SERVER_CONNECTION, profile);

  return profile;
};

const removeServerProfile = (profileId: string) => {
  const profiles = getServerProfiles();
  const remainingProfiles = profiles.filter((profile) => profile.id !== profileId);

  if (remainingProfiles.length === profiles.length) return undefined;

  saveServerProfiles(remainingProfiles);

  if (getActiveServerProfileId() === profileId) {
    const nextProfile = remainingProfiles[0];
    setActiveServerProfileId(nextProfile?.id);

    if (nextProfile) {
      setLocalStorageItemAsJSON(LocalStorageKey.SERVER_CONNECTION, nextProfile);
    } else {
      removeLocalStorageItem(LocalStorageKey.SERVER_CONNECTION);
    }
  }

  return remainingProfiles;
};

const markActiveServerProfileConnected = () => {
  const profile = getActiveServerProfile();

  if (!profile) return;

  const profiles = getServerProfiles().map((item) =>
    item.id === profile.id ? { ...item, lastConnected: Date.now() } : item
  );

  saveServerProfiles(profiles);
};

const validateServerConnection = async (value: string) => {
  const httpUrl = normalizeServerUrl(value);

  let response: Response;

  try {
    response = await fetch(`${httpUrl}/info`);
  } catch {
    throw new Error(
      'Could not reach that server. Check the URL and try again.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `The server returned ${response.status} while checking /info.`
    );
  }

  let info: TServerInfo;

  try {
    info = (await response.json()) as TServerInfo;
  } catch {
    throw new Error('The server returned an invalid /info response.');
  }

  if (
    typeof info.serverId !== 'string' ||
    typeof info.name !== 'string' ||
    typeof info.version !== 'string'
  ) {
    throw new Error('This endpoint does not appear to be a Sharkord server.');
  }

  return {
    config: {
      httpUrl,
      websocketUrl: getWebSocketUrl(httpUrl),
      displayName: info.name,
      serverId: info.serverId
    },
    info,
    icon: info.logo ? `${httpUrl}/public/${info.logo.name}` : undefined
  };
};

export {
  getActiveServerProfile,
  getActiveServerProfileId,
  getServerConnection,
  getServerProfiles,
  getStoredServerConnection,
  markActiveServerProfileConnected,
  removeServerProfile,
  saveServerConnection,
  selectServerProfile,
  setActiveServerProfileId,
  validateServerConnection
};

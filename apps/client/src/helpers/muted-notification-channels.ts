import { getActiveServerProfileId } from './server-connection';
import {
  getLocalStorageItemAsJSON,
  LocalStorageKey,
  setLocalStorageItemAsJSON
} from './storage';

type TMutedNotificationChannels = Record<string, number[]>;

const getProfileKey = () => getActiveServerProfileId() ?? 'default';

const getMutedChannels = (): TMutedNotificationChannels =>
  getLocalStorageItemAsJSON<TMutedNotificationChannels>(
    LocalStorageKey.MUTED_NOTIFICATION_CHANNELS,
    {}
  ) ?? {};

const getMutedNotificationChannelIds = () =>
  getMutedChannels()[getProfileKey()] ?? [];

const setMutedNotificationChannelIds = (channelIds: number[]) => {
  const mutedChannels = getMutedChannels();
  mutedChannels[getProfileKey()] = channelIds;
  setLocalStorageItemAsJSON(
    LocalStorageKey.MUTED_NOTIFICATION_CHANNELS,
    mutedChannels
  );
};

export { getMutedNotificationChannelIds, setMutedNotificationChannelIds };

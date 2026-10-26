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

const isChannelNotificationsMuted = (channelId: number) =>
  getMutedChannels()[getProfileKey()]?.includes(channelId) ?? false;

const toggleChannelNotificationsMuted = (channelId: number) => {
  const mutedChannels = getMutedChannels();
  const profileKey = getProfileKey();
  const channelIds = new Set(mutedChannels[profileKey] ?? []);

  if (channelIds.has(channelId)) channelIds.delete(channelId);
  else channelIds.add(channelId);

  mutedChannels[profileKey] = [...channelIds];
  setLocalStorageItemAsJSON(
    LocalStorageKey.MUTED_NOTIFICATION_CHANNELS,
    mutedChannels
  );

  return channelIds.has(channelId);
};

export {
  getMutedNotificationChannelIds,
  isChannelNotificationsMuted,
  setMutedNotificationChannelIds,
  toggleChannelNotificationsMuted
};

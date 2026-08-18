import {
  getPlatformLocalStorageItem,
  getPlatformSessionStorageItem,
  removePlatformLocalStorageItem,
  removePlatformSessionStorageItem,
  setPlatformLocalStorageItem,
  setPlatformSessionStorageItem
} from '@/platform/storage';

export enum LocalStorageKey {
  IDENTITY = 'sharkord-identity',
  REMEMBER_CREDENTIALS = 'sharkord-remember-identity',
  USER_PASSWORD = 'sharkord-user-password',
  SERVER_PASSWORD = 'sharkord-server-password',
  VITE_UI_THEME = 'vite-ui-theme',
  DEVICES_SETTINGS = 'sharkord-devices-settings',
  FLOATING_CARD_POSITION = 'sharkord-floating-card-position',
  RIGHT_SIDEBAR_STATE = 'sharkord-right-sidebar-state',
  VOICE_CHAT_SIDEBAR_STATE = 'sharkord-voice-chat-sidebar-state',
  VOICE_CHAT_SIDEBAR_CHANNEL_ID = 'sharkord-voice-chat-sidebar-channel-id',
  VOICE_CHAT_SIDEBAR_WIDTH = 'sharkord-voice-chat-sidebar-width',
  VOICE_CHAT_SHOW_USER_BANNERS = 'sharkord-voice-chat-show-user-banners',
  VOLUME_SETTINGS = 'sharkord-volume-settings',
  STREAM_QUALITY_SETTINGS = 'sharkord-stream-quality-settings',
  RECENT_EMOJIS = 'sharkord-recent-emojis',
  DEBUG = 'sharkord-debug',
  DRAFT_MESSAGES = 'sharkord-draft-messages',
  HIDE_NON_VIDEO_PARTICIPANTS = 'sharkord-hide-non-video-participants',
  THREAD_SIDEBAR_WIDTH = 'sharkord-thread-sidebar-width',
  LEFT_SIDEBAR_WIDTH = 'sharkord-left-sidebar-width',
  RIGHT_SIDEBAR_WIDTH = 'sharkord-right-sidebar-width',
  CATEGORIES_EXPANDED = 'sharkord-categories-expanded',
  AUTO_LOGIN = 'sharkord-auto-login',
  AUTO_LOGIN_TOKEN = 'sharkord-auto-login-token',
  LAST_SELECTED_CHANNEL = 'sharkord-last-selected-channel',
  AUTO_JOIN_LAST_CHANNEL = 'sharkord-auto-join-last-channel',
  BROWSER_NOTIFICATIONS = 'sharkord-browser-notifications',
  BROWSER_NOTIFICATIONS_FOR_MENTIONS = 'sharkord-browser-notifications-for-mentions',
  BROWSER_NOTIFICATIONS_FOR_DMS = 'sharkord-browser-notifications-for-dms',
  CHAT_INPUT_HEIGHT_VH = 'sharkord-chat-input-height-vh',
  THREAD_INPUT_HEIGHT_VH = 'sharkord-thread-input-height-vh',
  BROWSER_NOTIFICATIONS_FOR_REPLIES = 'sharkord-browser-notifications-for-replies',
  LANGUAGE = 'sharkord-language',
  PLUGIN_SLOT_DEBUG = 'sharkord-plugin-slot-debug',
  HIDE_OWN_SCREEN_SHARE = 'sharkord-hide-own-screen-share',
  ALWAYS_SHOW_VOICE_CONTROLS = 'sharkord-always-show-voice-controls',
  SERVER_CONNECTION = 'sandshark-server-connection',
  SERVER_SESSIONS = 'sandshark-server-sessions',
  SERVER_PROFILES = 'sandshark-server-profiles',
  ACTIVE_SERVER_PROFILE_ID = 'sandshark-active-server-profile-id',
  PUSH_TO_TALK_SETTINGS = 'sandshark-push-to-talk-settings',
  MUTED_NOTIFICATION_CHANNELS = 'sandshark-muted-notification-channels'
}

export enum SessionStorageKey {
  TOKEN = 'sharkord-token',
  SERVER_SESSION_KEY = 'sandshark-server-session-key'
}

const getLocalStorageItem = (key: LocalStorageKey): string | null => {
  return getPlatformLocalStorageItem(key);
};

const getLocalStorageItemBool = (
  key: LocalStorageKey,
  defaultValue: boolean = false
): boolean => {
  const item = getPlatformLocalStorageItem(key);

  if (item === null) {
    return defaultValue ?? false;
  }

  return item === 'true';
};

const setLocalStorageItemBool = (
  key: LocalStorageKey,
  value: boolean
): void => {
  setPlatformLocalStorageItem(key, value.toString());
};

const getLocalStorageItemAsNumber = (
  key: LocalStorageKey,
  defaultValue?: number
): number | undefined => {
  const item = getPlatformLocalStorageItem(key);

  if (item === null) {
    return defaultValue;
  }

  const parsed = parseInt(item, 10);

  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const getLocalStorageItemAsJSON = <T>(
  key: LocalStorageKey,
  defaultValue: T | undefined = undefined
): T | undefined => {
  const item = getPlatformLocalStorageItem(key);

  if (item) {
    return JSON.parse(item) as T;
  }

  return defaultValue;
};

const setLocalStorageItemAsJSON = <T>(key: LocalStorageKey, value: T): void => {
  setPlatformLocalStorageItem(key, JSON.stringify(value));
};

const setLocalStorageItem = (key: LocalStorageKey, value: string): void => {
  setPlatformLocalStorageItem(key, value);
};

const removeLocalStorageItem = (key: LocalStorageKey): void => {
  removePlatformLocalStorageItem(key);
};

const getSessionStorageItem = (key: SessionStorageKey): string | null => {
  return getPlatformSessionStorageItem(key);
};

const setSessionStorageItem = (key: SessionStorageKey, value: string): void => {
  setPlatformSessionStorageItem(key, value);
};

const removeSessionStorageItem = (key: SessionStorageKey): void => {
  removePlatformSessionStorageItem(key);
};

export {
  getLocalStorageItem,
  getLocalStorageItemAsJSON,
  getLocalStorageItemAsNumber,
  getLocalStorageItemBool,
  getSessionStorageItem,
  removeLocalStorageItem,
  removeSessionStorageItem,
  setLocalStorageItem,
  setLocalStorageItemAsJSON,
  setLocalStorageItemBool,
  setSessionStorageItem
};

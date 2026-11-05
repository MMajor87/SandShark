export enum LocalStorageKey {
  IDENTITY = 'sandshark-identity',
  USER_PASSWORD = 'sandshark-user-password',
  VITE_UI_THEME = 'vite-ui-theme',
  UI_ACCENT = 'sandshark-ui-accent',
  DEVICES_SETTINGS = 'sandshark-devices-settings',
  FLOATING_CARD_POSITION = 'sandshark-floating-card-position',
  RIGHT_SIDEBAR_STATE = 'sandshark-right-sidebar-state',
  VOICE_CHAT_SIDEBAR_STATE = 'sandshark-voice-chat-sidebar-state',
  VOICE_CHAT_SIDEBAR_CHANNEL_ID = 'sandshark-voice-chat-sidebar-channel-id',
  VOICE_CHAT_SIDEBAR_WIDTH = 'sandshark-voice-chat-sidebar-width',
  VOICE_CHAT_SHOW_USER_BANNERS = 'sandshark-voice-chat-show-user-banners',
  VOLUME_SETTINGS = 'sandshark-volume-settings',
  STREAM_QUALITY_SETTINGS = 'sandshark-stream-quality-settings',
  RECENT_EMOJIS = 'sandshark-recent-emojis',
  DEBUG = 'sandshark-debug',
  DRAFT_MESSAGES = 'sandshark-draft-messages',
  HIDE_NON_VIDEO_PARTICIPANTS = 'sandshark-hide-non-video-participants',
  THREAD_SIDEBAR_WIDTH = 'sandshark-thread-sidebar-width',
  LEFT_SIDEBAR_WIDTH = 'sandshark-left-sidebar-width',
  RIGHT_SIDEBAR_WIDTH = 'sandshark-right-sidebar-width',
  CATEGORIES_EXPANDED = 'sandshark-categories-expanded',
  AUTO_LOGIN = 'sandshark-auto-login',
  AUTO_LOGIN_TOKEN = 'sandshark-auto-login-token',
  LAST_SELECTED_CHANNEL = 'sandshark-last-selected-channel',
  AUTO_JOIN_LAST_CHANNEL = 'sandshark-auto-join-last-channel',
  BROWSER_NOTIFICATIONS = 'sandshark-browser-notifications',
  BROWSER_NOTIFICATIONS_FOR_MENTIONS = 'sandshark-browser-notifications-for-mentions',
  BROWSER_NOTIFICATIONS_FOR_DMS = 'sandshark-browser-notifications-for-dms',
  CHAT_INPUT_HEIGHT_VH = 'sandshark-chat-input-height-vh',
  THREAD_INPUT_HEIGHT_VH = 'sandshark-thread-input-height-vh',
  BROWSER_NOTIFICATIONS_FOR_REPLIES = 'sandshark-browser-notifications-for-replies',
  LANGUAGE = 'sandshark-language',
  PLUGIN_SLOT_DEBUG = 'sandshark-plugin-slot-debug',
  HIDE_OWN_SCREEN_SHARE = 'sandshark-hide-own-screen-share',
  ALWAYS_SHOW_VOICE_CONTROLS = 'sandshark-always-show-voice-controls',
  SERVER_CONNECTION = 'sandshark-server-connection',
  SERVER_SESSIONS = 'sandshark-server-sessions',
  SERVER_PROFILES = 'sandshark-server-profiles',
  ACTIVE_SERVER_PROFILE_ID = 'sandshark-active-server-profile-id',
  PUSH_TO_TALK_SETTINGS = 'sandshark-push-to-talk-settings',
  MUTED_NOTIFICATION_CHANNELS = 'sandshark-muted-notification-channels',
  NOTIFICATION_SOUNDS = 'sandshark-notification-sounds',
  MESSAGE_SENT_SOUND = 'sandshark-message-sent-sound',
  MUTED_CHANNEL_IDS = 'sandshark-muted-channel-ids',
  HOTKEY_BINDINGS = 'sandshark-hotkey-bindings',
  HOTKEY_BRIDGE_TOKEN = 'sandshark-hotkey-bridge-token',
  MIC_MODE = 'sandshark-mic-mode',
  HOTKEYS_ENABLED = 'sandshark-hotkeys-enabled',
  SOUNDBOARD_VOLUME = 'sandshark-soundboard-volume'
}

export enum SessionStorageKey {
  TOKEN = 'sandshark-token',
  SERVER_SESSION_KEY = 'sandshark-server-session-key',
  OIDC_NO_AUTO_REDIRECT = 'sandshark-oidc-no-auto-redirect'
}

// librewolf and firefox private mode throw SecurityError when privacy hardening
// blocks storage access, so every read/write has to survive the storage being gone
const readItem = (kind: 'local' | 'session', key: string): string | null => {
  try {
    const storage = kind === 'local' ? localStorage : sessionStorage;

    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeItem = (kind: 'local' | 'session', key: string, value: string) => {
  try {
    const storage = kind === 'local' ? localStorage : sessionStorage;

    storage.setItem(key, value);
  } catch {
    // storage is unavailable, the value just does not persist
  }
};

const deleteItem = (kind: 'local' | 'session', key: string) => {
  try {
    const storage = kind === 'local' ? localStorage : sessionStorage;

    storage.removeItem(key);
  } catch {
    // storage is unavailable, nothing to remove
  }
};

const KEY_PREFIX = 'sandshark-';
// keys used to carry the name of the project this client was forked from
const LEGACY_KEY_PREFIX = 'sharkord-';

const migrateLegacyKeys = (kind: 'local' | 'session', keys: string[]) => {
  for (const key of keys) {
    if (!key.startsWith(KEY_PREFIX)) continue;

    const legacyKey = `${LEGACY_KEY_PREFIX}${key.slice(KEY_PREFIX.length)}`;
    const legacyValue = readItem(kind, legacyKey);

    if (legacyValue === null) continue;

    // a value saved under the new key is newer than the legacy one, keep it
    if (readItem(kind, key) === null) {
      writeItem(kind, key, legacyValue);
    }

    deleteItem(kind, legacyKey);
  }
};

const migrateLegacyStorageKeys = () => {
  migrateLegacyKeys('local', Object.values(LocalStorageKey));
  migrateLegacyKeys('session', Object.values(SessionStorageKey));
};

// runs on import, before any module can read a key, so upgraded clients keep
// their saved logins, devices and settings
migrateLegacyStorageKeys();

const getLocalStorageItem = (key: LocalStorageKey): string | null => {
  return readItem('local', key);
};

const getLocalStorageItemBool = (
  key: LocalStorageKey,
  defaultValue: boolean = false
): boolean => {
  const item = readItem('local', key);

  if (item === null) {
    return defaultValue ?? false;
  }

  return item === 'true';
};

const setLocalStorageItemBool = (
  key: LocalStorageKey,
  value: boolean
): void => {
  writeItem('local', key, value.toString());
};

const getLocalStorageItemAsNumber = (
  key: LocalStorageKey,
  defaultValue?: number
): number | undefined => {
  const item = readItem('local', key);

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
  const item = readItem('local', key);

  if (item) {
    try {
      return JSON.parse(item) as T;
    } catch {
      return defaultValue;
    }
  }

  return defaultValue;
};

const setLocalStorageItemAsJSON = <T>(key: LocalStorageKey, value: T): void => {
  writeItem('local', key, JSON.stringify(value));
};

const setLocalStorageItem = (key: LocalStorageKey, value: string): void => {
  writeItem('local', key, value);
};

const removeLocalStorageItem = (key: LocalStorageKey): void => {
  deleteItem('local', key);
};

const getSessionStorageItem = (key: SessionStorageKey): string | null => {
  return readItem('session', key);
};

const setSessionStorageItem = (key: SessionStorageKey, value: string): void => {
  writeItem('session', key, value);
};

const removeSessionStorageItem = (key: SessionStorageKey): void => {
  deleteItem('session', key);
};

export {
  getLocalStorageItem,
  getLocalStorageItemAsJSON,
  getLocalStorageItemAsNumber,
  getLocalStorageItemBool,
  getSessionStorageItem,
  migrateLegacyStorageKeys,
  removeLocalStorageItem,
  removeSessionStorageItem,
  setLocalStorageItem,
  setLocalStorageItemAsJSON,
  setLocalStorageItemBool,
  setSessionStorageItem
};

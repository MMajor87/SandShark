import { isBrowserClient } from '@/platform/environment';
import { getServerConnection } from './server-connection';
import {
  getLocalStorageItem,
  getLocalStorageItemAsJSON,
  getLocalStorageItemBool,
  getSessionStorageItem,
  LocalStorageKey,
  removeLocalStorageItem,
  removeSessionStorageItem,
  SessionStorageKey,
  setLocalStorageItemAsJSON,
  setSessionStorageItem
} from './storage';

type TServerSession = {
  identity?: string;
  // Legacy browser-only storage field. Desktop sessions are migrated to safeStorage.
  autoLoginToken?: string;
};

type TServerSessions = Record<string, TServerSession>;

const getServerSessionKey = () => {
  const connection = getServerConnection();

  if (!connection) return undefined;

  return connection.serverId ?? connection.httpUrl;
};

const getServerSessions = (): TServerSessions =>
  getLocalStorageItemAsJSON<TServerSessions>(
    LocalStorageKey.SERVER_SESSIONS,
    {}
  ) ?? {};

const saveServerSessions = (sessions: TServerSessions) => {
  setLocalStorageItemAsJSON(LocalStorageKey.SERVER_SESSIONS, sessions);
};

const getCurrentServerSession = (): TServerSession | undefined => {
  const key = getServerSessionKey();

  if (!key) return undefined;

  return getServerSessions()[key];
};

const updateCurrentServerSession = (
  update: (session: TServerSession) => TServerSession | undefined
) => {
  const key = getServerSessionKey();

  if (!key) return;

  const sessions = getServerSessions();
  const nextSession = update(sessions[key] ?? {});

  if (nextSession) sessions[key] = nextSession;
  else delete sessions[key];

  saveServerSessions(sessions);
};

const setCurrentSessionToken = (token: string) => {
  const key = getServerSessionKey();

  if (!key) {
    throw new Error('No Sharkord server has been selected.');
  }

  setSessionStorageItem(SessionStorageKey.TOKEN, token);
  setSessionStorageItem(SessionStorageKey.SERVER_SESSION_KEY, key);
};

const getCurrentSessionToken = () => {
  const key = getServerSessionKey();
  const sessionKey = getSessionStorageItem(SessionStorageKey.SERVER_SESSION_KEY);

  if (!key || sessionKey !== key) {
    removeSessionStorageItem(SessionStorageKey.TOKEN);
    removeSessionStorageItem(SessionStorageKey.SERVER_SESSION_KEY);
    return null;
  }

  return getSessionStorageItem(SessionStorageKey.TOKEN);
};

const clearCurrentSessionToken = () => {
  removeSessionStorageItem(SessionStorageKey.TOKEN);
  removeSessionStorageItem(SessionStorageKey.SERVER_SESSION_KEY);
};

const getDesktopAutoLoginSecretKey = () => {
  const key = getServerSessionKey();
  return key ? `auto-login:${key}` : undefined;
};

const saveServerLogin = async ({
  identity,
  token,
  autoLogin
}: {
  identity: string;
  token: string;
  autoLogin: boolean;
}) => {
  updateCurrentServerSession((session) => {
    const { autoLoginToken: _legacyToken, ...rest } = session;
    return { ...rest, identity };
  });

  if (isBrowserClient()) {
    updateCurrentServerSession((session) => ({
      ...session,
      autoLoginToken: autoLogin ? token : undefined
    }));
  } else {
    const secretKey = getDesktopAutoLoginSecretKey();
    if (secretKey && window.sandSharkDesktop) {
      if (autoLogin) await window.sandSharkDesktop.setSecret({ key: secretKey, value: token });
      else await window.sandSharkDesktop.removeSecret(secretKey);
    }
  }
  setCurrentSessionToken(token);
};

const getCurrentServerIdentity = () => {
  const session = getCurrentServerSession();

  if (session?.identity) return session.identity;

  // Browser storage is origin-scoped, so this migration cannot cross servers.
  if (isBrowserClient()) {
    return getLocalStorageItem(LocalStorageKey.IDENTITY) ?? undefined;
  }

  return undefined;
};

const getCurrentServerAutoLoginToken = async () => {
  if (!isBrowserClient()) {
    const secretKey = getDesktopAutoLoginSecretKey();
    if (!secretKey || !window.sandSharkDesktop) return undefined;

    const legacyToken = getCurrentServerSession()?.autoLoginToken;
    if (legacyToken) {
      updateCurrentServerSession((session) => {
        const { autoLoginToken: _token, ...rest } = session;
        return Object.keys(rest).length > 0 ? rest : undefined;
      });

      if (await window.sandSharkDesktop.setSecret({
        key: secretKey,
        value: legacyToken
      })) {
        return legacyToken;
      }
    }

    return window.sandSharkDesktop.getSecret(secretKey);
  }

  const token = getCurrentServerSession()?.autoLoginToken;

  if (token) return token;

  // Browser storage is origin-scoped, so legacy auto-login data is safe to migrate.
  if (
    isBrowserClient() &&
    getLocalStorageItemBool(LocalStorageKey.AUTO_LOGIN)
  ) {
    return getLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN) ?? undefined;
  }

  return undefined;
};

const clearCurrentServerAutoLogin = () => {
  updateCurrentServerSession((session) => {
    const { autoLoginToken: _token, ...rest } = session;

    return Object.keys(rest).length > 0 ? rest : undefined;
  });
  clearCurrentSessionToken();

  const secretKey = getDesktopAutoLoginSecretKey();
  if (secretKey && window.sandSharkDesktop) {
    void window.sandSharkDesktop.removeSecret(secretKey);
  }

  if (isBrowserClient()) {
    removeLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN);
  }
};

const clearCurrentServerSession = () => {
  const secretKey = getDesktopAutoLoginSecretKey();
  updateCurrentServerSession(() => undefined);
  clearCurrentSessionToken();

  if (secretKey && window.sandSharkDesktop) {
    void window.sandSharkDesktop.removeSecret(secretKey);
  }

  if (isBrowserClient()) {
    removeLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN);
    removeLocalStorageItem(LocalStorageKey.IDENTITY);
    removeLocalStorageItem(LocalStorageKey.USER_PASSWORD);
  }
};

const clearServerSessionByKey = (key: string) => {
  const sessions = getServerSessions();

  if (!(key in sessions)) return;

  delete sessions[key];
  saveServerSessions(sessions);

  if (window.sandSharkDesktop) {
    void window.sandSharkDesktop.removeSecret(`auto-login:${key}`);
  }

  if (getServerSessionKey() === key) {
    clearCurrentSessionToken();
  }
};

export {
  clearCurrentServerAutoLogin,
  clearCurrentServerSession,
  clearCurrentSessionToken,
  clearServerSessionByKey,
  getCurrentServerAutoLoginToken,
  getCurrentServerIdentity,
  getCurrentSessionToken,
  saveServerLogin,
  setCurrentSessionToken
};

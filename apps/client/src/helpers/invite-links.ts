import { INVITE_CODE_REGEX } from '@sandshark/shared';
import { getUrlFromServer } from './get-file-url';
import {
  getSessionStorageItem,
  removeSessionStorageItem,
  SessionStorageKey,
  setSessionStorageItem
} from './storage';

// an invite is one web address: <server>/?invite=<code>. the browser opens the web client with
// it, the desktop app accepts it pasted into the server picker, and the web client offers to
// hand it to the app as sandshark://invite/<server>/<code>, the server being the whole origin
// so a server without tls is not turned into https

type TInvite = {
  serverUrl: string;
  code: string;
};

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export const isInviteCode = (
  value: string | null | undefined
): value is string => !!value && INVITE_CODE_REGEX.test(value);

export const buildInviteLink = (serverUrl: string, code: string) => {
  const { origin } = new URL(serverUrl);

  return `${origin}/?invite=${encodeURIComponent(code)}`;
};

export const buildInviteDeepLink = (serverUrl: string, code: string) => {
  const { origin } = new URL(serverUrl);

  return `sandshark://invite/${encodeURIComponent(origin)}/${encodeURIComponent(code)}`;
};

// true for an address only this computer can reach, which makes a useless link for anyone
// else. a lan address is left alone: it is exactly right for people on the same network
export const isLoopbackServer = (serverUrl: string) => {
  try {
    const { hostname } = new URL(serverUrl);

    return LOOPBACK_HOSTNAMES.has(hostname) || hostname.startsWith('127.');
  } catch {
    return false;
  }
};

// reads an invite link pasted or opened anywhere: the web form, with or without a trailing
// slash, or the app's own. undefined for anything else, a plain server address included
export const parseInviteLink = (value: string): TInvite | undefined => {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }

  if (url.username || url.password || url.hash) return undefined;

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    const code = url.searchParams.get('invite');

    if (url.pathname !== '/' || !isInviteCode(code)) return undefined;

    return { serverUrl: url.origin, code };
  }

  if (
    url.protocol !== 'sandshark:' ||
    url.hostname !== 'invite' ||
    url.search
  ) {
    return undefined;
  }

  let segments: string[];

  try {
    segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return undefined;
  }

  const [server, code] = segments;

  if (segments.length !== 2 || !server || !isInviteCode(code)) return undefined;

  try {
    const serverUrl = new URL(server);

    if (serverUrl.protocol !== 'http:' && serverUrl.protocol !== 'https:') {
      return undefined;
    }

    return { serverUrl: serverUrl.origin, code };
  } catch {
    return undefined;
  }
};

// the desktop app opens an invite by switching to its server, which shows that server's
// connect screen with no address to read the code from. the code waits here for it, for this
// window only, and only for the server it belongs to
export const setPendingInvite = (serverUrl: string, code: string) => {
  const { origin } = new URL(serverUrl);

  setSessionStorageItem(
    SessionStorageKey.PENDING_INVITE,
    JSON.stringify({ serverUrl: origin, code })
  );
};

export const getPendingInvite = (serverUrl: string): string | undefined => {
  const stored = getSessionStorageItem(SessionStorageKey.PENDING_INVITE);

  if (!stored) return undefined;

  try {
    const invite = JSON.parse(stored) as Partial<TInvite>;
    const { origin } = new URL(serverUrl);

    return invite.serverUrl === origin && isInviteCode(invite.code)
      ? invite.code
      : undefined;
  } catch {
    return undefined;
  }
};

export const clearPendingInvite = () => {
  removeSessionStorageItem(SessionStorageKey.PENDING_INVITE);
};

// the invite this sign in carries, for the password and the oidc sign in alike. the browser
// has it in its address; the desktop app has none, and finds the code it was handed, by a link
// or a pasted invite, waiting for the server it is connecting to
export const getCurrentInviteCode = (): string | undefined => {
  const fromAddress = new URLSearchParams(window.location.search).get('invite');

  if (isInviteCode(fromAddress)) return fromAddress;

  try {
    return getPendingInvite(getUrlFromServer());
  } catch {
    return undefined;
  }
};

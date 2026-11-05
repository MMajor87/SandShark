import { isDesktopClient } from '@/platform/environment';
import { getUrlFromServer } from './get-file-url';
import { getCurrentInviteCode } from './invite-links';
import {
  getSessionStorageItem,
  SessionStorageKey,
  setSessionStorageItem
} from './storage';

const isOidcAutoRedirectSuppressed = () =>
  getSessionStorageItem(SessionStorageKey.OIDC_NO_AUTO_REDIRECT) === 'true';

const suppressOidcAutoRedirect = () =>
  setSessionStorageItem(SessionStorageKey.OIDC_NO_AUTO_REDIRECT, 'true');

const getOidcHandoffCode = () =>
  new URLSearchParams(window.location.hash.slice(1)).get('oidc');

const startOidcLogin = async () => {
  suppressOidcAutoRedirect();

  const invite = getCurrentInviteCode();

  if (isDesktopClient() && window.sandSharkDesktop) {
    return window.sandSharkDesktop.startOidcLogin(getUrlFromServer(), invite);
  }
  const query = invite ? `?${new URLSearchParams({ invite })}` : '';
  window.location.href = `${getUrlFromServer()}/oidc/login${query}`;
};

export {
  getOidcHandoffCode,
  isOidcAutoRedirectSuppressed,
  startOidcLogin,
  suppressOidcAutoRedirect
};

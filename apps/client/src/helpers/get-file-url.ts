import { i18n } from '@/i18n';
import type { TFile } from '@sharkord/shared';
import { getMediaAccessToken } from './media-access-token';
import { getServerConnection } from './server-connection';

const getHostFromServer = () => {
  const connection = getServerConnection();

  if (!connection) {
    throw new Error(i18n.t('connect:noServerSelected'));
  }

  return new URL(connection.websocketUrl).host;
};

const getUrlFromServer = () => {
  const connection = getServerConnection();

  if (!connection) {
    throw new Error(i18n.t('connect:noServerSelected'));
  }

  return connection.httpUrl;
};

const getFileUrl = (file: TFile | undefined | null, authenticated = false) => {
  if (!file) return '';

  const url = getUrlFromServer();

  let baseUrl = `${url}/public/${encodeURIComponent(file.name)}`;

  if (file._accessToken) {
    baseUrl += `?accessToken=${file._accessToken}`;

    if (file._accessTokenExpiresAt) {
      baseUrl += `&expires=${file._accessTokenExpiresAt}`;
    }
  }

  if (authenticated) {
    const mediaToken = getMediaAccessToken();
    if (mediaToken)
      baseUrl += `${baseUrl.includes('?') ? '&' : '?'}mediaToken=${encodeURIComponent(mediaToken)}`;
  }
  return baseUrl;
};

export { getFileUrl, getHostFromServer, getUrlFromServer };

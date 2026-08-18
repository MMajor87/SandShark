import type { TFile } from '@sharkord/shared';
import { getServerConnection } from './server-connection';

const getHostFromServer = () => {
  const connection = getServerConnection();

  if (!connection) {
    throw new Error('No Sharkord server has been selected.');
  }

  return new URL(connection.websocketUrl).host;
};

const getUrlFromServer = () => {
  const connection = getServerConnection();

  if (!connection) {
    throw new Error('No Sharkord server has been selected.');
  }

  return connection.httpUrl;
};

const getFileUrl = (file: TFile | undefined | null) => {
  if (!file) return '';

  const url = getUrlFromServer();

  let baseUrl = `${url}/public/${file.name}`;

  if (file._accessToken) {
    baseUrl += `?accessToken=${file._accessToken}`;

    if (file._accessTokenExpiresAt) {
      baseUrl += `&expires=${file._accessTokenExpiresAt}`;
    }
  }

  return encodeURI(baseUrl);
};

export { getFileUrl, getHostFromServer, getUrlFromServer };

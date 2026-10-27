import { getServerConnection } from './server-connection';
import { getCurrentSessionToken } from './server-session';

let mediaAccess:
  | { token: string; session: string | null; server: string }
  | undefined;

export const setMediaAccessToken = (token: string) => {
  const connection = getServerConnection();
  mediaAccess = connection
    ? { token, session: getCurrentSessionToken(), server: connection.httpUrl }
    : undefined;
};

export const getMediaAccessToken = () => {
  if (
    !mediaAccess ||
    mediaAccess.session !== getCurrentSessionToken() ||
    mediaAccess.server !== getServerConnection()?.httpUrl
  )
    return undefined;
  return mediaAccess.token;
};

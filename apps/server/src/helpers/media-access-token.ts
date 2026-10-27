import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import { getServerTokenSync } from '../db/queries/server';
import { getUserById } from '../db/queries/users';

// a separate key prevents a media URL credential from authenticating an API session.
const getMediaKey = () =>
  createHmac('sha256', getServerTokenSync())
    .update('media-access')
    .digest('hex');

const createMediaAccessToken = (userId: number, tokenVersion: number) =>
  jwt.sign({ userId, tokenVersion }, getMediaKey(), {
    audience: 'media',
    expiresIn: '7d'
  });

const getMediaAccessUser = async (token: string | null) => {
  if (!token || token.length > 2048) return undefined;
  try {
    const payload = jwt.verify(token, getMediaKey(), {
      audience: 'media',
      algorithms: ['HS256']
    });
    if (typeof payload === 'string' || !Number.isSafeInteger(payload.userId)) {
      return undefined;
    }
    const user = await getUserById(payload.userId);
    if (!user || user.banned || user.tokenVersion !== payload.tokenVersion) {
      return undefined;
    }
    return user;
  } catch {
    return undefined;
  }
};

export { createMediaAccessToken, getMediaAccessUser };

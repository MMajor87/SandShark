import { expect, test } from 'bun:test';
import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import { getMockedToken } from '../../__tests__/helpers';
import { getServerTokenSync } from '../../db/queries/server';
import { getUserByToken } from '../../db/queries/users';
import {
  createMediaAccessToken,
  getMediaAccessUser
} from '../media-access-token';

test('media credentials cannot authenticate API sessions and vice versa', async () => {
  const media = createMediaAccessToken(2, 0);
  expect((await getMediaAccessUser(media))?.id).toBe(2);
  expect(await getUserByToken(media)).toBeUndefined();
  expect(await getMediaAccessUser(await getMockedToken(2))).toBeUndefined();
  expect(await getMediaAccessUser(`${media}invalid`)).toBeUndefined();
  expect(await getMediaAccessUser(null)).toBeUndefined();
  expect(await getMediaAccessUser('x'.repeat(2049))).toBeUndefined();
  expect(
    await getMediaAccessUser(createMediaAccessToken(999, 0))
  ).toBeUndefined();
});

test('expired media credentials are rejected', async () => {
  const key = createHmac('sha256', getServerTokenSync())
    .update('media-access')
    .digest('hex');
  const expired = jwt.sign({ userId: 2, tokenVersion: 0 }, key, {
    audience: 'media',
    expiresIn: -1
  });
  expect(await getMediaAccessUser(expired)).toBeUndefined();
});

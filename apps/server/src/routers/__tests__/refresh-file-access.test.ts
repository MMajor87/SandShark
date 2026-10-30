import type { TTempFile } from '@sharkord/shared';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
  getCaller,
  initTest,
  sendMessage,
  uploadFile
} from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { channels, settings } from '../../db/schema';
import { generateFileToken } from '../../helpers/files-crypto';

test('refreshes only files still visible to the caller', async () => {
  const { caller: owner, mockedToken } = await initTest();
  const { caller: member } = await initTest(2);
  const attachmentResponse = await uploadFile(
    new File(['attachment'], 'refresh.txt', { type: 'text/plain' }),
    mockedToken
  );
  const attachment = (await attachmentResponse.json()) as TTempFile;
  const messageId = await sendMessage(owner, {
    channelId: 1,
    content: 'attachment',
    files: [attachment.id]
  });
  const message = await owner.messages.getOne({ messageId });
  const fileId = message.files[0]!.id;

  const emojiResponse = await uploadFile(
    new File(['emoji'], 'refresh.png', { type: 'image/png' }),
    mockedToken
  );
  const emojiUpload = (await emojiResponse.json()) as TTempFile;
  await owner.emojis.add([{ fileId: emojiUpload.id, name: 'refresh' }]);
  const emoji = (await owner.emojis.getAll()).find(
    (item) => item.name === 'refresh'
  );
  expect(emoji).toBeDefined();

  const unsigned = await member.files.refreshAccess({ fileIds: [fileId] });
  expect(unsigned.files[0]?._accessToken).toBeUndefined();

  await tdb.update(settings).set({ storageSignedUrlsEnabled: true });

  const first = await member.files.refreshAccess({
    fileIds: [fileId, emoji!.file.id, 999999]
  });
  expect(first.files.map((file) => file.id).sort()).toEqual(
    [fileId, emoji!.file.id].sort()
  );
  expect(first.files.every((file) => !!file._accessToken)).toBe(true);
  expect(
    first.files.every((file) => file._accessTokenExpiresAt! > Date.now())
  ).toBe(true);
  expect(first.mediaAccessToken).toBeTruthy();

  const attachmentUrl = new URL(
    `${testsBaseUrl}/public/${encodeURIComponent(message.files[0]!.name)}`
  );
  const signedFile = first.files.find((file) => file.id === fileId)!;
  attachmentUrl.searchParams.set('accessToken', signedFile._accessToken!);
  attachmentUrl.searchParams.set(
    'expires',
    String(signedFile._accessTokenExpiresAt)
  );
  attachmentUrl.searchParams.set('mediaToken', first.mediaAccessToken);
  expect((await fetch(attachmentUrl)).status).toBe(200);
  const expiredAt = Date.now() - 1000;
  attachmentUrl.searchParams.set(
    'accessToken',
    generateFileToken(fileId, expiredAt)
  );
  attachmentUrl.searchParams.set('expires', String(expiredAt));
  expect((await fetch(attachmentUrl)).status).toBe(403);
  attachmentUrl.searchParams.set('accessToken', signedFile._accessToken!);
  attachmentUrl.searchParams.set(
    'expires',
    String(signedFile._accessTokenExpiresAt)
  );

  await tdb.update(channels).set({ private: true }).where(eq(channels.id, 1));
  const revoked = await member.files.refreshAccess({
    fileIds: [fileId, emoji!.file.id]
  });
  expect(revoked.files.map((file) => file.id)).toEqual([emoji!.file.id]);
  expect((await fetch(attachmentUrl)).status).toBe(404);
  expect(
    (await owner.files.refreshAccess({ fileIds: [fileId] })).files
  ).toHaveLength(1);
});

test('refreshes media access without signed URLs or loaded files', async () => {
  const { caller } = await initTest(2);
  const result = await caller.files.refreshAccess({ fileIds: [] });
  expect(result.files).toEqual([]);
  expect(result.mediaAccessToken).toBeTruthy();
});

test('requires an authenticated session', async () => {
  const { caller } = await getCaller(2);
  await expect(caller.files.refreshAccess({ fileIds: [] })).rejects.toThrow(
    'You must be authenticated to perform this action.'
  );
});

test('rejects invalid or unbounded file ID batches', async () => {
  const { caller } = await initTest();
  await expect(caller.files.refreshAccess({ fileIds: [-1] })).rejects.toThrow();
  await expect(
    caller.files.refreshAccess({
      fileIds: Array.from({ length: 51 }, (_, i) => i + 1)
    })
  ).rejects.toThrow();
});

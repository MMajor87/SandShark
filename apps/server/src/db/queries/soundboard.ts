import type { TJoinedSoundboardSound } from '@sandshark/shared';
import { count, eq } from 'drizzle-orm';
import { db } from '..';
import { attachFileToken } from '../../helpers/files-crypto';
import { files, soundboardSounds, users } from '../schema';
import { getSettings } from './server';

const soundSelectFields = {
  sound: soundboardSounds,
  file: files,
  user: {
    id: users.id,
    name: users.name,
    profileColor: users.profileColor,
    bio: users.bio,
    createdAt: users.createdAt,
    banned: users.banned,
    isBot: users.isBot,
    avatarId: users.avatarId,
    bannerId: users.bannerId
  }
};

type TSoundRow = Awaited<ReturnType<typeof getSoundRows>>[number];

const getSoundRows = () =>
  db
    .select(soundSelectFields)
    .from(soundboardSounds)
    .innerJoin(files, eq(soundboardSounds.fileId, files.id))
    .innerJoin(users, eq(soundboardSounds.userId, users.id));

const parseSound = (
  row: TSoundRow,
  signedUrlsEnabled: boolean,
  signedUrlsTtlSeconds: number
): TJoinedSoundboardSound => ({
  ...row.sound,
  file: attachFileToken(row.file, signedUrlsEnabled, signedUrlsTtlSeconds),
  user: { ...row.user, avatar: null, banner: null }
});

const getSoundboardSoundById = async (
  id: number
): Promise<TJoinedSoundboardSound | undefined> => {
  const row = await getSoundRows()
    .where(eq(soundboardSounds.id, id))
    .limit(1)
    .get();

  if (!row) return undefined;

  const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
    await getSettings();

  return parseSound(row, storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds);
};

const getSoundboardSounds = async (): Promise<TJoinedSoundboardSound[]> => {
  const [rows, settings] = await Promise.all([
    getSoundRows().orderBy(soundboardSounds.id),
    getSettings()
  ]);

  return rows.map((row) =>
    parseSound(
      row,
      settings.storageSignedUrlsEnabled,
      settings.storageSignedUrlsTtlSeconds
    )
  );
};

const soundboardSoundExists = async (id: number): Promise<boolean> => {
  const row = await db
    .select({ id: soundboardSounds.id })
    .from(soundboardSounds)
    .where(eq(soundboardSounds.id, id))
    .limit(1)
    .get();

  return !!row;
};

const countSoundboardSounds = async (): Promise<number> => {
  const row = await db.select({ total: count() }).from(soundboardSounds).get();

  return row?.total ?? 0;
};

export {
  countSoundboardSounds,
  getSoundboardSoundById,
  getSoundboardSounds,
  soundboardSoundExists
};

import {
  ActivityLogType,
  ChannelPermission,
  Permission,
  ServerEvents,
  SOUNDBOARD_MAX_FILE_SIZE,
  SOUNDBOARD_MAX_SOUNDS,
  SOUNDBOARD_NAME_MAX_LENGTH,
  type TTempFile
} from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { initTest, uploadFile } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { config } from '../../config';
import { getFileAccess, isFileOrphaned } from '../../db/queries/files';
import * as soundboardQueries from '../../db/queries/soundboard';
import {
  channelRolePermissions,
  files,
  rolePermissions,
  roles,
  soundboardSounds
} from '../../db/schema';
import { deleteUserAccount } from '../../helpers/delete-user-account';
import * as activityLog from '../../queues/activity-log';
import { VoiceRuntime } from '../../runtimes/voice';
import { pubsub } from '../../utils/pubsub';

// seeded voice channel every member can speak in
const VOICE_CHANNEL_ID = 2;

// seeded private voice channel, nobody has channel permissions on it
const PRIVATE_VOICE_CHANNEL_ID = 4;

type TCaller = Awaited<ReturnType<typeof initTest>>['caller'];

const uploadSound = async (
  token: string,
  name = 'airhorn.mp3',
  size = 64
): Promise<TTempFile> => {
  const file = new File([new Uint8Array(size)], name, { type: 'audio/mpeg' });
  const response = await uploadFile(file, token);

  return (await response.json()) as TTempFile;
};

const addSound = async (caller: TCaller, token: string, name = 'Airhorn') => {
  const tempFile = await uploadSound(token);

  return caller.soundboard.add({
    fileId: tempFile.id,
    name,
    emoji: 'tada'
  });
};

const getSoundRow = (soundId: number) =>
  tdb
    .select()
    .from(soundboardSounds)
    .where(eq(soundboardSounds.id, soundId))
    .get();

const collectEvents = <T extends ServerEvents>(event: T) => {
  const received: unknown[] = [];
  const subscription = pubsub.subscribe(event).subscribe({
    next: (payload) => {
      received.push(payload);
    }
  });

  return { received, stop: () => subscription.unsubscribe() };
};

const joinVoice = async (userId: number, channelId = VOICE_CHANNEL_ID) => {
  const runtime = new VoiceRuntime(channelId);

  runtime.addUser(userId, { micMuted: false, soundMuted: false });

  const { caller } = await initTest(userId, undefined, {
    currentVoiceChannelId: channelId
  });

  return { runtime, caller };
};

const revokeFromDefaultRole = async (permission: Permission) => {
  const defaultRole = await tdb
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.isDefault, true))
    .get();

  await tdb
    .delete(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, defaultRole!.id),
        eq(rolePermissions.permission, permission)
      )
    );
};

describe('soundboard router', () => {
  describe('add', () => {
    test('should store the sound with its file, emoji and uploader', async () => {
      const { caller, mockedToken } = await initTest(1);
      const created = collectEvents(ServerEvents.SOUNDBOARD_SOUND_CREATE);
      const logs = spyOn(activityLog, 'enqueueActivityLog');

      try {
        const soundId = await addSound(caller, mockedToken);
        const row = await getSoundRow(soundId);

        expect(row).toMatchObject({
          name: 'Airhorn',
          emoji: 'tada',
          userId: 1
        });

        const file = await tdb
          .select()
          .from(files)
          .where(eq(files.id, row!.fileId))
          .get();

        expect(file?.extension).toBe('.mp3');

        await Bun.sleep(10);

        expect(created.received).toHaveLength(1);
        expect(created.received[0]).toMatchObject({
          id: soundId,
          name: 'Airhorn'
        });
        expect(logs).toHaveBeenCalledWith({
          type: ActivityLogType.CREATED_SOUNDBOARD_SOUND,
          userId: 1,
          details: { name: 'Airhorn' }
        });
      } finally {
        created.stop();
      }
    });

    test('should accept a sound without an emoji', async () => {
      const { caller, mockedToken } = await initTest(1);
      const tempFile = await uploadSound(mockedToken);

      const soundId = await caller.soundboard.add({
        fileId: tempFile.id,
        name: 'Plain',
        emoji: null
      });

      expect((await getSoundRow(soundId))?.emoji).toBeNull();
    });

    test('should be included in the data a joining user receives', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);

      const { initialData } = await initTest(2);

      expect(initialData.soundboardSounds.map(({ id }) => id)).toEqual([
        soundId
      ]);
      expect(initialData.soundboardSounds[0]?.file.id).toBeDefined();
    });

    test('should throw when the user cannot manage the soundboard', async () => {
      const { caller, mockedToken } = await initTest(2);
      const tempFile = await uploadSound(mockedToken);

      await expect(
        caller.soundboard.add({ fileId: tempFile.id, name: 'x', emoji: null })
      ).rejects.toThrow('Insufficient permissions');
    });

    test('should throw when the uploaded file does not exist', async () => {
      const { caller } = await initTest(1);

      await expect(
        caller.soundboard.add({
          fileId: 'missing-file',
          name: 'x',
          emoji: null
        })
      ).rejects.toThrow('Uploaded file not found');
    });

    test("should throw for another user's uploaded file", async () => {
      const { mockedToken } = await initTest(2);
      const tempFile = await uploadSound(mockedToken);
      const { caller } = await initTest(1);

      await expect(
        caller.soundboard.add({ fileId: tempFile.id, name: 'x', emoji: null })
      ).rejects.toThrow('Uploaded file not found');
    });

    test('should refuse a file that is not an allowed sound type', async () => {
      const { caller, mockedToken } = await initTest(1);
      const tempFile = await uploadSound(mockedToken, 'notes.txt');

      await expect(
        caller.soundboard.add({ fileId: tempFile.id, name: 'x', emoji: null })
      ).rejects.toThrow('Sounds must be one of: .mp3, .ogg, .wav, .webm');
    });

    test('should refuse a sound over the size limit', async () => {
      const { caller, mockedToken } = await initTest(1);
      const tempFile = await uploadSound(
        mockedToken,
        'long.mp3',
        SOUNDBOARD_MAX_FILE_SIZE + 1
      );

      await expect(
        caller.soundboard.add({ fileId: tempFile.id, name: 'x', emoji: null })
      ).rejects.toThrow('Sounds can be at most 1 MB');
    });

    test('should refuse an unknown emoji', async () => {
      const { caller, mockedToken } = await initTest(1);
      const tempFile = await uploadSound(mockedToken);

      await expect(
        caller.soundboard.add({
          fileId: tempFile.id,
          name: 'x',
          emoji: 'not an emoji'
        })
      ).rejects.toThrow('Unknown emoji');
    });

    test('should refuse a new sound when the soundboard is full', async () => {
      const { caller, mockedToken } = await initTest(1);
      const tempFile = await uploadSound(mockedToken);

      spyOn(soundboardQueries, 'countSoundboardSounds').mockResolvedValue(
        SOUNDBOARD_MAX_SOUNDS
      );

      await expect(
        caller.soundboard.add({ fileId: tempFile.id, name: 'x', emoji: null })
      ).rejects.toThrow(
        `The soundboard is full, it holds at most ${SOUNDBOARD_MAX_SOUNDS} sounds`
      );
    });

    test('should validate the name', async () => {
      const { caller, mockedToken } = await initTest(1);
      const tempFile = await uploadSound(mockedToken);

      for (const name of [
        '',
        '   ',
        'x'.repeat(SOUNDBOARD_NAME_MAX_LENGTH + 1)
      ]) {
        await expect(
          caller.soundboard.add({ fileId: tempFile.id, name, emoji: null })
        ).rejects.toThrow();
      }
    });

    test('should rate limit sound uploads', async () => {
      const { caller } = await initTest(1);

      for (
        let i = 0;
        i < config.rateLimiters.soundboardManage.maxRequests;
        i++
      ) {
        await caller.soundboard
          .add({ fileId: 'missing-file', name: 'x', emoji: null })
          .catch(() => {});
      }

      await expect(
        caller.soundboard.add({
          fileId: 'missing-file',
          name: 'x',
          emoji: null
        })
      ).rejects.toThrow('Too many requests. Please try again shortly.');
    });
  });

  describe('sound files', () => {
    test('should serve a sound file as a public asset and keep it from orphan cleanup', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);
      const row = await getSoundRow(soundId);

      expect((await getFileAccess(row!.fileId)).publicAsset).toBe(true);
      expect(await isFileOrphaned(row!.fileId)).toBe(false);
    });

    test('should keep the sound and its file when the uploader account is deleted', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);

      await tdb
        .update(soundboardSounds)
        .set({ userId: 3 })
        .where(eq(soundboardSounds.id, soundId));

      await deleteUserAccount(3, { wipe: false, deletedBy: 1 });

      const row = await getSoundRow(soundId);

      expect(row).toBeDefined();
      expect(row!.userId).not.toBe(3);
      expect(await isFileOrphaned(row!.fileId)).toBe(false);
    });
  });

  describe('update', () => {
    test('should rename the sound and change its emoji', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);
      const updated = collectEvents(ServerEvents.SOUNDBOARD_SOUND_UPDATE);
      const logs = spyOn(activityLog, 'enqueueActivityLog');

      try {
        await caller.soundboard.update({
          soundId,
          name: 'Foghorn',
          emoji: null
        });

        expect(await getSoundRow(soundId)).toMatchObject({
          name: 'Foghorn',
          emoji: null
        });

        await Bun.sleep(10);

        expect(updated.received[0]).toMatchObject({
          id: soundId,
          name: 'Foghorn'
        });
        expect(logs).toHaveBeenCalledWith({
          type: ActivityLogType.UPDATED_SOUNDBOARD_SOUND,
          userId: 1,
          details: { fromName: 'Airhorn', toName: 'Foghorn' }
        });
      } finally {
        updated.stop();
      }
    });

    test('should throw when the user cannot manage the soundboard', async () => {
      const { caller } = await initTest(2);

      await expect(
        caller.soundboard.update({ soundId: 1, name: 'x', emoji: null })
      ).rejects.toThrow('Insufficient permissions');
    });

    test('should throw for a sound that does not exist', async () => {
      const { caller } = await initTest(1);

      await expect(
        caller.soundboard.update({ soundId: 999, name: 'x', emoji: null })
      ).rejects.toThrow('Sound not found');
    });

    test('should refuse an unknown emoji', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);

      await expect(
        caller.soundboard.update({ soundId, name: 'x', emoji: '<b>x</b>' })
      ).rejects.toThrow('Unknown emoji');
    });

    test('should validate the name', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);

      await expect(
        caller.soundboard.update({ soundId, name: '', emoji: null })
      ).rejects.toThrow();
      expect((await getSoundRow(soundId))?.name).toBe('Airhorn');
    });
  });

  describe('delete', () => {
    test('should remove the sound and its file', async () => {
      const { caller, mockedToken } = await initTest(1);
      const soundId = await addSound(caller, mockedToken);
      const { fileId } = (await getSoundRow(soundId))!;
      const deleted = collectEvents(ServerEvents.SOUNDBOARD_SOUND_DELETE);
      const logs = spyOn(activityLog, 'enqueueActivityLog');

      try {
        await caller.soundboard.delete({ soundId });

        expect(await getSoundRow(soundId)).toBeUndefined();
        expect(
          await tdb.select().from(files).where(eq(files.id, fileId)).get()
        ).toBeUndefined();
        expect(deleted.received).toEqual([soundId]);
        expect(logs).toHaveBeenCalledWith({
          type: ActivityLogType.DELETED_SOUNDBOARD_SOUND,
          userId: 1,
          details: { name: 'Airhorn' }
        });
      } finally {
        deleted.stop();
      }
    });

    test('should throw when the user cannot manage the soundboard', async () => {
      const { caller } = await initTest(2);

      await expect(caller.soundboard.delete({ soundId: 1 })).rejects.toThrow(
        'Insufficient permissions'
      );
    });

    test('should throw for a sound that does not exist', async () => {
      const { caller } = await initTest(1);

      await expect(caller.soundboard.delete({ soundId: 999 })).rejects.toThrow(
        'Sound not found'
      );
    });
  });

  describe('play', () => {
    test('should broadcast the sound to the channel the user is in', async () => {
      const admin = await initTest(1);
      const soundId = await addSound(admin.caller, admin.mockedToken);
      const { runtime, caller } = await joinVoice(2);
      const played = collectEvents(ServerEvents.SOUNDBOARD_SOUND_PLAY);

      try {
        await caller.soundboard.play({ soundId });

        expect(played.received).toEqual([
          { channelId: VOICE_CHANNEL_ID, userId: 2, soundId }
        ]);
      } finally {
        played.stop();
        await runtime.destroy();
      }
    });

    test('should throw without the soundboard permission', async () => {
      await revokeFromDefaultRole(Permission.USE_SOUNDBOARD);

      const { runtime, caller } = await joinVoice(2);

      try {
        await expect(caller.soundboard.play({ soundId: 1 })).rejects.toThrow(
          'Insufficient permissions'
        );
      } finally {
        await runtime.destroy();
      }
    });

    test('should throw when the user is not in a voice channel', async () => {
      const { caller } = await initTest(2);

      await expect(caller.soundboard.play({ soundId: 1 })).rejects.toThrow(
        'User is not in a voice channel'
      );
    });

    test('should throw for a sound that does not exist', async () => {
      const { runtime, caller } = await joinVoice(2);

      try {
        await expect(caller.soundboard.play({ soundId: 999 })).rejects.toThrow(
          'Sound not found'
        );
      } finally {
        await runtime.destroy();
      }
    });

    test('should throw without the right to speak in the channel', async () => {
      const admin = await initTest(1);
      const soundId = await addSound(admin.caller, admin.mockedToken);
      const defaultRole = await tdb
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.isDefault, true))
        .get();

      // viewing is granted so the call reaches the speak check, speaking is not
      await tdb.insert(channelRolePermissions).values({
        channelId: PRIVATE_VOICE_CHANNEL_ID,
        roleId: defaultRole!.id,
        permission: ChannelPermission.VIEW_CHANNEL,
        allow: true,
        createdAt: Date.now()
      });

      const { runtime, caller } = await joinVoice(2, PRIVATE_VOICE_CHANNEL_ID);

      try {
        await expect(caller.soundboard.play({ soundId })).rejects.toThrow(
          'Insufficient channel permissions'
        );
      } finally {
        await runtime.destroy();
      }
    });

    test('should rate limit sound spam', async () => {
      const { runtime, caller } = await joinVoice(2);

      try {
        for (
          let i = 0;
          i < config.rateLimiters.soundboardPlay.maxRequests;
          i++
        ) {
          await caller.soundboard.play({ soundId: 999 }).catch(() => {});
        }

        await expect(caller.soundboard.play({ soundId: 999 })).rejects.toThrow(
          'Too many requests. Please try again shortly.'
        );
      } finally {
        await runtime.destroy();
      }
    });
  });
});

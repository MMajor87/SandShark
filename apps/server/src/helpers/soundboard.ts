import { ActivityLogType, type TSoundboardSound } from '@sandshark/shared';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { removeFile } from '../db/mutations/files';
import { publishSoundboardSound } from '../db/publishers';
import { soundboardSounds } from '../db/schema';
import { enqueueActivityLog } from '../queues/activity-log';
import { invariant } from '../utils/invariant';

type TSoundboardSoundValues = {
  name: string;
  emoji: string | null;
};

const createSoundboardSound = async (
  values: TSoundboardSoundValues & { fileId: number },
  userId: number
): Promise<TSoundboardSound> => {
  const sound = await db
    .insert(soundboardSounds)
    .values({ ...values, userId, createdAt: Date.now() })
    .returning()
    .get();

  publishSoundboardSound(sound.id, 'create');
  enqueueActivityLog({
    type: ActivityLogType.CREATED_SOUNDBOARD_SOUND,
    userId,
    details: { name: sound.name }
  });

  return sound;
};

const updateSoundboardSound = async (
  soundId: number,
  values: TSoundboardSoundValues,
  actorUserId: number
) => {
  const previous = await db
    .select({ name: soundboardSounds.name })
    .from(soundboardSounds)
    .where(eq(soundboardSounds.id, soundId))
    .limit(1)
    .get();

  invariant(previous, {
    code: 'NOT_FOUND',
    message: 'Sound not found'
  });

  await db
    .update(soundboardSounds)
    .set({ ...values, updatedAt: Date.now() })
    .where(eq(soundboardSounds.id, soundId))
    .run();

  publishSoundboardSound(soundId, 'update');
  enqueueActivityLog({
    type: ActivityLogType.UPDATED_SOUNDBOARD_SOUND,
    userId: actorUserId,
    details: { fromName: previous.name, toName: values.name }
  });
};

const deleteSoundboardSound = async (soundId: number, actorUserId: number) => {
  const removed = await db
    .delete(soundboardSounds)
    .where(eq(soundboardSounds.id, soundId))
    .returning()
    .get();

  invariant(removed, {
    code: 'NOT_FOUND',
    message: 'Sound not found'
  });

  await removeFile(removed.fileId);

  publishSoundboardSound(removed.id, 'delete');
  enqueueActivityLog({
    type: ActivityLogType.DELETED_SOUNDBOARD_SOUND,
    userId: actorUserId,
    details: { name: removed.name }
  });
};

export { createSoundboardSound, deleteSoundboardSound, updateSoundboardSound };

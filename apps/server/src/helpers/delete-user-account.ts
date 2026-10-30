import {
  ActivityLogType,
  DELETED_USER_IDENTITY_AND_NAME,
  ServerEvents
} from '@sharkord/shared';
import { and, eq, exists, notExists, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { publishUser } from '../db/publishers';
import {
  emojis,
  files,
  messageFiles,
  messageReactions,
  messages,
  settings,
  users
} from '../db/schema';
import { logger } from '../logger';
import { eventBus } from '../plugins/event-bus';
import { enqueueActivityLog } from '../queues/activity-log';
import { pubsub } from '../utils/pubsub';
import { PUBLIC_PATH } from './paths';

const placeholderReactions = alias(messageReactions, 'placeholder_reactions');

const deleteUserAccount = async (
  userId: number,
  { wipe, deletedBy }: { wipe: boolean; deletedBy: number }
) => {
  const result = db.transaction((tx) => {
    let placeholder = tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.identity, DELETED_USER_IDENTITY_AND_NAME))
      .get();
    let placeholderCreated = false;

    if (!placeholder) {
      placeholder = tx
        .insert(users)
        .values({
          identity: DELETED_USER_IDENTITY_AND_NAME,
          password: Bun.randomUUIDv7(),
          name: DELETED_USER_IDENTITY_AND_NAME,
          avatarId: null,
          bannerId: null,
          bio: null,
          createdAt: Date.now()
        })
        .returning({ id: users.id })
        .get();
      placeholderCreated = true;
    }

    if (!placeholder)
      throw new Error('Failed to create deleted user placeholder');

    const deletedUserId = placeholder.id;
    let ownedFiles = wipe
      ? tx
          .select({ name: files.name })
          .from(files)
          .where(eq(files.userId, userId))
          .all()
      : [];

    if (wipe) {
      tx.delete(files).where(eq(files.userId, userId)).run();
    } else {
      tx.update(messages)
        .set({ userId: deletedUserId })
        .where(eq(messages.userId, userId))
        .run();
      tx.update(emojis)
        .set({ userId: deletedUserId })
        .where(eq(emojis.userId, userId))
        .run();
      tx.delete(messageReactions)
        .where(
          and(
            eq(messageReactions.userId, userId),
            exists(
              tx
                .select({ one: sql`1` })
                .from(placeholderReactions)
                .where(
                  and(
                    eq(placeholderReactions.userId, deletedUserId),
                    eq(
                      placeholderReactions.messageId,
                      messageReactions.messageId
                    ),
                    eq(placeholderReactions.emoji, messageReactions.emoji)
                  )
                )
            )
          )
        )
        .run();
      tx.update(messageReactions)
        .set({ userId: deletedUserId })
        .where(eq(messageReactions.userId, userId))
        .run();
      tx.update(files)
        .set({ userId: deletedUserId, originalName: 'Deleted user file' })
        .where(eq(files.userId, userId))
        .run();
    }

    tx.delete(users).where(eq(users.id, userId)).run();

    if (!wipe) {
      const unreferencedFile = and(
        notExists(
          tx
            .select({ one: sql`1` })
            .from(messageFiles)
            .where(eq(messageFiles.fileId, files.id))
        ),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(emojis)
            .where(eq(emojis.fileId, files.id))
        ),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(messageReactions)
            .where(eq(messageReactions.fileId, files.id))
        ),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(users)
            .where(
              or(eq(users.avatarId, files.id), eq(users.bannerId, files.id))
            )
        ),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(settings)
            .where(eq(settings.logoId, files.id))
        )
      );
      const orphanedFiles = tx
        .select({ name: files.name })
        .from(files)
        .where(and(eq(files.userId, deletedUserId), unreferencedFile))
        .all();
      tx.delete(files)
        .where(and(eq(files.userId, deletedUserId), unreferencedFile))
        .run();
      ownedFiles = orphanedFiles;
    }

    return { deletedUserId, placeholderCreated, ownedFiles };
  });

  if (result.placeholderCreated)
    await publishUser(result.deletedUserId, 'create');

  pubsub.publish(ServerEvents.USER_DELETE, {
    isWipe: wipe,
    userId,
    deletedUserId: result.deletedUserId
  });
  await eventBus.emit('user:deleted', { userId });
  enqueueActivityLog({
    type: ActivityLogType.USER_DELETED,
    userId: null,
    details: {
      reason: 'Your account has been deleted',
      deletedBy
    }
  });

  await Promise.all(
    result.ownedFiles.map(async ({ name }) => {
      try {
        await fs.unlink(path.join(PUBLIC_PATH, name));
      } catch (error) {
        logger.error('Error deleting file from disk: %s', error);
      }
    })
  );
};

export { deleteUserAccount };

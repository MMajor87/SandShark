import { ChannelType, type TIMessage } from '@sandshark/shared';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { channels, messages } from '../../db/schema';

// media on a reserved test domain, which the e2e specs serve themselves (see
// packages/e2e/tests/helpers/media.ts). third party hosts made the media specs depend on
// how fast the internet answered, and a random pick made every run see different media
const E2E_MEDIA_HOST = 'https://e2e-media.test';
const IMAGE_VARIANTS = 10;

const bigImageUrl = `${E2E_MEDIA_HOST}/big.svg`;
const videoUrl = `${E2E_MEDIA_HOST}/video.mp4`;

const imageUrl = (index: number) =>
  `${E2E_MEDIA_HOST}/image-${index % IMAGE_VARIANTS}.svg`;

const interleaveArrays = <T>(arrays: T[][]): T[] => {
  const maxLength = Math.max(...arrays.map((arr) => arr.length));
  const interleaved: T[] = [];

  for (let i = 0; i < maxLength; i++) {
    for (const arr of arrays) {
      if (i < arr.length) {
        interleaved.push(arr[i]!);
      }
    }
  }

  return interleaved;
};

const createMockMessageArrayWithImages = (
  channelId: number,
  totalMessages: number
): TIMessage[] => {
  const messagesArray: TIMessage[] = [];
  const baseCreatedAt = Date.now() - totalMessages * 60 * 1000;

  for (let i = 0; i < totalMessages; i++) {
    const metadata: TIMessage['metadata'] = [
      {
        kind: 'media',
        url: bigImageUrl,
        title: 'big.svg',
        description: '',
        mediaType: 'image'
      },
      {
        kind: 'media',
        url: imageUrl(i),
        title: `Image ${i % IMAGE_VARIANTS}`,
        description: '',
        mediaType: 'image'
      }
    ];

    messagesArray.push({
      channelId,
      userId: 1,
      content: `<p>${`${i}_<br>`.repeat(500)}</p>`,
      createdAt: baseCreatedAt + i * 60 * 1000,
      metadata
    });
  }

  return messagesArray;
};

const createMockMessageArrayWithVideo = (
  channelId: number,
  totalMessages: number
): TIMessage[] => {
  const messagesArray: TIMessage[] = [];

  const baseCreatedAt = Date.now() - totalMessages * 60 * 1000;

  for (let i = 0; i < totalMessages; i++) {
    messagesArray.push({
      channelId,
      userId: 1,
      content: `<p><a target="_blank" rel="noopener noreferrer" href="${videoUrl}">${videoUrl}</a></p>`,
      createdAt: baseCreatedAt + i * 60 * 1000,
      metadata: [
        {
          kind: 'media',
          url: videoUrl,
          title: 'video.mp4',
          description: '',
          mediaType: 'video'
        }
      ]
    });
  }

  return messagesArray;
};

const messageRenderMock = async (
  db: BunSQLiteDatabase,
  e2eChannelsCategoryId: number
) => {
  const scrollChannel = await db
    .insert(channels)
    .values({
      name: 'Messages Render',
      type: ChannelType.TEXT,
      position: 1,
      categoryId: e2eChannelsCategoryId,
      createdAt: Date.now()
    })
    .returning()
    .get();

  const allMockMessages = interleaveArrays([
    createMockMessageArrayWithImages(scrollChannel!.id, 500),
    createMockMessageArrayWithVideo(scrollChannel!.id, 500)
  ]);

  const totalMockMessages = allMockMessages.length;
  const messagesPerGroup = 5;
  const intraGroupSpacingMs = 10 * 1000;
  const groupSpacingMs = 2 * 60 * 1000;
  const totalGroups = Math.ceil(totalMockMessages / messagesPerGroup);
  const baseCreatedAt = Date.now() - totalGroups * groupSpacingMs;

  const mockMessages = Array.from({ length: totalMockMessages }).map(
    (_, index) => {
      const groupIndex = Math.floor(index / messagesPerGroup);
      const indexWithinGroup = index % messagesPerGroup;
      const message = allMockMessages[index];

      const mockMessage: TIMessage = {
        ...message,
        channelId: scrollChannel!.id,
        createdAt:
          baseCreatedAt +
          groupIndex * groupSpacingMs +
          indexWithinGroup * intraGroupSpacingMs
      };

      return mockMessage;
    }
  );

  await db.insert(messages).values(mockMessages);
};

export { messageRenderMock };

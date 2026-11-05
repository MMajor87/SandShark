import type { IRootState } from '@/features/store';
import type { TFile, TJoinedEmoji, TJoinedMessage } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { serverSliceActions, serverSliceReducer } from '../../slice';
import { FILE_ACCESS_RENEW_MARGIN_MS, getHeldFileIds } from '../helpers';

const NOW = 1_800_000_000_000;

const file = (id: number, expiresInMs?: number) =>
  ({
    id,
    name: `file-${id}.png`,
    extension: 'png',
    ...(expiresInMs === undefined
      ? {}
      : {
          _accessToken: `token-${id}`,
          _accessTokenExpiresAt: NOW + expiresInMs
        })
  }) as TFile;

const expiringSoon = file(1, FILE_ACCESS_RENEW_MARGIN_MS - 1);
const expiringLater = file(2, 60 * 60_000);
const expired = file(3, -1);
const unsigned = file(4);
const reactionFile = file(5, 0);
const emojiFile = file(6, FILE_ACCESS_RENEW_MARGIN_MS + 1);

const buildState = () => {
  const message = {
    id: 1,
    files: [expiringSoon, expiringLater, expired, unsigned],
    reactions: [
      { id: 1, file: reactionFile },
      { id: 2, file: null }
    ]
  } as unknown as TJoinedMessage;
  const emoji = { id: 1, name: 'custom', file: emojiFile } as TJoinedEmoji;
  let server = serverSliceReducer(undefined, { type: 'init' });

  server = serverSliceReducer(
    server,
    serverSliceActions.addMessages({
      conversationKey: 'channel:1',
      messages: [message]
    })
  );
  server = serverSliceReducer(server, serverSliceActions.addEmoji(emoji));

  return { server } as IRootState;
};

describe('getHeldFileIds', () => {
  test('lists every held file for a full refresh', () => {
    expect(
      [...getHeldFileIds(buildState(), NOW, false)].sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // renewing a url changes it and reloads every image showing it, so a focus or the timer
  // must leave urls with time left alone
  test('lists only files whose url is about to run out otherwise', () => {
    expect(
      [...getHeldFileIds(buildState(), NOW, true)].sort((a, b) => a - b)
    ).toEqual([1, 3, 5]);
  });

  test('never renews a file from a server without signed urls', () => {
    expect(getHeldFileIds(buildState(), NOW, true)).not.toContain(4);
  });
});

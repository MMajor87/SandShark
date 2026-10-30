import type { TFile, TJoinedEmoji, TJoinedMessage } from '@sharkord/shared';
import { expect, test } from 'bun:test';
import { serverSliceActions, serverSliceReducer } from '../../slice';

const oldFile = {
  id: 7,
  name: 'attachment.png',
  extension: 'png',
  _accessToken: 'expired',
  _accessTokenExpiresAt: 1
} as TFile;
const newFile = {
  ...oldFile,
  _accessToken: 'renewed',
  _accessTokenExpiresAt: 9999999999999
};

test('refreshes an open message and custom emoji without replacing unrelated media', () => {
  const message = {
    id: 1,
    files: [oldFile],
    reactions: [{ id: 1, file: oldFile }]
  } as unknown as TJoinedMessage;
  const emoji = { id: 1, name: 'custom', file: oldFile } as TJoinedEmoji;
  let state = serverSliceReducer(undefined, { type: 'init' });
  state = serverSliceReducer(
    state,
    serverSliceActions.addMessages({
      conversationKey: 'channel:1',
      messages: [message]
    })
  );
  state = serverSliceReducer(state, serverSliceActions.addEmoji(emoji));

  state = serverSliceReducer(
    state,
    serverSliceActions.refreshFileAccess({
      requestedIds: [7],
      files: [newFile]
    })
  );

  expect(state.messagesMap['channel:1']?.[0]?.files[0]?._accessToken).toBe(
    'renewed'
  );
  expect(
    state.messagesMap['channel:1']?.[0]?.reactions[0]?.file?._accessToken
  ).toBe('renewed');
  expect(state.emojis[0]?.file._accessToken).toBe('renewed');
});

test('removes credentials and media after access is revoked', () => {
  const message = {
    id: 1,
    files: [oldFile],
    reactions: [{ id: 1, file: oldFile }]
  } as unknown as TJoinedMessage;
  let state = serverSliceReducer(undefined, { type: 'init' });
  state = serverSliceReducer(
    state,
    serverSliceActions.addMessages({
      conversationKey: 'channel:1',
      messages: [message]
    })
  );
  state = serverSliceReducer(
    state,
    serverSliceActions.refreshFileAccess({ requestedIds: [7], files: [] })
  );

  expect(state.messagesMap['channel:1']?.[0]?.files).toEqual([]);
  expect(state.messagesMap['channel:1']?.[0]?.reactions[0]?.file).toBeNull();
});

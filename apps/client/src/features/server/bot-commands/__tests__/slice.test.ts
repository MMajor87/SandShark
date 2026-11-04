import type { IRootState } from '@/features/store';
import type { TBotEphemeralMessage } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { serverSliceActions, serverSliceReducer } from '../../slice';
import { botEphemeralMessagesByChannelIdSelector } from '../selectors';

const ephemeral = (
  id: number,
  channelId: number,
  overrides: Partial<TBotEphemeralMessage> = {}
): TBotEphemeralMessage => ({
  id,
  interactionId: id,
  botId: 9,
  channelId,
  commandName: 'ping',
  content: '<p>pong</p>',
  loading: false,
  createdAt: id,
  updatedAt: id,
  ...overrides
});

const initial = () => serverSliceReducer(undefined, { type: 'init' });

const asRoot = (server: ReturnType<typeof initial>) =>
  ({ server }) as unknown as IRootState;

describe('bot ephemeral messages', () => {
  test('a bot filling in its deferred answer replaces it in place', () => {
    let state = serverSliceReducer(
      initial(),
      serverSliceActions.upsertBotEphemeralMessage(
        ephemeral(1, 1, { content: '', loading: true })
      )
    );

    state = serverSliceReducer(
      state,
      serverSliceActions.upsertBotEphemeralMessage(
        ephemeral(1, 1, { content: '<p>done</p>' })
      )
    );

    expect(state.botEphemeralMessages).toEqual([
      ephemeral(1, 1, { content: '<p>done</p>' })
    ]);
  });

  test('dismissing or deleting one removes only that one', () => {
    let state = initial();

    for (const message of [ephemeral(1, 1), ephemeral(2, 1)]) {
      state = serverSliceReducer(
        state,
        serverSliceActions.upsertBotEphemeralMessage(message)
      );
    }

    state = serverSliceReducer(
      state,
      serverSliceActions.removeBotEphemeralMessage(1)
    );

    expect(state.botEphemeralMessages.map(({ id }) => id)).toEqual([2]);
  });

  test('each channel shows its own', () => {
    let state = initial();

    for (const message of [ephemeral(1, 1), ephemeral(2, 2), ephemeral(3, 1)]) {
      state = serverSliceReducer(
        state,
        serverSliceActions.upsertBotEphemeralMessage(message)
      );
    }

    expect(
      botEphemeralMessagesByChannelIdSelector(asRoot(state), 1).map(
        ({ id }) => id
      )
    ).toEqual([1, 3]);
  });
});

describe('bot commands', () => {
  test('the menu is replaced as a whole when it is fetched again', () => {
    const command = {
      commandId: 1,
      botId: 9,
      botName: 'Bot',
      name: 'ping',
      description: 'Ping',
      subcommand: [],
      options: []
    };
    let state = serverSliceReducer(
      initial(),
      serverSliceActions.setBotCommands([command, { ...command, commandId: 2 }])
    );

    state = serverSliceReducer(
      state,
      serverSliceActions.setBotCommands([command])
    );

    expect(state.botCommands).toEqual([command]);
  });
});

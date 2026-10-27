import { Permission, ServerEvents, StreamKind } from '@sharkord/shared';
import { expect, mock, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { initTest } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { publishChannelPermissions, publishRole } from '../../db/publishers';
import { rolePermissions } from '../../db/schema';
import { VoiceRuntime } from '../../runtimes/voice';
import { pubsub } from '../../utils/pubsub';
import { enforceVoicePermissions } from '../enforce-voice-permissions';

for (const change of ['permission', 'membership'] as const) {
  test(`producer startup closes its resource if ${change} changes during creation`, async () => {
    const runtime = new VoiceRuntime(2);
    runtime.addUser(2, { micMuted: false, soundMuted: false });
    const close = mock(() => undefined);
    runtime.getProducerTransport = () =>
      ({
        produce: async () => {
          if (change === 'membership') runtime.removeUser(2);
          else
            await tdb
              .delete(rolePermissions)
              .where(
                and(
                  eq(rolePermissions.roleId, 2),
                  eq(rolePermissions.permission, Permission.ENABLE_WEBCAM)
                )
              );
          return { close };
        }
      }) as unknown as ReturnType<VoiceRuntime['getProducerTransport']>;
    try {
      const { caller } = await initTest(2, undefined, {
        currentVoiceChannelId: 2
      });
      await expect(
        caller.voice.produce({
          transportId: 'test',
          kind: StreamKind.VIDEO,
          rtpParameters: {}
        })
      ).rejects.toThrow(
        change === 'membership'
          ? 'You are no longer in this voice channel.'
          : 'Insufficient permissions'
      );
      expect(close).toHaveBeenCalledTimes(1);
      expect(runtime.getProducer(StreamKind.VIDEO, 2)).toBeUndefined();
    } finally {
      await runtime.destroy();
    }
  });
}

test('a client can always report capture off and mute after losing permissions', async () => {
  const runtime = new VoiceRuntime(4);
  runtime.addUser(2, { micMuted: false, soundMuted: false });
  runtime.updateUserState(2, { webcamEnabled: true, sharingScreen: true });
  try {
    const { caller } = await initTest(2, undefined, {
      currentVoiceChannelId: 4
    });
    await caller.voice.updateState({
      webcamEnabled: false,
      sharingScreen: false,
      micMuted: true
    });
    expect(runtime.getUserState(2)).toMatchObject({
      webcamEnabled: false,
      sharingScreen: false,
      micMuted: true
    });
    await caller.voice.updateState({
      webcamEnabled: true,
      sharingScreen: true,
      micMuted: false
    });
    expect(runtime.getUserState(2)).toMatchObject({
      webcamEnabled: false,
      sharingScreen: false,
      micMuted: true
    });
  } finally {
    await runtime.destroy();
  }
});

test('channel permission changes stop server producers and publish the revoked state', async () => {
  const runtime = new VoiceRuntime(4);
  runtime.addUser(2, { micMuted: false, soundMuted: false });
  runtime.updateUserState(2, { webcamEnabled: true, sharingScreen: true });
  const remove = mock(runtime.removeProducer.bind(runtime));
  runtime.removeProducer = remove;
  const updates: unknown[] = [];
  const sub = pubsub
    .subscribe(ServerEvents.USER_VOICE_STATE_UPDATE)
    .subscribe({ next: (data) => updates.push(data) });
  try {
    await publishChannelPermissions([2]);
    expect(remove).toHaveBeenCalledWith(2, StreamKind.VIDEO);
    expect(remove).toHaveBeenCalledWith(2, StreamKind.SCREEN);
    expect(remove).toHaveBeenCalledWith(2, StreamKind.SCREEN_AUDIO);
    expect(updates).toContainEqual({
      channelId: 4,
      userId: 2,
      state: runtime.getUserState(2)
    });
    expect(runtime.getUserState(2)).toMatchObject({
      webcamEnabled: false,
      sharingScreen: false
    });
  } finally {
    sub.unsubscribe();
    await runtime.destroy();
  }
});

test('global role revocation stops capture even in a public voice channel', async () => {
  const runtime = new VoiceRuntime(2);
  runtime.addUser(2, { micMuted: false, soundMuted: false });
  runtime.updateUserState(2, { webcamEnabled: true, sharingScreen: true });
  try {
    await tdb
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, 2),
          eq(rolePermissions.permission, Permission.ENABLE_WEBCAM)
        )
      );
    await publishRole(2, 'update');
    expect(runtime.getUserState(2).webcamEnabled).toBe(false);
    expect(runtime.getUserState(2).sharingScreen).toBe(true);
    await enforceVoicePermissions(999);
  } finally {
    await runtime.destroy();
  }
});

test('channel owner bypass retains permitted capture', async () => {
  const runtime = new VoiceRuntime(4);
  runtime.addUser(1, { micMuted: false, soundMuted: false });
  runtime.updateUserState(1, { webcamEnabled: true, sharingScreen: true });
  try {
    await enforceVoicePermissions(1);
    expect(runtime.getUserState(1)).toMatchObject({
      webcamEnabled: true,
      sharingScreen: true
    });
  } finally {
    await runtime.destroy();
  }
});

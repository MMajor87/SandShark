import {
  ChannelPermission,
  Permission,
  ServerEvents,
  StreamKind
} from '@sharkord/shared';
import { channelUserCan } from '../db/queries/channels';
import { userCan } from '../db/queries/roles';
import { VoiceRuntime } from '../runtimes/voice';
import { pubsub } from '../utils/pubsub';

const enforceVoicePermissions = async (userId: number) => {
  const runtime = VoiceRuntime.findRuntimeByUserId(userId);
  if (!runtime) return;
  const [webcam, screen, enableWebcam, shareScreen] = await Promise.all([
    channelUserCan(runtime.id, userId, ChannelPermission.WEBCAM),
    channelUserCan(runtime.id, userId, ChannelPermission.SHARE_SCREEN),
    userCan(userId, Permission.ENABLE_WEBCAM),
    userCan(userId, Permission.SHARE_SCREEN)
  ]);
  // a permission check can finish after the participant has left this runtime.
  if (!runtime.getUser(userId)) return;
  const state = runtime.getUserState(userId);
  const update: { webcamEnabled?: false; sharingScreen?: false } = {};
  if (!webcam || !enableWebcam) {
    const hadProducer = !!runtime.getProducer(StreamKind.VIDEO, userId);
    runtime.removeProducer(userId, StreamKind.VIDEO);
    if (state.webcamEnabled || hadProducer) update.webcamEnabled = false;
  }
  if (!screen || !shareScreen) {
    const hadProducer =
      !!runtime.getProducer(StreamKind.SCREEN, userId) ||
      !!runtime.getProducer(StreamKind.SCREEN_AUDIO, userId);
    runtime.removeProducer(userId, StreamKind.SCREEN);
    runtime.removeProducer(userId, StreamKind.SCREEN_AUDIO);
    if (state.sharingScreen || hadProducer) update.sharingScreen = false;
  }
  if (Object.keys(update).length === 0) return;
  runtime.updateUserState(userId, update);
  pubsub.publish(ServerEvents.USER_VOICE_STATE_UPDATE, {
    channelId: runtime.id,
    userId,
    state: runtime.getUserState(userId)
  });
};

export { enforceVoicePermissions };

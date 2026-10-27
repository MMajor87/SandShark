import { useIsConnected } from '@/features/server/hooks';
import { SoundType } from '@/features/server/types';
import {
  clearLocalVoiceSession,
  updateOwnVoiceState
} from '@/features/server/voice/actions';
import { voiceLogger } from '@/helpers/browser-logger';
import { playSound } from '@/helpers/sounds';
import { Device } from 'mediasoup-client';
import type { RtpCapabilities } from 'mediasoup-client/types';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react';
import { ConnectionStatus } from '../connection-status';
import { createVoiceOperationOwner } from '../voice-operation';
import { captureVoiceSession } from '../voice-session';
import type { useTransportStats } from './use-transport-stats';
import type { useTransports } from './use-transports';

type TSessionParams = Pick<
  ReturnType<typeof useTransports>,
  | 'producerTransport'
  | 'consumerTransport'
  | 'createProducerTransport'
  | 'createConsumerTransport'
  | 'consumeExistingProducers'
  | 'cleanupTransports'
> &
  Pick<
    ReturnType<typeof useTransportStats>,
    'startMonitoring' | 'stopMonitoring' | 'resetStats'
  > & {
    currentVoiceChannelId?: number;
    routerRtpCapabilities: RefObject<RtpCapabilities | null>;
    deviceRtpCapabilities: RefObject<RtpCapabilities | null>;
    transportRecoveryRef: RefObject<() => void>;
    startMicStream: () => Promise<void>;
    cleanupMicProcessingResources: () => void;
    stopWebcamStream: () => void;
    stopScreenShareStream: () => void;
    clearLocalStreams: () => void;
    clearRemoteUserStreams: () => void;
    clearExternalStreams: () => void;
  };

const useVoiceSession = (options: TSessionParams) => {
  const latest = useRef(options);
  latest.current = options;
  const connected = useIsConnected();
  const [owner] = useState(createVoiceOperationOwner);
  const activeSession = useRef<
    ReturnType<typeof captureVoiceSession> | undefined
  >(undefined);
  const recovering = useRef(false);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(
    ConnectionStatus.DISCONNECTED
  );

  const cleanup = useCallback(() => {
    owner.cancel();
    activeSession.current = undefined;
    recovering.current = false;
    const current = latest.current;
    current.stopMonitoring();
    current.resetStats();
    current.cleanupMicProcessingResources();
    current.stopWebcamStream();
    current.stopScreenShareStream();
    current.clearLocalStreams();
    current.clearRemoteUserStreams();
    current.clearExternalStreams();
    current.cleanupTransports();
    current.deviceRtpCapabilities.current = null;
    current.routerRtpCapabilities.current = null;
    setLoading(false);
    setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }, [owner]);

  const establish = useCallback(
    async (capabilities: RtpCapabilities, recovery: boolean) => {
      const session = captureVoiceSession();
      cleanup();
      activeSession.current = session;
      const operation = owner.begin(session.isCurrent);
      const current = latest.current;
      recovering.current = recovery;
      setLoading(true);
      setConnectionStatus(ConnectionStatus.CONNECTING);
      current.routerRtpCapabilities.current = capabilities;
      try {
        operation.assertCurrent();
        if (recovery) {
          // recovery never resumes a camera, picker, or screen capture without a new user action.
          updateOwnVoiceState({ webcamEnabled: false, sharingScreen: false });
          await operation.wait(
            session.client.voice.updateState.mutate({
              webcamEnabled: false,
              sharingScreen: false
            })
          );
        }
        const device = new Device();
        await operation.wait(
          device.load({ routerRtpCapabilities: capabilities })
        );
        const loaded = device as Device & {
          recvRtpCapabilities?: RtpCapabilities;
          rtpCapabilities?: RtpCapabilities;
        };
        const received = loaded.recvRtpCapabilities ?? loaded.rtpCapabilities;
        if (!received)
          throw new Error('Failed to load device RTP capabilities');
        current.deviceRtpCapabilities.current = received;
        await operation.wait(current.createProducerTransport(device));
        await operation.wait(current.createConsumerTransport(device));
        await operation.wait(current.consumeExistingProducers(received));
        await operation.wait(current.startMicStream());
        current.startMonitoring(
          current.producerTransport.current,
          current.consumerTransport.current
        );
        setConnectionStatus(ConnectionStatus.CONNECTED);
        if (!recovery) playSound(SoundType.OWN_USER_JOINED_VOICE_CHANNEL);
      } catch (error) {
        if (!operation.isCurrent()) return;
        voiceLogger.error('session: initialization or recovery failed', error);
        cleanup();
        clearLocalVoiceSession();
        setConnectionStatus(ConnectionStatus.FAILED);
        if (!recovery) throw error;
      } finally {
        if (operation.isCurrent()) {
          recovering.current = false;
          setLoading(false);
        }
      }
    },
    [cleanup, owner]
  );

  const recover = useCallback(async () => {
    const capabilities = latest.current.routerRtpCapabilities.current;
    if (
      recovering.current ||
      !capabilities ||
      !activeSession.current?.isCurrent()
    )
      return;
    await establish(capabilities, true);
  }, [establish]);

  const init = useCallback(
    async (capabilities: RtpCapabilities, channelId: number) => {
      const session = captureVoiceSession();
      if (session.channelId !== channelId || !session.isCurrent()) return;
      await establish(capabilities, false);
    },
    [establish]
  );

  useEffect(() => {
    options.transportRecoveryRef.current = () => {
      recover().catch(console.error);
    };
    return () => {
      options.transportRecoveryRef.current = () => {};
    };
  }, [options.transportRecoveryRef, recover]);

  useEffect(() => {
    if (
      activeSession.current &&
      (!connected || !activeSession.current.isCurrent())
    )
      cleanup();
  }, [connected, options.currentVoiceChannelId, cleanup]);

  useEffect(() => cleanup, [cleanup]);
  return { init, cleanup, recover, loading, connectionStatus };
};

export { useVoiceSession };

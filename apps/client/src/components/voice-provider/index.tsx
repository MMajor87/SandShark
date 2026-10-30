import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { useWebRtcSimulcastEnabled } from '@/features/server/hooks';
import { updateOwnVoiceState } from '@/features/server/voice/actions';
import { useOwnVoiceState } from '@/features/server/voice/hooks';
import { ConnectionStatus } from './connection-status';
import { useMicrophone } from './hooks/use-microphone';
import { useScreenCapture } from './hooks/use-screen-capture';
import { useVoiceSession } from './hooks/use-voice-session';
import { replaceWebcamTrack } from './replace-webcam-track';
import { createVoiceOperationOwner, stopMediaStream } from './voice-operation';
import { captureVoiceSession } from './voice-session';

import { voiceLogger } from '@/helpers/browser-logger';
import { getResWidthHeight } from '@/helpers/get-res-with-height';
import {
  getPushToTalkSettings,
  subscribePushToTalkSettings
} from '@/helpers/push-to-talk';
import { registerVoiceDebugSource } from '@/helpers/voice-debug';
import { useScreenShareSupport } from '@/hooks/use-screen-share-support';
import { getTRPCClient } from '@/lib/trpc';
import { isDesktopClient } from '@/platform/environment';
import { type TDeviceSettings, type TStreamQuality } from '@/types';
import {
  getErrorMessage,
  StreamKind,
  type ConsumerType,
  type TStreamQualityLayer,
  type TVoiceUserState
} from '@sharkord/shared';
import type { ProducerOptions, RtpCapabilities } from 'mediasoup-client/types';
import {
  createContext,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { useDevices } from '../devices-provider/hooks/use-devices';
import {
  clearVoiceControlsBridge,
  setVoiceControlsBridge
} from './controls-bridge';
import { FloatingPinnedCard } from './floating-pinned-card';
import {
  getRemoteConsumerTypeKey,
  getSimulcastCodec,
  getSimulcastEncodings,
  getSimulcastQualityLayers,
  getStreamQualityStorageKey,
  loadStreamQualitiesFromStorage,
  normalizeStreamQuality,
  saveStreamQualitiesToStorage,
  type TRemoteConsumerTypes,
  type TRemoteQualityLayers,
  type TStreamQualitySettings
} from './helpers';
import { useLocalStreams } from './hooks/use-local-streams';
import { useRemoteStreams } from './hooks/use-remote-streams';
import { useTransportStats } from './hooks/use-transport-stats';
import { useTransports } from './hooks/use-transports';
import { useVoiceControls } from './hooks/use-voice-controls';
import { useVoiceEvents } from './hooks/use-voice-events';
import { useVoiceHotkeys } from './hooks/use-voice-hotkeys';
import { SIMULCAST_WEBCAM_MAX_BITRATE } from './statics';
import { VoiceStatsContext } from './stats-context';
import { VolumeControlProvider } from './volume-control-context';

type AudioVideoRefs = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  screenShareRef: React.RefObject<HTMLVideoElement | null>;
  screenShareAudioRef: React.RefObject<HTMLAudioElement | null>;
  externalAudioRef: React.RefObject<HTMLAudioElement | null>;
  externalVideoRef: React.RefObject<HTMLVideoElement | null>;
};

type TVideoProducerAppData = {
  kind: StreamKind;
  qualityLayers?: TStreamQualityLayer[];
};

type TRefsKey = number | `external:${number}`;

export type { AudioVideoRefs };

export type TVoiceProvider = {
  loading: boolean;
  connectionStatus: ConnectionStatus;
  pushToTalkActive: boolean;
  audioVideoRefsMap: Map<TRefsKey, AudioVideoRefs>;
  ownVoiceState: TVoiceUserState;
  isScreenShareSupported: boolean;
  getOrCreateRefs: (remoteId: number, isExternal?: boolean) => AudioVideoRefs;
  getConsumerCodec: (remoteId: number, kind: StreamKind) => string | undefined;
  getStreamQuality: (remoteId: number, kind: StreamKind) => TStreamQuality;
  getStreamQualityLayers: (
    remoteId: number,
    kind: StreamKind
  ) => TStreamQualityLayer[];
  setStreamQuality: (
    remoteId: number,
    kind: StreamKind.VIDEO | StreamKind.SCREEN | StreamKind.EXTERNAL_VIDEO,
    quality: TStreamQuality
  ) => Promise<void>;
  isSimulcastConsumer: (remoteId: number, kind: StreamKind) => boolean;
  init: (
    routerRtpCapabilities: RtpCapabilities,
    channelId: number
  ) => Promise<void>;
} & Pick<
  ReturnType<typeof useLocalStreams>,
  | 'localAudioStream'
  | 'localVideoStream'
  | 'localScreenShareStream'
  | 'localScreenShareAudioStream'
> &
  Pick<
    ReturnType<typeof useRemoteStreams>,
    'remoteUserStreams' | 'externalStreams'
  > &
  ReturnType<typeof useVoiceControls>;

const VoiceProviderContext = createContext<TVoiceProvider>({
  loading: false,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  pushToTalkActive: false,
  audioVideoRefsMap: new Map(),
  isScreenShareSupported: false,
  getOrCreateRefs: () => ({
    videoRef: { current: null },
    audioRef: { current: null },
    screenShareRef: { current: null },
    screenShareAudioRef: { current: null },
    externalAudioRef: { current: null },
    externalVideoRef: { current: null }
  }),
  getConsumerCodec: () => undefined,
  getStreamQuality: () => ({ mode: 'auto' }),
  getStreamQualityLayers: () => [],
  setStreamQuality: () => Promise.resolve(),
  isSimulcastConsumer: () => false,
  init: () => Promise.resolve(),
  toggleMic: () => Promise.resolve(),
  toggleSound: () => Promise.resolve(),
  toggleWebcam: () => Promise.resolve(),
  toggleScreenShare: () => Promise.resolve(),
  ownVoiceState: {
    micMuted: false,
    soundMuted: false,
    webcamEnabled: false,
    sharingScreen: false,
    serverMuted: false
  },
  localAudioStream: undefined,
  localVideoStream: undefined,
  localScreenShareStream: undefined,
  localScreenShareAudioStream: undefined,

  remoteUserStreams: {},
  externalStreams: {}
});

type TVoiceProviderProps = {
  children: React.ReactNode;
};

const VoiceProvider = memo(({ children }: TVoiceProviderProps) => {
  const [pushToTalkHeld, setPushToTalkHeld] = useState(false);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [pushToTalkRegistered, setPushToTalkRegistered] = useState(false);
  const routerRtpCapabilities = useRef<RtpCapabilities | null>(null);
  const deviceRtpCapabilities = useRef<RtpCapabilities | null>(null);
  const audioVideoRefsMap = useRef<Map<TRefsKey, AudioVideoRefs>>(new Map());
  const transportRecoveryRef = useRef<() => void>(() => {});
  const [streamQualities, setStreamQualities] =
    useState<TStreamQualitySettings>(loadStreamQualitiesFromStorage);
  const [remoteConsumerTypes, setRemoteConsumerTypes] =
    useState<TRemoteConsumerTypes>({});
  const [remoteQualityLayers, setRemoteQualityLayers] =
    useState<TRemoteQualityLayers>({});
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  const pushToTalkSettings = useSyncExternalStore(
    subscribePushToTalkSettings,
    getPushToTalkSettings,
    getPushToTalkSettings
  );
  const webRtcSimulcastEnabled = useWebRtcSimulcastEnabled();
  const ownVoiceState = useOwnVoiceState();
  const { devices } = useDevices();
  const { isScreenShareSupported } = useScreenShareSupport();

  const simulcastEnabled =
    !!webRtcSimulcastEnabled && !!devices.simulcastEnabled;

  const getStreamQuality = useCallback(
    (remoteId: number, kind: StreamKind): TStreamQuality => {
      const storageKey = getStreamQualityStorageKey(remoteId, kind);
      const consumerKey = getRemoteConsumerTypeKey(remoteId, kind);
      const layers = remoteQualityLayers[consumerKey] ?? [];

      return normalizeStreamQuality(streamQualities[storageKey], layers);
    },
    [remoteQualityLayers, streamQualities]
  );

  const getStreamQualityLayers = useCallback(
    (remoteId: number, kind: StreamKind): TStreamQualityLayer[] => {
      const consumerKey = getRemoteConsumerTypeKey(remoteId, kind);

      return remoteQualityLayers[consumerKey] ?? [];
    },
    [remoteQualityLayers]
  );

  const setRemoteStreamQualityLayers = useCallback(
    (remoteId: number, kind: StreamKind, layers: TStreamQualityLayer[]) => {
      const key = getRemoteConsumerTypeKey(remoteId, kind);

      setRemoteQualityLayers((prev) => {
        if (layers.length === 0) {
          const next = { ...prev };

          delete next[key];

          return next;
        }

        return { ...prev, [key]: layers };
      });
    },
    []
  );

  const clearRemoteConsumerMetadata = useCallback(() => {
    setRemoteConsumerTypes({});
    setRemoteQualityLayers({});
  }, []);

  const shouldShowQualityPicker = useCallback(
    (remoteId: number, kind: StreamKind): boolean => {
      const key = getRemoteConsumerTypeKey(remoteId, kind);

      return (
        remoteConsumerTypes[key] === 'simulcast' &&
        (remoteQualityLayers[key]?.length ?? 0) > 0
      );
    },
    [remoteConsumerTypes, remoteQualityLayers]
  );

  const setRemoteConsumerType = useCallback(
    (
      remoteId: number,
      kind: StreamKind,
      consumerType: ConsumerType | undefined
    ) => {
      const key = getRemoteConsumerTypeKey(remoteId, kind);

      setRemoteConsumerTypes((prev) => {
        if (consumerType === undefined) {
          const next = { ...prev };

          delete next[key];

          return next;
        }

        return { ...prev, [key]: consumerType };
      });
    },
    []
  );

  const isSimulcastConsumer = useCallback(
    (remoteId: number, kind: StreamKind): boolean => {
      return shouldShowQualityPicker(remoteId, kind);
    },
    [shouldShowQualityPicker]
  );

  const setStreamQuality = useCallback(
    async (
      remoteId: number,
      kind: StreamKind.VIDEO | StreamKind.SCREEN | StreamKind.EXTERNAL_VIDEO,
      quality: TStreamQuality
    ) => {
      setStreamQualities((prev) => {
        const next = {
          ...prev,
          [getStreamQualityStorageKey(remoteId, kind)]: quality
        };

        saveStreamQualitiesToStorage(next);

        return next;
      });

      if (!shouldShowQualityPicker(remoteId, kind)) return;

      const client = getTRPCClient();

      try {
        await client.voice.setConsumerQuality.mutate({
          remoteId,
          kind,
          quality
        });

        voiceLogger.info('consumer: quality changed', {
          remoteId,
          kind,
          quality
        });
      } catch (error) {
        voiceLogger.error('consumer: quality change failed', error, {
          remoteId,
          kind,
          quality
        });
      }
    },
    [shouldShowQualityPicker]
  );

  const getOrCreateRefs = useCallback(
    (remoteId: number, isExternal = false): AudioVideoRefs => {
      const key: TRefsKey = isExternal ? `external:${remoteId}` : remoteId;

      if (!audioVideoRefsMap.current.has(key)) {
        audioVideoRefsMap.current.set(key, {
          videoRef: { current: null },
          audioRef: { current: null },
          screenShareRef: { current: null },
          screenShareAudioRef: { current: null },
          externalAudioRef: { current: null },
          externalVideoRef: { current: null }
        });
      }

      return audioVideoRefsMap.current.get(key)!;
    },
    []
  );

  const {
    addExternalStreamTrack,
    removeExternalStreamTrack,
    removeExternalStream,
    clearExternalStreams,
    addRemoteUserStream,
    removeRemoteUserStream,
    clearRemoteUserStreamsForUser,
    clearRemoteUserStreams,
    externalStreams,
    remoteUserStreams
  } = useRemoteStreams();

  const onTransportFailed = useCallback(() => {
    transportRecoveryRef.current();
  }, []);

  const {
    localAudioProducer,
    localVideoProducer,
    localAudioStream,
    localVideoStream,
    localScreenShareStream,
    localScreenShareAudioStream,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    setLocalAudioStream,
    setLocalVideoStream,
    setLocalScreenShare,
    setLocalScreenShareAudio,
    clearLocalStreams
  } = useLocalStreams();

  const {
    producerTransport,
    consumerTransport,
    consumers,
    createProducerTransport,
    createConsumerTransport,
    consume,
    consumeExistingProducers,
    cleanupTransports,
    getConsumerCodec
  } = useTransports({
    onTransportFailed,
    addExternalStreamTrack,
    removeExternalStreamTrack,
    addRemoteUserStream,
    removeRemoteUserStream,
    setRemoteConsumerType,
    setRemoteStreamQualityLayers,
    clearRemoteConsumerMetadata
  });

  const {
    stats: transportStats,
    subscribe: subscribeToStats,
    startMonitoring,
    stopMonitoring,
    resetStats,
    setScreenShareProducer
  } = useTransportStats();
  const { startMicStream, switchMicStream, cleanupMicProcessingResources } =
    useMicrophone({
      devices,
      ownVoiceState,
      producerTransport,
      localAudioProducer,
      setLocalAudioStream,
      pushToTalkActive,
      pushToTalkRegistered,
      pushToTalkSettings
    });

  const [webcamOwner] = useState(createVoiceOperationOwner);
  const activeWebcamStream = useRef<MediaStream | undefined>(undefined);
  const webcamSwitchId = useRef(0);
  const startWebcamStream = useCallback(async () => {
    const session = captureVoiceSession();
    const transport = producerTransport.current;
    const operation = webcamOwner.begin(
      () =>
        session.isCurrent() &&
        producerTransport.current === transport &&
        !!transport &&
        !transport.closed
    );
    const trpc = session.client;
    let stream: MediaStream | undefined;

    try {
      operation.assertCurrent();
      voiceLogger.info('webcam: starting');

      const hasSpecificWebcam =
        !!devices?.webcamId && devices.webcamId !== 'default';

      const webcamConstraints: MediaStreamConstraints = {
        video: {
          deviceId: hasSpecificWebcam ? { exact: devices.webcamId } : undefined,
          frameRate: devices.webcamFramerate,
          ...getResWidthHeight(devices?.webcamResolution)
        },
        audio: false
      };

      voiceLogger.info('webcam: requesting stream', {
        constraints: webcamConstraints
      });

      const webcamStream = await operation.wait(
        navigator.mediaDevices.getUserMedia(webcamConstraints),
        stopMediaStream
      );
      stream = webcamStream;

      voiceLogger.info('webcam: stream obtained', {
        trackId: stream.getVideoTracks()[0]?.id,
        label: stream.getVideoTracks()[0]?.label
      });

      setLocalVideoStream(webcamStream);
      activeWebcamStream.current = webcamStream;

      const videoTrack = webcamStream.getVideoTracks()[0];

      if (videoTrack) {
        voiceLogger.info('webcam: video track obtained', {
          trackId: videoTrack.id,
          readyState: videoTrack.readyState,
          settings: videoTrack.getSettings()
        });

        if (!transport) {
          throw new Error('Webcam transport is not available');
        }

        const simulcastCodec = simulcastEnabled
          ? getSimulcastCodec(routerRtpCapabilities.current)
          : undefined;

        const webcamProducerOptions: ProducerOptions<TVideoProducerAppData> = {
          track: videoTrack,
          appData: {
            kind: StreamKind.VIDEO
          }
        };
        let simulcastWebcamProducerOptions = webcamProducerOptions;

        if (simulcastCodec) {
          voiceLogger.info('webcam: using vp8 for simulcast', {
            codec: simulcastCodec.mimeType
          });

          const encodings = getSimulcastEncodings(SIMULCAST_WEBCAM_MAX_BITRATE);

          const qualityLayers = getSimulcastQualityLayers(encodings);

          simulcastWebcamProducerOptions = {
            ...webcamProducerOptions,
            appData: { kind: StreamKind.VIDEO, qualityLayers },
            codec: simulcastCodec,
            encodings
          };
        }

        try {
          const producer = await transport.produce(
            simulcastWebcamProducerOptions
          );
          if (!operation.isCurrent()) {
            producer.close();
            operation.assertCurrent();
          }
          localVideoProducer.current = producer;
        } catch (error) {
          operation.assertCurrent();
          if (!simulcastCodec) throw error;

          voiceLogger.warn(
            'webcam: simulcast producer failed, retrying without simulcast',
            { error: getErrorMessage(error) }
          );

          const producer = await transport.produce(webcamProducerOptions);
          if (!operation.isCurrent()) {
            producer.close();
            operation.assertCurrent();
          }
          localVideoProducer.current = producer;
        }

        voiceLogger.info('webcam: producer created', {
          producerId: localVideoProducer.current?.id
        });

        localVideoProducer.current?.observer.on('close', async () => {
          voiceLogger.info('webcam: producer closed');

          if (!session.isCurrent() || producerTransport.current !== transport)
            return;

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.VIDEO
            });
          } catch (error) {
            voiceLogger.error(
              'webcam: closing producer on the server failed',
              error
            );
          }
        });

        videoTrack.onended = () => {
          if (!operation.isCurrent()) return;
          voiceLogger.warn('webcam: track ended, cleaning up');

          webcamStream.getVideoTracks().forEach((track) => {
            track.stop();
          });
          localVideoProducer.current?.close();
          localVideoProducer.current = undefined;

          activeWebcamStream.current = undefined;
          setLocalVideoStream(undefined);
          updateOwnVoiceState({ webcamEnabled: false });

          trpc.voice.updateState
            .mutate({ webcamEnabled: false })
            .catch((error) => {
              voiceLogger.info(
                'Error updating webcam state after camera ended',
                {
                  error
                }
              );
            });
        };
      } else {
        throw new Error('Failed to obtain video track from webcam');
      }
    } catch (error) {
      const current = operation.isCurrent();
      operation.dispose();
      if (!current) throw error;
      stream?.getTracks().forEach((track) => track.stop());
      localVideoProducer.current?.close();
      localVideoProducer.current = undefined;
      activeWebcamStream.current = undefined;
      setLocalVideoStream(undefined);
      voiceLogger.info('Error starting webcam stream', { error });
      throw error;
    }
  }, [
    webcamOwner,
    setLocalVideoStream,
    localVideoProducer,
    producerTransport,
    devices.webcamId,
    devices.webcamFramerate,
    devices.webcamResolution,
    simulcastEnabled
  ]);

  const stopWebcamStream = useCallback(() => {
    voiceLogger.info('webcam: stopping');
    webcamSwitchId.current += 1;
    webcamOwner.cancel();

    const stream = activeWebcamStream.current ?? localVideoStream;
    activeWebcamStream.current = undefined;
    stream?.getVideoTracks().forEach((track) => {
      voiceLogger.info('webcam: stopping track', { trackId: track.id });

      track.stop();
      stream.removeTrack(track);
    });

    localVideoProducer.current?.close();
    localVideoProducer.current = undefined;

    setLocalVideoStream(undefined);
  }, [webcamOwner, localVideoStream, setLocalVideoStream, localVideoProducer]);

  const switchWebcamStream = useCallback(
    async (nextDevices: TDeviceSettings) => {
      const session = captureVoiceSession();
      const producer = localVideoProducer.current;
      if (!producer || producer.closed)
        throw new Error('Camera is not active.');
      const switchId = ++webcamSwitchId.current;
      const isCurrent = () =>
        session.isCurrent() &&
        webcamSwitchId.current === switchId &&
        localVideoProducer.current === producer;
      const { stream, track } = await replaceWebcamTrack(
        nextDevices,
        producer,
        isCurrent
      );
      try {
        const previousStream = activeWebcamStream.current;
        activeWebcamStream.current = stream;
        setLocalVideoStream(stream);
        webcamOwner.cancel();
        previousStream?.getTracks().forEach((oldTrack) => {
          oldTrack.onended = null;
          oldTrack.stop();
        });
        track.onended = () => {
          if (!session.isCurrent() || webcamSwitchId.current !== switchId)
            return;
          stopWebcamStream();
          updateOwnVoiceState({ webcamEnabled: false });
          session.client.voice.updateState
            .mutate({ webcamEnabled: false })
            .catch(console.error);
        };
      } catch (error) {
        stopMediaStream(stream);
        throw error;
      }
    },
    [localVideoProducer, setLocalVideoStream, stopWebcamStream, webcamOwner]
  );

  const applyDevices = useCallback(
    async (nextDevices: TDeviceSettings, previousDevices: TDeviceSettings) => {
      const microphoneChanged =
        nextDevices.microphoneId !== previousDevices.microphoneId ||
        nextDevices.autoGainControl !== previousDevices.autoGainControl ||
        nextDevices.echoCancellation !== previousDevices.echoCancellation ||
        nextDevices.noiseSuppression !== previousDevices.noiseSuppression ||
        nextDevices.noiseGateEnabled !== previousDevices.noiseGateEnabled;
      const webcamChanged =
        nextDevices.webcamId !== previousDevices.webcamId ||
        nextDevices.webcamResolution !== previousDevices.webcamResolution ||
        nextDevices.webcamFramerate !== previousDevices.webcamFramerate;

      if (!currentVoiceChannelId) return;
      if (
        microphoneChanged &&
        localAudioProducer.current &&
        webcamChanged &&
        localVideoProducer.current
      ) {
        await switchMicStream(nextDevices);
        try {
          await switchWebcamStream(nextDevices);
        } catch (error) {
          await switchMicStream(previousDevices);
          throw error;
        }
        return;
      }
      if (microphoneChanged && localAudioProducer.current)
        await switchMicStream(nextDevices);
      if (webcamChanged && localVideoProducer.current)
        await switchWebcamStream(nextDevices);
    },
    [
      currentVoiceChannelId,
      localAudioProducer,
      localVideoProducer,
      switchMicStream,
      switchWebcamStream
    ]
  );

  const {
    startScreenShareStream,
    stopScreenShareStream,
    desktopCapturePicker
  } = useScreenCapture({
    localScreenShareStream,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    setLocalScreenShare,
    setLocalScreenShareAudio,
    devices,
    producerTransport,
    routerRtpCapabilities,
    simulcastEnabled,
    setScreenShareProducer
  });

  const { init, loading, connectionStatus } = useVoiceSession({
    currentVoiceChannelId,
    routerRtpCapabilities,
    deviceRtpCapabilities,
    transportRecoveryRef,
    producerTransport,
    consumerTransport,
    createProducerTransport,
    createConsumerTransport,
    consumeExistingProducers,
    cleanupTransports,
    startMicStream,
    cleanupMicProcessingResources,
    stopWebcamStream,
    stopScreenShareStream,
    clearLocalStreams,
    clearRemoteUserStreams,
    clearExternalStreams,
    startMonitoring,
    stopMonitoring,
    resetStats
  });

  const { toggleMic, toggleSound, toggleWebcam, toggleScreenShare } =
    useVoiceControls({
      startMicStream,
      localAudioStream,
      startWebcamStream,
      stopWebcamStream,
      startScreenShareStream,
      stopScreenShareStream
    });

  useVoiceHotkeys({ toggleMic, toggleSound });

  const setMicMutedForBridge = useCallback(
    async (muted: boolean) => {
      if (ownVoiceState.micMuted === muted) return;
      await toggleMic();
    },
    [ownVoiceState.micMuted, toggleMic]
  );

  const setSoundMutedForBridge = useCallback(
    async (muted: boolean) => {
      if (ownVoiceState.soundMuted === muted) return;
      await toggleSound();
    },
    [ownVoiceState.soundMuted, toggleSound]
  );

  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    const desktopApi = window.sandSharkDesktop;
    let disposed = false;

    if (!pushToTalkSettings.enabled) {
      setPushToTalkHeld(false);
      setPushToTalkActive(false);
      setPushToTalkRegistered(false);
      desktopApi.clearPushToTalk().catch(console.error);
      return;
    }

    setPushToTalkRegistered(false);

    desktopApi
      .setPushToTalk({
        input:
          pushToTalkSettings.input.type === 'keyboard'
            ? {
                type: 'keyboard',
                keyCode: pushToTalkSettings.input.keyCode
              }
            : {
                type: 'mouse',
                button: pushToTalkSettings.input.button
              },
        modifiers: pushToTalkSettings.input.modifiers
      })
      .then((result) => {
        if (!disposed) setPushToTalkRegistered(result.registered);
      })
      .catch(() => {
        if (!disposed) setPushToTalkRegistered(false);
      });

    return () => {
      disposed = true;
      setPushToTalkHeld(false);
      setPushToTalkActive(false);
      setPushToTalkRegistered(false);
      desktopApi.clearPushToTalk().catch(console.error);
    };
  }, [
    pushToTalkSettings.enabled,
    pushToTalkSettings.input,
    pushToTalkSettings.input.modifiers
  ]);

  useEffect(() => {
    if (
      !pushToTalkSettings.enabled ||
      !isDesktopClient() ||
      !window.sandSharkDesktop
    ) {
      return;
    }

    return window.sandSharkDesktop.onPushToTalk((active) => {
      setPushToTalkHeld(active);
    });
  }, [pushToTalkSettings.enabled]);

  useEffect(() => {
    const delay = pushToTalkHeld
      ? pushToTalkSettings.activationDelayMs
      : pushToTalkSettings.releaseDelayMs;
    const timer = window.setTimeout(() => {
      setPushToTalkActive(pushToTalkHeld);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    pushToTalkHeld,
    pushToTalkSettings.activationDelayMs,
    pushToTalkSettings.releaseDelayMs
  ]);

  useEffect(() => {
    if (currentVoiceChannelId) return;

    setPushToTalkHeld(false);
    setPushToTalkActive(false);
  }, [currentVoiceChannelId]);

  useEffect(() => {
    setVoiceControlsBridge({
      setMicMuted: setMicMutedForBridge,
      setSoundMuted: setSoundMutedForBridge,
      applyDevices
    });

    return () => {
      clearVoiceControlsBridge();
    };
  }, [setMicMutedForBridge, setSoundMutedForBridge, applyDevices]);

  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    return window.sandSharkDesktop.onTrayAction((action) => {
      if (action === 'toggle-mic') {
        toggleMic().catch(console.error);
        return;
      }

      toggleSound().catch(console.error);
    });
  }, [toggleMic, toggleSound]);

  useVoiceEvents({
    consume,
    removeRemoteUserStream,
    removeExternalStreamTrack,
    removeExternalStream,
    clearRemoteUserStreamsForUser,
    rtpCapabilitiesRef: deviceRtpCapabilities,
    isVoiceSessionActive:
      connectionStatus === ConnectionStatus.CONNECTING ||
      connectionStatus === ConnectionStatus.CONNECTED
  });

  const previousConnectionStatus = useRef(connectionStatus);

  useEffect(() => {
    if (previousConnectionStatus.current === connectionStatus) return;

    voiceLogger.info('session: connection status changed', {
      from: previousConnectionStatus.current,
      to: connectionStatus
    });

    previousConnectionStatus.current = connectionStatus;
  }, [connectionStatus]);

  const getVoiceDebugSource = useCallback(
    () => ({
      producerTransport: producerTransport.current,
      consumerTransport: consumerTransport.current,
      producers: [
        { kind: StreamKind.AUDIO, producer: localAudioProducer.current },
        { kind: StreamKind.VIDEO, producer: localVideoProducer.current },
        { kind: StreamKind.SCREEN, producer: localScreenShareProducer.current },
        {
          kind: StreamKind.SCREEN_AUDIO,
          producer: localScreenShareAudioProducer.current
        }
      ],
      consumers: Object.entries(consumers.current).flatMap(
        ([remoteId, byKind]) =>
          Object.entries(byKind).map(([kind, consumer]) => ({
            remoteId: +remoteId,
            kind,
            consumer
          }))
      ),
      routerRtpCapabilities: routerRtpCapabilities.current,
      deviceRtpCapabilities: deviceRtpCapabilities.current
    }),
    [
      producerTransport,
      consumerTransport,
      consumers,
      localAudioProducer,
      localVideoProducer,
      localScreenShareProducer,
      localScreenShareAudioProducer
    ]
  );

  useEffect(
    () => registerVoiceDebugSource(getVoiceDebugSource),
    [getVoiceDebugSource]
  );

  const contextValue = useMemo<TVoiceProvider>(
    () => ({
      loading,
      connectionStatus,
      pushToTalkActive,
      audioVideoRefsMap: audioVideoRefsMap.current,
      isScreenShareSupported,
      getOrCreateRefs,
      getConsumerCodec,
      getStreamQuality,
      getStreamQualityLayers,
      setStreamQuality,
      isSimulcastConsumer,
      init,

      toggleMic,
      toggleSound,
      toggleWebcam,
      toggleScreenShare,
      ownVoiceState,

      localAudioStream,
      localVideoStream,
      localScreenShareStream,
      localScreenShareAudioStream,

      remoteUserStreams,
      externalStreams
    }),
    [
      loading,
      connectionStatus,
      pushToTalkActive,
      isScreenShareSupported,
      getOrCreateRefs,
      getConsumerCodec,
      getStreamQuality,
      getStreamQualityLayers,
      setStreamQuality,
      isSimulcastConsumer,
      init,

      toggleMic,
      toggleSound,
      toggleWebcam,
      toggleScreenShare,
      ownVoiceState,

      localAudioStream,
      localVideoStream,
      localScreenShareStream,
      localScreenShareAudioStream,
      remoteUserStreams,
      externalStreams
    ]
  );

  const statsContextValue = useMemo(
    () => ({ stats: transportStats, subscribe: subscribeToStats }),
    [transportStats, subscribeToStats]
  );

  return (
    <VoiceProviderContext.Provider value={contextValue}>
      <VoiceStatsContext.Provider value={statsContextValue}>
        <VolumeControlProvider>
          <div className="relative">
            <FloatingPinnedCard
              remoteUserStreams={remoteUserStreams}
              externalStreams={externalStreams}
              localScreenShareStream={localScreenShareStream}
              localVideoStream={localVideoStream}
            />
            {children}
          </div>
          {desktopCapturePicker}
        </VolumeControlProvider>
      </VoiceStatsContext.Provider>
    </VoiceProviderContext.Provider>
  );
});

export { VoiceProvider, VoiceProviderContext };

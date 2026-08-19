import { useCurrentVoiceChannelId } from '@/features/server/channels/hooks';
import { useWebRtcSimulcastEnabled } from '@/features/server/hooks';
import { playSound } from '@/features/server/sounds/actions';
import { SoundType } from '@/features/server/types';
import { updateOwnVoiceState } from '@/features/server/voice/actions';
import { useOwnVoiceState } from '@/features/server/voice/hooks';
import {
  clampMicrophoneDecibels,
  MICROPHONE_GATE_CLOSE_HOLD_MS,
  MICROPHONE_GATE_DEFAULT_THRESHOLD_DB
} from '@/helpers/audio-gate';
import {
  createNoiseGateWorkletNode,
  getNoiseGateWorkletAvailabilitySnapshot,
  markNoiseGateWorkletUnavailable,
  postNoiseGateWorkletConfig
} from '@/helpers/audio-worklet/noise-gate-worklet';
import { createNsChain } from '@/helpers/audio-worklet/ns-worklet';

import { logVoice } from '@/helpers/browser-logger';
import {
  getRestrictOwnAudioSupport,
  getSuppressLocalAudioPlaybackSupport
} from '@/helpers/get-display-media-support';
import { getResWidthHeight } from '@/helpers/get-res-with-height';
import {
  getPushToTalkSettings,
  subscribePushToTalkSettings
} from '@/helpers/push-to-talk';
import { useScreenShareSupport } from '@/hooks/use-screen-share-support';
import { getTRPCClient } from '@/lib/trpc';
import { isDesktopClient } from '@/platform/environment';
import { NoiseSuppression, VideoCodec, type TStreamQuality } from '@/types';
import {
  DEFAULT_BITRATE,
  StreamKind,
  type ConsumerType,
  type TStreamQualityLayer,
  type TVoiceUserState
} from '@sharkord/shared';
import { Device } from 'mediasoup-client';
import type {
  ProducerOptions,
  RtpCapabilities,
  RtpCodecCapability
} from 'mediasoup-client/types';
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
import { toast } from 'sonner';
import { useDevices } from '../devices-provider/hooks/use-devices';
import {
  clearVoiceControlsBridge,
  setVoiceControlsBridge
} from './controls-bridge';
import { FloatingPinnedCard } from './floating-pinned-card';
import {
  getRemoteConsumerTypeKey,
  getScreenShareSimulcastEncodings,
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
import { useDesktopCapturePicker } from './hooks/use-desktop-capture-picker';
import { useLocalStreams } from './hooks/use-local-streams';
import { useRemoteStreams } from './hooks/use-remote-streams';
import {
  useTransportStats,
  type TransportStatsData
} from './hooks/use-transport-stats';
import { useTransports } from './hooks/use-transports';
import { useVoiceControls } from './hooks/use-voice-controls';
import { useVoiceEvents } from './hooks/use-voice-events';
import {
  createProcessAudioTrack,
  type TProcessAudioTrack
} from './process-audio-capture';
import { SIMULCAST_WEBCAM_MAX_BITRATE } from './statics';
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

export type { AudioVideoRefs };

enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  FAILED = 'failed'
}

export type TVoiceProvider = {
  loading: boolean;
  connectionStatus: ConnectionStatus;
  pushToTalkActive: boolean;
  transportStats: TransportStatsData;
  audioVideoRefsMap: Map<number, AudioVideoRefs>;
  ownVoiceState: TVoiceUserState;
  isScreenShareSupported: boolean;
  getOrCreateRefs: (remoteId: number) => AudioVideoRefs;
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
  transportStats: {
    producer: null,
    consumer: null,
    screenShare: null,
    totalBytesReceived: 0,
    totalBytesSent: 0,
    isMonitoring: false,
    currentBitrateReceived: 0,
    currentBitrateSent: 0,
    averageBitrateReceived: 0,
    averageBitrateSent: 0
  },
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
    sharingScreen: false
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

const reportDesktopCaptureDiagnostic = (
  stage: string,
  details: Record<string, boolean | number | string | undefined> = {}
) => {
  if (!isDesktopClient()) return;

  void window.sandSharkDesktop
    ?.reportDesktopCaptureDiagnostic({ stage, details })
    .catch(() => undefined);
};

const VoiceProvider = memo(({ children }: TVoiceProviderProps) => {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.DISCONNECTED
  );
  const [pushToTalkHeld, setPushToTalkHeld] = useState(false);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);
  const [pushToTalkRegistered, setPushToTalkRegistered] = useState(false);
  const routerRtpCapabilities = useRef<RtpCapabilities | null>(null);
  const deviceRtpCapabilities = useRef<RtpCapabilities | null>(null);
  const audioVideoRefsMap = useRef<Map<number, AudioVideoRefs>>(new Map());
  const previousVoiceChannelIdRef = useRef<number | undefined>(undefined);
  const transportRecoveryRef = useRef<() => void>(() => {});
  const transportRecoveryInProgressRef = useRef(false);
  const transportRecoveryAttemptsRef = useRef(0);
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
  const { chooseDesktopCaptureSource, picker: desktopCapturePicker } =
    useDesktopCapturePicker();

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
      } catch (error) {
        logVoice('Error setting consumer quality', {
          error,
          remoteId,
          kind,
          quality
        });
      }
    },
    [shouldShowQualityPicker]
  );

  const getOrCreateRefs = useCallback((remoteId: number): AudioVideoRefs => {
    if (!audioVideoRefsMap.current.has(remoteId)) {
      audioVideoRefsMap.current.set(remoteId, {
        videoRef: { current: null },
        audioRef: { current: null },
        screenShareRef: { current: null },
        screenShareAudioRef: { current: null },
        externalAudioRef: { current: null },
        externalVideoRef: { current: null }
      });
    }

    return audioVideoRefsMap.current.get(remoteId)!;
  }, []);

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
    startMonitoring,
    stopMonitoring,
    resetStats,
    setScreenShareProducer
  } = useTransportStats();
  const rawMicrophoneStreamRef = useRef<MediaStream | null>(null);
  const transmitMicrophoneTrackRef = useRef<MediaStreamTrack | null>(null);
  const microphoneNoiseGateAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneNoiseGateWorkletNodeRef = useRef<AudioWorkletNode | null>(
    null
  );
  const nsAudioContextsRef = useRef<AudioContext[]>([]);
  const processAudioTrackRef = useRef<TProcessAudioTrack | undefined>(
    undefined
  );
  const micMutedRef = useRef(ownVoiceState.micMuted);
  const pushToTalkActiveRef = useRef(pushToTalkActive);
  const pushToTalkModeRef = useRef<'talk' | 'mute' | undefined>(undefined);

  const syncTransmitMicrophoneTrackState = useCallback(() => {
    const track = transmitMicrophoneTrackRef.current;

    if (!track) return;

    const pushToTalkMode = pushToTalkModeRef.current;
    const shouldEnable =
      !micMutedRef.current &&
      (pushToTalkMode === undefined ||
        (pushToTalkMode === 'talk'
          ? pushToTalkActiveRef.current
          : !pushToTalkActiveRef.current));

    if (track.enabled !== shouldEnable) {
      track.enabled = shouldEnable;
    }
  }, []);

  const cleanupMicProcessingResources = useCallback(() => {
    if (microphoneNoiseGateWorkletNodeRef.current) {
      microphoneNoiseGateWorkletNodeRef.current.disconnect();
      microphoneNoiseGateWorkletNodeRef.current = null;
    }

    if (microphoneNoiseGateAudioContextRef.current) {
      microphoneNoiseGateAudioContextRef.current.close();
      microphoneNoiseGateAudioContextRef.current = null;
    }

    nsAudioContextsRef.current.forEach((ctx) => ctx.close());
    nsAudioContextsRef.current = [];

    rawMicrophoneStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
    rawMicrophoneStreamRef.current = null;

    transmitMicrophoneTrackRef.current?.stop();
    transmitMicrophoneTrackRef.current = null;
  }, []);

  const stopProcessAudioTrack = useCallback(async () => {
    const processAudioTrack = processAudioTrackRef.current;
    processAudioTrackRef.current = undefined;

    await processAudioTrack?.stop();
  }, []);

  useEffect(() => {
    micMutedRef.current = ownVoiceState.micMuted;
    syncTransmitMicrophoneTrackState();
  }, [ownVoiceState.micMuted, syncTransmitMicrophoneTrackState]);

  useEffect(() => {
    if (!microphoneNoiseGateWorkletNodeRef.current) return;

    postNoiseGateWorkletConfig(microphoneNoiseGateWorkletNodeRef.current, {
      enabled: devices.noiseGateEnabled ?? true,
      holdMs: MICROPHONE_GATE_CLOSE_HOLD_MS
    });
  }, [devices.noiseGateEnabled]);

  useEffect(() => {
    if (!microphoneNoiseGateWorkletNodeRef.current) return;

    postNoiseGateWorkletConfig(microphoneNoiseGateWorkletNodeRef.current, {
      thresholdDb: clampMicrophoneDecibels(
        devices.noiseGateThresholdDb ?? MICROPHONE_GATE_DEFAULT_THRESHOLD_DB
      )
    });
  }, [devices.noiseGateThresholdDb]);

  const startMicStream = useCallback(async () => {
    try {
      logVoice('Starting microphone stream');
      cleanupMicProcessingResources();

      const useNsChain =
        devices.noiseSuppression === NoiseSuppression.DTLN ||
        devices.noiseSuppression === NoiseSuppression.RNNOISE;
      const useStandardNs =
        devices.noiseSuppression === NoiseSuppression.STANDARD;
      const useDtln = devices.noiseSuppression === NoiseSuppression.DTLN;

      const hasSpecificMic =
        !!devices.microphoneId && devices.microphoneId !== 'default';

      const micStreamConstraints: MediaStreamConstraints = {
        audio: {
          deviceId: hasSpecificMic
            ? { exact: devices.microphoneId }
            : undefined,
          autoGainControl: devices.autoGainControl,
          echoCancellation: devices.echoCancellation,
          noiseSuppression: useStandardNs,
          sampleRate: useDtln ? 16000 : undefined,
          channelCount: 1
        },
        video: false
      };

      logVoice(
        'Requesting microphone stream with constraints',
        micStreamConstraints
      );

      const rawStream =
        await navigator.mediaDevices.getUserMedia(micStreamConstraints);

      logVoice('Microphone stream obtained', { stream: rawStream });

      const rawAudioTrack = rawStream.getAudioTracks()[0];

      if (rawAudioTrack) {
        const shouldUseNoiseGate = !!devices.noiseGateEnabled;
        const noiseGateAvailability = getNoiseGateWorkletAvailabilitySnapshot();
        let transmitTrack: MediaStreamTrack = rawAudioTrack;
        let transmitStream: MediaStream = rawStream;

        if (shouldUseNoiseGate && noiseGateAvailability.available) {
          let audioContext: AudioContext | null = null;

          try {
            audioContext = new window.AudioContext();
            const source = audioContext.createMediaStreamSource(rawStream);
            const noiseGateNode = await createNoiseGateWorkletNode(
              audioContext,
              {
                enabled: true,
                thresholdDb: clampMicrophoneDecibels(
                  devices.noiseGateThresholdDb ??
                    MICROPHONE_GATE_DEFAULT_THRESHOLD_DB
                ),
                holdMs: MICROPHONE_GATE_CLOSE_HOLD_MS
              }
            );
            const destination = audioContext.createMediaStreamDestination();

            source.connect(noiseGateNode);
            noiseGateNode.connect(destination);

            const processedTrack = destination.stream.getAudioTracks()[0];

            if (processedTrack) {
              rawMicrophoneStreamRef.current = rawStream;
              microphoneNoiseGateAudioContextRef.current = audioContext;
              microphoneNoiseGateWorkletNodeRef.current = noiseGateNode;
              transmitTrack = processedTrack;
              transmitStream = destination.stream;
            } else {
              noiseGateNode.disconnect();
              audioContext.close();
              audioContext = null;
              logVoice(
                'Noise gate worklet produced no audio track, using ungated mic stream'
              );
            }
          } catch (error) {
            if (audioContext) {
              audioContext.close();
            }

            logVoice(
              'Failed to initialize live noise gate worklet, using ungated mic stream',
              {
                error
              }
            );
            markNoiseGateWorkletUnavailable(
              'Failed to initialize the noise gate audio processor.'
            );
          }
        } else if (shouldUseNoiseGate && !noiseGateAvailability.available) {
          logVoice('Noise gate unavailable, using ungated microphone stream', {
            reason: noiseGateAvailability.reason
          });
        }

        if (useNsChain) {
          logVoice('Setting up noise suppression', {
            type: devices.noiseSuppression
          });

          try {
            const chain = await createNsChain(
              devices.noiseSuppression,
              transmitStream
            );
            nsAudioContextsRef.current = chain.contexts;
            transmitTrack = chain.outputTrack;
            transmitStream = new MediaStream([chain.outputTrack]);
            logVoice('Noise suppression chain ready');
          } catch (nsError) {
            logVoice('Failed to set up noise suppression', {
              error: nsError
            });
          }
        }

        transmitMicrophoneTrackRef.current = transmitTrack;
        setLocalAudioStream(transmitStream);
        syncTransmitMicrophoneTrackState();

        logVoice('Obtained audio track', { audioTrack: rawAudioTrack });

        localAudioProducer.current = await producerTransport.current?.produce({
          track: transmitTrack,
          codecOptions: {
            // All audio producers share one bundled Opus payload type. Keep
            // this aligned with screen-audio and the router capability to
            // avoid an SDP codec collision when a screen share starts.
            opusStereo: true,
            opusFec: true,
            opusDtx: false,
            opusMaxPlaybackRate: 48000,
            opusMaxAverageBitrate: 128000
          },
          appData: { kind: StreamKind.AUDIO }
        });

        logVoice('Microphone audio producer created', {
          producer: localAudioProducer.current
        });

        localAudioProducer.current?.on('@close', async () => {
          logVoice('Audio producer closed');

          const trpc = getTRPCClient();

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.AUDIO
            });
          } catch (error) {
            logVoice('Error closing audio producer', { error });
          }
        });

        rawAudioTrack.onended = () => {
          logVoice('Audio track ended, cleaning up microphone');

          transmitStream.getAudioTracks().forEach((track) => {
            track.stop();
          });
          cleanupMicProcessingResources();
          localAudioProducer.current?.close();

          setLocalAudioStream(undefined);
        };
      } else {
        rawStream.getTracks().forEach((track) => track.stop());
        throw new Error('Failed to obtain audio track from microphone');
      }
    } catch (error) {
      cleanupMicProcessingResources();
      setLocalAudioStream(undefined);
      logVoice('Error starting microphone stream', { error });
    }
  }, [
    cleanupMicProcessingResources,
    producerTransport,
    setLocalAudioStream,
    localAudioProducer,
    syncTransmitMicrophoneTrackState,
    devices.microphoneId,
    devices.autoGainControl,
    devices.echoCancellation,
    devices.noiseSuppression,
    devices.noiseGateEnabled,
    devices.noiseGateThresholdDb
  ]);

  const startWebcamStream = useCallback(async () => {
    let stream: MediaStream | undefined;

    try {
      logVoice('Starting webcam stream');

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

      logVoice('Requesting webcam stream with constraints', webcamConstraints);

      const webcamStream =
        await navigator.mediaDevices.getUserMedia(webcamConstraints);
      stream = webcamStream;

      logVoice('Webcam stream obtained', { stream: webcamStream });

      setLocalVideoStream(webcamStream);

      const videoTrack = webcamStream.getVideoTracks()[0];

      if (videoTrack) {
        logVoice('Obtained video track', { videoTrack });

        const transport = producerTransport.current;

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
          localVideoProducer.current = await transport.produce(
            simulcastWebcamProducerOptions
          );
        } catch (error) {
          if (!simulcastCodec) throw error;

          logVoice(
            'Failed to create simulcast webcam producer, retrying without simulcast',
            { error }
          );

          localVideoProducer.current = await transport.produce(
            webcamProducerOptions
          );
        }

        logVoice('Webcam video producer created', {
          producer: localVideoProducer.current
        });

        localVideoProducer.current?.on('@close', async () => {
          logVoice('Video producer closed');

          const trpc = getTRPCClient();

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.VIDEO
            });
          } catch (error) {
            logVoice('Error closing video producer', { error });
          }
        });

        videoTrack.onended = () => {
          logVoice('Video track ended, cleaning up webcam');

          webcamStream.getVideoTracks().forEach((track) => {
            track.stop();
          });
          localVideoProducer.current?.close();
          localVideoProducer.current = undefined;

          setLocalVideoStream(undefined);
          updateOwnVoiceState({ webcamEnabled: false });

          void getTRPCClient()
            .voice.updateState.mutate({ webcamEnabled: false })
            .catch((error) => {
              logVoice('Error updating webcam state after camera ended', {
                error
              });
            });
        };
      } else {
        throw new Error('Failed to obtain video track from webcam');
      }
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      localVideoProducer.current?.close();
      localVideoProducer.current = undefined;
      setLocalVideoStream(undefined);
      logVoice('Error starting webcam stream', { error });
      throw error;
    }
  }, [
    setLocalVideoStream,
    localVideoProducer,
    producerTransport,
    devices.webcamId,
    devices.webcamFramerate,
    devices.webcamResolution,
    simulcastEnabled
  ]);

  const stopWebcamStream = useCallback(() => {
    logVoice('Stopping webcam stream');

    localVideoStream?.getVideoTracks().forEach((track) => {
      logVoice('Stopping video track', { track });

      track.stop();
      localVideoStream.removeTrack(track);
    });

    localVideoProducer.current?.close();
    localVideoProducer.current = undefined;

    setLocalVideoStream(undefined);
  }, [localVideoStream, setLocalVideoStream, localVideoProducer]);

  const stopScreenShareStream = useCallback(() => {
    logVoice('Stopping screen share stream');

    localScreenShareStream?.getTracks().forEach((track) => {
      logVoice('Stopping screen share track', { track });

      track.stop();
      localScreenShareStream.removeTrack(track);
    });

    localScreenShareProducer.current?.close();
    localScreenShareProducer.current = undefined;

    localScreenShareAudioProducer.current?.close();
    localScreenShareAudioProducer.current = undefined;
    void stopProcessAudioTrack();

    setScreenShareProducer(null);
    setLocalScreenShare(undefined);
    setLocalScreenShareAudio(undefined);
  }, [
    localScreenShareStream,
    setLocalScreenShare,
    setLocalScreenShareAudio,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    setScreenShareProducer,
    stopProcessAudioTrack
  ]);

  const startScreenShareStream = useCallback(async () => {
    try {
      logVoice('Starting screen share stream');
      await stopProcessAudioTrack();
      const canRestrictOwnAudio = getRestrictOwnAudioSupport();
      const canSuppressLocalAudioPlayback =
        getSuppressLocalAudioPlaybackSupport();
      const screenCaptureSize = getResWidthHeight(devices?.screenResolution);
      const screenCaptureFrameRate = devices?.screenFramerate ?? 30;
      const screenCaptureConstraints: MediaTrackConstraints = {
        width: { max: screenCaptureSize.width },
        height: { max: screenCaptureSize.height },
        frameRate: { max: screenCaptureFrameRate }
      };
      const isDesktopScreenShare = isDesktopClient();
      let processAudioTrack: TProcessAudioTrack | undefined;
      const systemAudioConstraints = devices.shareSystemAudio
        ? {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2,
            sampleRate: 48000,
            suppressLocalAudioPlayback: canSuppressLocalAudioPlayback
              ? (devices.suppressLocalAudioPlayback ?? false)
              : undefined,
            restrictOwnAudio: canRestrictOwnAudio
              ? (devices.restrictOwnAudio ?? false)
              : undefined
          }
        : false;

      const displayMediaConstraints: MediaStreamConstraints = {
        video: screenCaptureConstraints,
        audio: isDesktopScreenShare ? false : systemAudioConstraints
      };

      logVoice(
        'Requesting display media with constraints',
        displayMediaConstraints
      );
      reportDesktopCaptureDiagnostic('capture-requested', {
        systemAudioRequested: Boolean(devices.shareSystemAudio),
        requestedWidth: screenCaptureSize.width,
        requestedHeight: screenCaptureSize.height,
        requestedFrameRate: screenCaptureFrameRate
      });

      const desktopCaptureSource = isDesktopScreenShare
        ? await chooseDesktopCaptureSource()
        : undefined;

      if (isDesktopScreenShare && !desktopCaptureSource) {
        reportDesktopCaptureDiagnostic('source-picker-cancelled');
        throw new DOMException('Screen share was cancelled.', 'AbortError');
      }

      let stream: MediaStream;

      if (desktopCaptureSource) {
        const desktopApi = window.sandSharkDesktop;

        if (!desktopApi) {
          throw new Error('Desktop screen capture is unavailable.');
        }

        reportDesktopCaptureDiagnostic('source-picker-selected', {
          sourceType: desktopCaptureSource.type,
          systemAudioRequested: Boolean(devices.shareSystemAudio)
        });
        await desktopApi.setDesktopCaptureSource(desktopCaptureSource.id);
        if (
          devices.shareSystemAudio &&
          desktopCaptureSource.type === 'window'
        ) {
          const applicationAudio =
            await desktopApi.startApplicationAudioCapture(
              desktopCaptureSource.id
            );

          if (
            applicationAudio.active &&
            applicationAudio.captureId &&
            applicationAudio.sampleRate &&
            applicationAudio.channels &&
            applicationAudio.format
          ) {
            try {
              processAudioTrack = await createProcessAudioTrack({
                captureId: applicationAudio.captureId,
                sampleRate: applicationAudio.sampleRate,
                channels: applicationAudio.channels,
                format: applicationAudio.format
              });
              processAudioTrackRef.current = processAudioTrack;
              displayMediaConstraints.audio = false;
              reportDesktopCaptureDiagnostic('application-audio-enabled', {
                sampleRate: applicationAudio.sampleRate,
                channels: applicationAudio.channels,
                format: applicationAudio.format
              });
            } catch (error) {
              await desktopApi.stopApplicationAudioCapture();
              throw new Error(
                error instanceof Error
                  ? error.message
                  : 'Could not start application audio capture.'
              );
            }
          } else {
            reportDesktopCaptureDiagnostic('application-audio-unavailable', {
              reason: applicationAudio.reason
            });
            throw new Error(
              applicationAudio.reason ??
                'Could not start application audio capture.'
            );
          }
        } else if (desktopCaptureSource.type === 'screen') {
          displayMediaConstraints.audio = systemAudioConstraints;
        }
        // Electron grants the selected desktop source and Windows loopback
        // audio as one request. A second display request can fail because
        // Chromium only has one active picker/capture authorization.
        stream = await navigator.mediaDevices.getDisplayMedia(
          displayMediaConstraints
        );
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia(
          displayMediaConstraints
        );
      }

      logVoice('Screen share stream obtained', { stream });
      setLocalScreenShare(stream);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = processAudioTrack?.track ?? stream.getAudioTracks()[0];

      reportDesktopCaptureDiagnostic('capture-obtained', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackReadyState: videoTrack?.readyState,
        audioTrackReadyState: audioTrack?.readyState
      });

      if (devices.shareSystemAudio && !audioTrack) {
        logVoice('System audio is unavailable for the selected capture source');
        toast.warning(
          'System audio is unavailable for this source. Sharing video only.'
        );
      }

      if (videoTrack) {
        try {
          await videoTrack.applyConstraints(screenCaptureConstraints);
        } catch (error) {
          logVoice('Could not apply screen share output constraints', {
            error,
            requested: screenCaptureConstraints
          });
        }

        logVoice('Screen share track settings after constraints', {
          requested: screenCaptureConstraints,
          actual: videoTrack.getSettings()
        });
        logVoice('Obtained video track', { videoTrack });

        videoTrack.contentHint = 'detail';

        let preferredCodec: RtpCodecCapability | undefined;

        if (
          !simulcastEnabled &&
          devices.screenCodec &&
          devices.screenCodec !== VideoCodec.AUTO &&
          routerRtpCapabilities.current?.codecs
        ) {
          preferredCodec = routerRtpCapabilities.current.codecs.find(
            (c) =>
              c.mimeType.toLowerCase() === devices.screenCodec.toLowerCase()
          );

          if (preferredCodec) {
            logVoice('Using preferred screen share codec', {
              codec: preferredCodec.mimeType
            });
          }
        }

        const maxBitrateKbps = devices.screenBitrate ?? DEFAULT_BITRATE;
        const simulcastCodec = simulcastEnabled
          ? getSimulcastCodec(routerRtpCapabilities.current)
          : undefined;
        const screenCodec = simulcastCodec ?? preferredCodec;

        if (simulcastCodec) {
          logVoice('Using VP8 for simulcast screen share', {
            codec: simulcastCodec.mimeType
          });
        } else if (simulcastEnabled) {
          logVoice(
            'VP8 is unavailable, creating screen share without simulcast'
          );
        }
        const screenShareProducerOptions: ProducerOptions<TVideoProducerAppData> =
          {
            track: videoTrack,
            codec: screenCodec,
            codecOptions: {
              videoGoogleStartBitrate: Math.min(2000, maxBitrateKbps),
              videoGoogleMaxBitrate: maxBitrateKbps,
              videoGoogleMinBitrate: Math.min(200, maxBitrateKbps)
            },
            appData: {
              kind: StreamKind.SCREEN
            }
          };
        const fallbackScreenShareProducerOptions = {
          ...screenShareProducerOptions,
          codec: preferredCodec
        };
        let simulcastScreenShareProducerOptions = screenShareProducerOptions;

        if (simulcastCodec) {
          const encodings = getScreenShareSimulcastEncodings(
            maxBitrateKbps * 1000
          );
          const qualityLayers = getSimulcastQualityLayers(encodings);

          simulcastScreenShareProducerOptions = {
            ...screenShareProducerOptions,
            appData: { kind: StreamKind.SCREEN, qualityLayers },
            encodings
          };
        }

        try {
          localScreenShareProducer.current =
            await producerTransport.current?.produce(
              simulcastScreenShareProducerOptions
            );
        } catch (error) {
          if (!simulcastCodec) throw error;

          logVoice(
            'Failed to create simulcast screen share producer, retrying without simulcast',
            { error }
          );

          localScreenShareProducer.current =
            await producerTransport.current?.produce(
              fallbackScreenShareProducerOptions
            );
        }

        setScreenShareProducer(localScreenShareProducer.current);

        localScreenShareProducer.current?.on('@close', async () => {
          logVoice('Screen share producer closed');

          const trpc = getTRPCClient();

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.SCREEN
            });
          } catch (error) {
            logVoice('Error closing screen share producer', { error });
          }
        });

        videoTrack.onended = () => {
          logVoice('Screen share track ended, cleaning up screen share');

          stream.getTracks().forEach((track) => {
            track.stop();
          });
          localScreenShareProducer.current?.close();
          localScreenShareProducer.current = undefined;
          localScreenShareAudioProducer.current?.close();
          localScreenShareAudioProducer.current = undefined;
          void stopProcessAudioTrack();

          setScreenShareProducer(null);
          setLocalScreenShare(undefined);
          setLocalScreenShareAudio(undefined);
        };

        if (audioTrack) {
          logVoice('Obtained audio track', { audioTrack });

          localScreenShareAudioProducer.current =
            await producerTransport.current?.produce({
              track: audioTrack,
              codecOptions: {
                opusStereo: true,
                opusFec: true,
                opusDtx: false,
                opusMaxPlaybackRate: 48000,
                opusMaxAverageBitrate: 128000
              },
              appData: { kind: StreamKind.SCREEN_AUDIO }
            });

          setLocalScreenShareAudio(new MediaStream([audioTrack]));

          localScreenShareAudioProducer.current?.on('@close', async () => {
            logVoice('Screen share audio producer closed');

            const trpc = getTRPCClient();

            try {
              await trpc.voice.closeProducer.mutate({
                kind: StreamKind.SCREEN_AUDIO
              });
            } catch (error) {
              logVoice('Error closing screen share audio producer', { error });
            }
          });

          audioTrack.onended = () => {
            localScreenShareAudioProducer.current?.close();
            localScreenShareAudioProducer.current = undefined;
            setLocalScreenShareAudio(undefined);
            void stopProcessAudioTrack();
          };
        }

        return videoTrack;
      } else {
        throw new Error('No video track obtained for screen share');
      }
    } catch (error) {
      localScreenShareAudioProducer.current?.close();
      localScreenShareAudioProducer.current = undefined;
      localScreenShareProducer.current?.close();
      localScreenShareProducer.current = undefined;
      await stopProcessAudioTrack();

      setLocalScreenShare(undefined);
      setLocalScreenShareAudio(undefined);
      logVoice('Error starting screen share stream', { error });
      reportDesktopCaptureDiagnostic('capture-failed', {
        errorName: error instanceof DOMException ? error.name : 'Error',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack:
          error instanceof Error ? error.stack?.slice(0, 2_000) : undefined,
        systemAudioRequested: Boolean(devices.shareSystemAudio),
        desktopApiAvailable: Boolean(window.sandSharkDesktop)
      });
      throw error;
    }
  }, [
    setLocalScreenShare,
    setLocalScreenShareAudio,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    producerTransport,
    setScreenShareProducer,
    devices.screenResolution,
    devices.screenFramerate,
    devices.screenCodec,
    devices.screenBitrate,
    devices.shareSystemAudio,
    devices.restrictOwnAudio,
    devices.suppressLocalAudioPlayback,
    simulcastEnabled,
    chooseDesktopCaptureSource,
    stopProcessAudioTrack
  ]);

  const cleanup = useCallback(() => {
    logVoice('Running voice provider cleanup');

    void stopProcessAudioTrack();
    stopMonitoring();
    resetStats();
    cleanupMicProcessingResources();
    clearLocalStreams();
    clearRemoteUserStreams();
    clearExternalStreams();
    cleanupTransports();
    deviceRtpCapabilities.current = null;

    setConnectionStatus(ConnectionStatus.DISCONNECTED);
  }, [
    stopMonitoring,
    resetStats,
    cleanupMicProcessingResources,
    clearLocalStreams,
    clearRemoteUserStreams,
    clearExternalStreams,
    cleanupTransports,
    stopProcessAudioTrack
  ]);

  const recoverTransports = useCallback(async () => {
    const capabilities = routerRtpCapabilities.current;

    if (
      !currentVoiceChannelId ||
      !capabilities ||
      transportRecoveryInProgressRef.current
    ) {
      return;
    }

    if (transportRecoveryAttemptsRef.current >= 2) {
      logVoice('Voice transport recovery limit reached');
      setConnectionStatus(ConnectionStatus.FAILED);
      return;
    }

    transportRecoveryInProgressRef.current = true;
    transportRecoveryAttemptsRef.current += 1;
    setLoading(true);
    setConnectionStatus(ConnectionStatus.CONNECTING);

    try {
      logVoice('Recovering failed voice transports', {
        channelId: currentVoiceChannelId,
        attempt: transportRecoveryAttemptsRef.current
      });

      stopMonitoring();
      resetStats();
      cleanupMicProcessingResources();
      clearLocalStreams();
      clearRemoteUserStreams();
      clearExternalStreams();
      cleanupTransports();

      const device = new Device();
      await device.load({ routerRtpCapabilities: capabilities });

      const loadedDevice = device as Device & {
        rtpCapabilities?: RtpCapabilities;
        recvRtpCapabilities?: RtpCapabilities;
      };
      const recvRtpCapabilities =
        loadedDevice.recvRtpCapabilities ?? loadedDevice.rtpCapabilities;

      if (!recvRtpCapabilities) {
        throw new Error('Failed to recover device RTP capabilities');
      }

      deviceRtpCapabilities.current = recvRtpCapabilities;

      await createProducerTransport(device);
      await createConsumerTransport(device);
      await consumeExistingProducers(recvRtpCapabilities);
      await startMicStream();

      if (ownVoiceState.webcamEnabled) {
        await startWebcamStream();
      }

      startMonitoring(producerTransport.current, consumerTransport.current);
      transportRecoveryAttemptsRef.current = 0;
      setConnectionStatus(ConnectionStatus.CONNECTED);
      logVoice('Voice transport recovery completed');
    } catch (error) {
      logVoice('Voice transport recovery failed', { error });
      setConnectionStatus(ConnectionStatus.FAILED);
    } finally {
      setLoading(false);
      transportRecoveryInProgressRef.current = false;
    }
  }, [
    currentVoiceChannelId,
    stopMonitoring,
    resetStats,
    cleanupMicProcessingResources,
    clearLocalStreams,
    clearRemoteUserStreams,
    clearExternalStreams,
    cleanupTransports,
    createProducerTransport,
    createConsumerTransport,
    consumeExistingProducers,
    startMicStream,
    startWebcamStream,
    ownVoiceState.webcamEnabled,
    startMonitoring,
    producerTransport,
    consumerTransport
  ]);

  useEffect(() => {
    transportRecoveryRef.current = () => {
      void recoverTransports();
    };

    return () => {
      transportRecoveryRef.current = () => {};
    };
  }, [recoverTransports]);

  const init = useCallback(
    async (
      incomingRouterRtpCapabilities: RtpCapabilities,
      channelId: number
    ) => {
      logVoice('Initializing voice provider', {
        incomingRouterRtpCapabilities,
        channelId
      });

      cleanup();

      try {
        setLoading(true);
        setConnectionStatus(ConnectionStatus.CONNECTING);

        routerRtpCapabilities.current = incomingRouterRtpCapabilities;

        const device = new Device();

        await device.load({
          routerRtpCapabilities: incomingRouterRtpCapabilities
        });

        const loadedDevice = device as Device & {
          rtpCapabilities?: RtpCapabilities;
          recvRtpCapabilities?: RtpCapabilities;
        };

        const recvRtpCapabilities =
          loadedDevice.recvRtpCapabilities ?? loadedDevice.rtpCapabilities;

        if (!recvRtpCapabilities) {
          throw new Error('Failed to load device RTP capabilities');
        }

        deviceRtpCapabilities.current = recvRtpCapabilities;

        await createProducerTransport(device);
        await createConsumerTransport(device);
        await consumeExistingProducers(recvRtpCapabilities);
        await startMicStream();

        startMonitoring(producerTransport.current, consumerTransport.current);
        transportRecoveryAttemptsRef.current = 0;
        setConnectionStatus(ConnectionStatus.CONNECTED);
        setLoading(false);
        playSound(SoundType.OWN_USER_JOINED_VOICE_CHANNEL);
      } catch (error) {
        logVoice('Error initializing voice provider', { error });

        setConnectionStatus(ConnectionStatus.FAILED);
        setLoading(false);

        throw error;
      }
    },
    [
      cleanup,
      createProducerTransport,
      createConsumerTransport,
      consumeExistingProducers,
      startMicStream,
      startMonitoring,
      producerTransport,
      consumerTransport
    ]
  );

  const { toggleMic, toggleSound, toggleWebcam, toggleScreenShare } =
    useVoiceControls({
      startMicStream,
      localAudioStream,
      startWebcamStream,
      stopWebcamStream,
      startScreenShareStream,
      stopScreenShareStream
    });

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
      void desktopApi.clearPushToTalk();
      return;
    }

    setPushToTalkRegistered(false);

    void desktopApi
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
      void desktopApi.clearPushToTalk();
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
    pushToTalkActiveRef.current = pushToTalkActive;
    pushToTalkModeRef.current = pushToTalkRegistered
      ? pushToTalkSettings.mode
      : undefined;
    syncTransmitMicrophoneTrackState();
  }, [
    pushToTalkActive,
    pushToTalkRegistered,
    pushToTalkSettings.mode,
    syncTransmitMicrophoneTrackState
  ]);

  useEffect(() => {
    setVoiceControlsBridge({
      setMicMuted: setMicMutedForBridge,
      setSoundMuted: setSoundMutedForBridge
    });

    return () => {
      clearVoiceControlsBridge();
    };
  }, [setMicMutedForBridge, setSoundMutedForBridge]);

  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    return window.sandSharkDesktop.onTrayAction((action) => {
      if (action === 'toggle-mic') {
        void toggleMic();
        return;
      }

      void toggleSound();
    });
  }, [toggleMic, toggleSound]);

  useVoiceEvents({
    consume,
    removeRemoteUserStream,
    removeExternalStreamTrack,
    removeExternalStream,
    clearRemoteUserStreamsForUser,
    rtpCapabilities: deviceRtpCapabilities.current
  });

  useEffect(() => {
    const previousVoiceChannelId = previousVoiceChannelIdRef.current;

    previousVoiceChannelIdRef.current = currentVoiceChannelId;

    if (
      previousVoiceChannelId !== undefined &&
      currentVoiceChannelId === undefined
    ) {
      logVoice('Left voice channel, releasing local voice resources');
      cleanup();
    }
  }, [currentVoiceChannelId, cleanup]);

  useEffect(() => {
    return () => {
      logVoice('Voice provider unmounting, cleaning up resources');
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = useMemo<TVoiceProvider>(
    () => ({
      loading,
      connectionStatus,
      pushToTalkActive,
      transportStats,
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
      transportStats,
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

  return (
    <VoiceProviderContext.Provider value={contextValue}>
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
    </VoiceProviderContext.Provider>
  );
});

export { VoiceProvider, VoiceProviderContext };

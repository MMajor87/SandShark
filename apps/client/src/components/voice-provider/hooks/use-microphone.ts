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

import { voiceLogger } from '@/helpers/browser-logger';
import { getPushToTalkSettings } from '@/helpers/push-to-talk';
import { NoiseSuppression, type TDeviceSettings } from '@/types';
import { StreamKind, type TVoiceUserState } from '@sharkord/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDevices } from '../../devices-provider/hooks/use-devices';
import { useLocalStreams } from '../hooks/use-local-streams';
import { useTransports } from '../hooks/use-transports';

import { createVoiceOperationOwner, stopMediaStream } from '../voice-operation';
import { captureVoiceSession } from '../voice-session';
type TMicrophoneParams = Pick<
  ReturnType<typeof useLocalStreams>,
  'localAudioProducer' | 'setLocalAudioStream'
> & {
  devices: ReturnType<typeof useDevices>['devices'];
  ownVoiceState: TVoiceUserState;
  producerTransport: ReturnType<typeof useTransports>['producerTransport'];
  pushToTalkActive: boolean;
  pushToTalkRegistered: boolean;
  pushToTalkSettings: ReturnType<typeof getPushToTalkSettings>;
};
const useMicrophone = ({
  devices,
  ownVoiceState,
  producerTransport,
  localAudioProducer,
  setLocalAudioStream,
  pushToTalkActive,
  pushToTalkRegistered,
  pushToTalkSettings
}: TMicrophoneParams) => {
  const rawMicrophoneStreamRef = useRef<MediaStream | null>(null);
  const transmitMicrophoneTrackRef = useRef<MediaStreamTrack | null>(null);
  const microphoneNoiseGateAudioContextRef = useRef<AudioContext | null>(null);
  const microphoneNoiseGateWorkletNodeRef = useRef<AudioWorkletNode | null>(
    null
  );
  const nsAudioContextsRef = useRef<AudioContext[]>([]);
  const micMutedRef = useRef(ownVoiceState.micMuted);
  const soundMutedRef = useRef(ownVoiceState.soundMuted);
  const serverMutedRef = useRef(ownVoiceState.serverMuted);
  const pushToTalkActiveRef = useRef(pushToTalkActive);
  const pushToTalkModeRef = useRef<'talk' | 'mute' | undefined>(
    pushToTalkRegistered ? pushToTalkSettings.mode : undefined
  );

  const syncTransmitMicrophoneTrackState = useCallback(
    (targetTrack?: MediaStreamTrack) => {
      const track = targetTrack ?? transmitMicrophoneTrackRef.current;

      if (!track) return;

      // the held key gates transmission without changing the user's manual mute state
      const pushToTalkMode = pushToTalkModeRef.current;
      const shouldEnable =
        !micMutedRef.current &&
        !soundMutedRef.current &&
        !serverMutedRef.current &&
        (pushToTalkMode === undefined ||
          (pushToTalkMode === 'talk'
            ? pushToTalkActiveRef.current
            : !pushToTalkActiveRef.current));

      if (track.enabled !== shouldEnable) {
        track.enabled = shouldEnable;
      }
    },
    []
  );

  const [microphoneOwner] = useState(createVoiceOperationOwner);
  const activeMicrophoneOwner = useRef(microphoneOwner);
  const pendingMicrophoneOwner = useRef<
    ReturnType<typeof createVoiceOperationOwner> | undefined
  >(undefined);
  const cleanupMicProcessingResources = useCallback(() => {
    pendingMicrophoneOwner.current?.cancel();
    pendingMicrophoneOwner.current = undefined;
    activeMicrophoneOwner.current.cancel();
    localAudioProducer.current?.close();
    localAudioProducer.current = undefined;
    rawMicrophoneStreamRef.current = null;
    transmitMicrophoneTrackRef.current = null;
    microphoneNoiseGateAudioContextRef.current = null;
    microphoneNoiseGateWorkletNodeRef.current = null;
    nsAudioContextsRef.current = [];
  }, [localAudioProducer]);

  useEffect(() => {
    micMutedRef.current = ownVoiceState.micMuted;
    soundMutedRef.current = ownVoiceState.soundMuted;
    serverMutedRef.current = ownVoiceState.serverMuted;
    syncTransmitMicrophoneTrackState();
  }, [
    ownVoiceState.micMuted,
    ownVoiceState.soundMuted,
    ownVoiceState.serverMuted,
    syncTransmitMicrophoneTrackState
  ]);

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

  const prepareMicStream = useCallback(
    async (nextDevices: TDeviceSettings, replacing: boolean) => {
      if (!replacing) cleanupMicProcessingResources();
      const session = captureVoiceSession();
      const transport = producerTransport.current;
      const owner = replacing
        ? createVoiceOperationOwner()
        : activeMicrophoneOwner.current;
      if (replacing) {
        pendingMicrophoneOwner.current?.cancel();
        pendingMicrophoneOwner.current = owner;
      }
      const operation = owner.begin(
        () =>
          session.isCurrent() &&
          producerTransport.current === transport &&
          !!transport &&
          !transport.closed
      );
      const trpc = session.client;
      try {
        voiceLogger.info('mic: starting');
        operation.assertCurrent();

        const useNsChain =
          nextDevices.noiseSuppression === NoiseSuppression.DTLN ||
          nextDevices.noiseSuppression === NoiseSuppression.RNNOISE;
        const useStandardNs =
          nextDevices.noiseSuppression === NoiseSuppression.STANDARD;
        const useDtln = nextDevices.noiseSuppression === NoiseSuppression.DTLN;

        const hasSpecificMic =
          !!nextDevices.microphoneId && nextDevices.microphoneId !== 'default';

        const micStreamConstraints: MediaStreamConstraints = {
          audio: {
            deviceId: hasSpecificMic
              ? { exact: nextDevices.microphoneId }
              : undefined,
            autoGainControl: nextDevices.autoGainControl,
            echoCancellation: nextDevices.echoCancellation,
            noiseSuppression: useStandardNs,
            sampleRate: useDtln ? 16000 : undefined,
            channelCount: 1
          },
          video: false
        };

        voiceLogger.info('mic: requesting stream', {
          constraints: micStreamConstraints
        });

        const rawStream = await operation.wait(
          navigator.mediaDevices.getUserMedia(micStreamConstraints),
          stopMediaStream
        );

        voiceLogger.info('mic: stream obtained', {
          trackId: rawStream.getAudioTracks()[0]?.id,
          label: rawStream.getAudioTracks()[0]?.label
        });

        const rawAudioTrack = rawStream.getAudioTracks()[0];

        if (rawAudioTrack) {
          const shouldUseNoiseGate = !!nextDevices.noiseGateEnabled;
          const noiseGateAvailability =
            getNoiseGateWorkletAvailabilitySnapshot();
          let transmitTrack: MediaStreamTrack = rawAudioTrack;
          let transmitStream: MediaStream = rawStream;
          let noiseGateContext: AudioContext | null = null;
          let preparedNoiseGateNode: AudioWorkletNode | null = null;
          let nsContexts: AudioContext[] = [];

          if (shouldUseNoiseGate && noiseGateAvailability.available) {
            let audioContext: AudioContext | null = null;

            try {
              audioContext = operation.own(
                new window.AudioContext(),
                (context) => {
                  if (context.state !== 'closed') return context.close();
                }
              );
              const source = audioContext.createMediaStreamSource(rawStream);
              const noiseGateNode = await operation.wait(
                createNoiseGateWorkletNode(audioContext, {
                  enabled: true,
                  thresholdDb: clampMicrophoneDecibels(
                    nextDevices.noiseGateThresholdDb ??
                      MICROPHONE_GATE_DEFAULT_THRESHOLD_DB
                  ),
                  holdMs: MICROPHONE_GATE_CLOSE_HOLD_MS
                }),
                (node) => node.disconnect()
              );
              const destination = audioContext.createMediaStreamDestination();
              operation.own(destination.stream, stopMediaStream);

              source.connect(noiseGateNode);
              noiseGateNode.connect(destination);

              const processedTrack = destination.stream.getAudioTracks()[0];

              if (processedTrack) {
                noiseGateContext = audioContext;
                preparedNoiseGateNode = noiseGateNode;
                transmitTrack = processedTrack;
                transmitStream = destination.stream;
              } else {
                noiseGateNode.disconnect();
                audioContext.close();
                audioContext = null;
                voiceLogger.warn(
                  'mic: noise gate produced no track, using ungated stream'
                );
              }
            } catch (error) {
              operation.assertCurrent();
              if (audioContext) {
                audioContext.close();
              }

              voiceLogger.error(
                'mic: noise gate worklet failed, using ungated stream',
                error
              );
              markNoiseGateWorkletUnavailable(
                'Failed to initialize the noise gate audio processor.'
              );
            }
          } else if (shouldUseNoiseGate && !noiseGateAvailability.available) {
            voiceLogger.warn(
              'mic: noise gate unavailable, using ungated stream',
              {
                reason: noiseGateAvailability.reason
              }
            );
          }

          if (useNsChain) {
            voiceLogger.info('mic: setting up noise suppression', {
              type: nextDevices.noiseSuppression
            });

            try {
              const chain = await operation.wait(
                createNsChain(nextDevices.noiseSuppression, transmitStream),
                async (chain) => {
                  chain.outputTrack.stop();
                  await Promise.all(
                    chain.contexts.map((context) => context.close())
                  );
                }
              );
              nsContexts = chain.contexts;
              transmitTrack = chain.outputTrack;
              transmitStream = new MediaStream([chain.outputTrack]);
              voiceLogger.info('mic: noise suppression ready');
            } catch (nsError) {
              operation.assertCurrent();
              voiceLogger.warn('mic: noise suppression setup failed', {
                error: nsError
              });
            }
          }

          syncTransmitMicrophoneTrackState(transmitTrack);

          voiceLogger.info('mic: audio track obtained', {
            trackId: rawAudioTrack.id,
            readyState: rawAudioTrack.readyState,
            settings: rawAudioTrack.getSettings()
          });

          if (!producerTransport.current) {
            throw new Error('Producer transport is not available');
          }

          if (replacing) {
            const producer = localAudioProducer.current;
            if (!producer || producer.closed)
              throw new Error('Microphone producer is not available');
            await operation.wait(
              producer.replaceTrack({ track: transmitTrack })
            );
            const previousOwner = activeMicrophoneOwner.current;
            activeMicrophoneOwner.current = owner;
            pendingMicrophoneOwner.current = undefined;
            previousOwner.cancel();
          } else {
            const producer = await transport!.produce({
              track: transmitTrack,
              codecOptions: {
                // all audio producers share one bundled Opus payload type. keep
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
            if (!operation.isCurrent()) {
              producer.close();
              operation.assertCurrent();
            }
            localAudioProducer.current = producer;
          }

          rawMicrophoneStreamRef.current = rawStream;
          transmitMicrophoneTrackRef.current = transmitTrack;
          microphoneNoiseGateAudioContextRef.current = noiseGateContext;
          microphoneNoiseGateWorkletNodeRef.current = preparedNoiseGateNode;
          nsAudioContextsRef.current = nsContexts;
          setLocalAudioStream(transmitStream);

          const activeProducer = localAudioProducer.current;
          if (!activeProducer)
            throw new Error('Microphone producer is not available');
          voiceLogger.info('mic: producer created', {
            producerId: activeProducer.id
          });

          if (!replacing)
            activeProducer.observer.on('close', async () => {
              voiceLogger.info('mic: producer closed');

              if (
                !session.isCurrent() ||
                producerTransport.current !== transport
              )
                return;

              try {
                await trpc.voice.closeProducer.mutate({
                  kind: StreamKind.AUDIO
                });
              } catch (error) {
                voiceLogger.error(
                  'mic: closing producer on the server failed',
                  error
                );
              }
            });

          rawAudioTrack.onended = () => {
            if (!operation.isCurrent()) return;
            voiceLogger.warn('mic: track ended, cleaning up');

            transmitStream.getAudioTracks().forEach((track) => {
              track.stop();
            });
            cleanupMicProcessingResources();

            setLocalAudioStream(undefined);
          };
        } else {
          rawStream.getTracks().forEach((track) => track.stop());
          throw new Error('Failed to obtain audio track from microphone');
        }
      } catch (error) {
        const current = operation.isCurrent();
        operation.dispose();
        if (!current) throw error;
        if (replacing) {
          if (pendingMicrophoneOwner.current === owner)
            pendingMicrophoneOwner.current = undefined;
          voiceLogger.error('mic: device switch failed', error);
          throw error;
        }
        cleanupMicProcessingResources();
        setLocalAudioStream(undefined);
        voiceLogger.error('mic: start failed', error);
      }
    },
    [
      cleanupMicProcessingResources,
      producerTransport,
      setLocalAudioStream,
      localAudioProducer,
      syncTransmitMicrophoneTrackState
    ]
  );

  const startMicStream = useCallback(
    () => prepareMicStream(devices, false),
    [prepareMicStream, devices]
  );
  const switchMicStream = useCallback(
    (nextDevices: TDeviceSettings) => prepareMicStream(nextDevices, true),
    [prepareMicStream]
  );

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

  return { startMicStream, switchMicStream, cleanupMicProcessingResources };
};
export { useMicrophone };

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
import { NoiseSuppression } from '@/types';
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

  const [microphoneOwner] = useState(createVoiceOperationOwner);
  const cleanupMicProcessingResources = useCallback(() => {
    microphoneOwner.cancel();
    rawMicrophoneStreamRef.current = null;
    transmitMicrophoneTrackRef.current = null;
    microphoneNoiseGateAudioContextRef.current = null;
    microphoneNoiseGateWorkletNodeRef.current = null;
    nsAudioContextsRef.current = [];
  }, [microphoneOwner]);

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
    cleanupMicProcessingResources();
    const session = captureVoiceSession();
    const transport = producerTransport.current;
    const operation = microphoneOwner.begin(
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

      rawMicrophoneStreamRef.current = rawStream;

      const rawAudioTrack = rawStream.getAudioTracks()[0];

      if (rawAudioTrack) {
        const shouldUseNoiseGate = !!devices.noiseGateEnabled;
        const noiseGateAvailability = getNoiseGateWorkletAvailabilitySnapshot();
        let transmitTrack: MediaStreamTrack = rawAudioTrack;
        let transmitStream: MediaStream = rawStream;

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
                  devices.noiseGateThresholdDb ??
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
              microphoneNoiseGateAudioContextRef.current = audioContext;
              microphoneNoiseGateWorkletNodeRef.current = noiseGateNode;
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
            type: devices.noiseSuppression
          });

          try {
            const chain = await operation.wait(
              createNsChain(devices.noiseSuppression, transmitStream),
              async (chain) => {
                chain.outputTrack.stop();
                await Promise.all(
                  chain.contexts.map((context) => context.close())
                );
              }
            );
            nsAudioContextsRef.current = chain.contexts;
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

        transmitMicrophoneTrackRef.current = transmitTrack;
        setLocalAudioStream(transmitStream);
        syncTransmitMicrophoneTrackState();

        voiceLogger.info('mic: audio track obtained', {
          trackId: rawAudioTrack.id,
          readyState: rawAudioTrack.readyState,
          settings: rawAudioTrack.getSettings()
        });

        if (!producerTransport.current) {
          throw new Error('Producer transport is not available');
        }

        localAudioProducer.current = await operation.wait(
          transport!.produce({
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
          }),
          (producer) => producer.close()
        );

        voiceLogger.info('mic: producer created', {
          producerId: localAudioProducer.current.id
        });

        localAudioProducer.current?.observer.on('close', async () => {
          voiceLogger.info('mic: producer closed');

          if (!session.isCurrent() || producerTransport.current !== transport)
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
          localAudioProducer.current?.close();

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
      cleanupMicProcessingResources();
      setLocalAudioStream(undefined);
      voiceLogger.error('mic: start failed', error);
    }
  }, [
    microphoneOwner,
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

  return { startMicStream, cleanupMicProcessingResources };
};
export { useMicrophone };

import { voiceLogger } from '@/helpers/browser-logger';
import {
  getRestrictOwnAudioSupport,
  getSuppressLocalAudioPlaybackSupport
} from '@/helpers/get-display-media-support';
import { getResWidthHeight } from '@/helpers/get-res-with-height';
import { isDesktopClient } from '@/platform/environment';
import { VideoCodec } from '@/types';
import {
  DEFAULT_BITRATE,
  getErrorMessage,
  StreamKind,
  type TStreamQualityLayer
} from '@sharkord/shared';
import type {
  ProducerOptions,
  RtpCapabilities,
  RtpCodecCapability
} from 'mediasoup-client/types';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDevices } from '../../devices-provider/hooks/use-devices';
import {
  getScreenShareSimulcastEncodings,
  getSimulcastCodec,
  getSimulcastQualityLayers
} from '../helpers';
import { useDesktopCapturePicker } from '../hooks/use-desktop-capture-picker';
import { useLocalStreams } from '../hooks/use-local-streams';
import { useTransportStats } from '../hooks/use-transport-stats';
import { useTransports } from '../hooks/use-transports';
import {
  createProcessAudioTrack,
  type TProcessAudioTrack
} from '../process-audio-capture';
import { monitorScreenAudio } from '../screen-audio-diagnostics';

import { getDesktopBridge } from '@/platform/desktop';
import { createVoiceOperationOwner, stopMediaStream } from '../voice-operation';
import { captureVoiceSession } from '../voice-session';
type TVideoProducerAppData = {
  kind: StreamKind;
  qualityLayers?: TStreamQualityLayer[];
};
const reportDesktopCaptureDiagnostic = (
  stage: string,
  details: Record<string, boolean | number | string | undefined> = {}
) => {
  if (!isDesktopClient()) return;

  getDesktopBridge()
    ?.reportDesktopCaptureDiagnostic({ stage, details })
    .catch(() => undefined);
};

type TScreenCaptureParams = Pick<
  ReturnType<typeof useLocalStreams>,
  | 'localScreenShareStream'
  | 'localScreenShareProducer'
  | 'localScreenShareAudioProducer'
  | 'setLocalScreenShare'
  | 'setLocalScreenShareAudio'
> & {
  devices: ReturnType<typeof useDevices>['devices'];
  producerTransport: ReturnType<typeof useTransports>['producerTransport'];
  routerRtpCapabilities: React.RefObject<RtpCapabilities | null>;
  simulcastEnabled: boolean;
  setScreenShareProducer: ReturnType<
    typeof useTransportStats
  >['setScreenShareProducer'];
};
const useScreenCapture = ({
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
}: TScreenCaptureParams) => {
  const {
    chooseDesktopCaptureSource,
    picker: desktopCapturePicker,
    cancel: cancelPicker
  } = useDesktopCapturePicker();
  const [screenOwner] = useState(createVoiceOperationOwner);
  const processAudioTrackRef = useRef<TProcessAudioTrack | undefined>(
    undefined
  );
  const stopProcessAudioTrack = useCallback(async () => {
    const processAudioTrack = processAudioTrackRef.current;
    processAudioTrackRef.current = undefined;

    await processAudioTrack?.stop();
  }, []);

  const stopScreenShareStream = useCallback(() => {
    voiceLogger.info('screen: stopping');
    screenOwner.cancel();
    cancelPicker();

    localScreenShareStream?.getTracks().forEach((track) => {
      voiceLogger.info('screen: stopping track', {
        trackId: track.id,
        kind: track.kind
      });

      track.stop();
      localScreenShareStream.removeTrack(track);
    });

    localScreenShareProducer.current?.close();
    localScreenShareProducer.current = undefined;

    localScreenShareAudioProducer.current?.close();
    localScreenShareAudioProducer.current = undefined;
    stopProcessAudioTrack().catch(console.error);

    setScreenShareProducer(null);
    setLocalScreenShare(undefined);
    setLocalScreenShareAudio(undefined);
  }, [
    screenOwner,
    cancelPicker,
    localScreenShareStream,
    setLocalScreenShare,
    setLocalScreenShareAudio,
    localScreenShareProducer,
    localScreenShareAudioProducer,
    setScreenShareProducer,
    stopProcessAudioTrack
  ]);

  const startScreenShareStream = useCallback(async () => {
    const session = captureVoiceSession();
    const transport = producerTransport.current;
    const operation = screenOwner.begin(
      () =>
        session.isCurrent() &&
        producerTransport.current === transport &&
        !!transport &&
        !transport.closed
    );
    const trpc = session.client;
    try {
      operation.assertCurrent();
      voiceLogger.info('Starting screen share stream');
      await operation.wait(stopProcessAudioTrack());
      const canRestrictOwnAudio = getRestrictOwnAudioSupport();
      const canSuppressLocalAudioPlayback =
        getSuppressLocalAudioPlaybackSupport();
      const screenCaptureSize = getResWidthHeight(devices?.screenResolution);
      const screenCaptureFrameRate = devices?.screenFramerate ?? 30;
      const screenCaptureConstraints: MediaTrackConstraints = {
        width: { max: screenCaptureSize.width },
        height: { max: screenCaptureSize.height },
        frameRate: { max: screenCaptureFrameRate },
        // @ts-expect-error - display capture cursor is not in MediaTrackConstraints
        cursor: devices.screenCursor
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

      voiceLogger.info(
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
        ? await operation.wait(chooseDesktopCaptureSource())
        : undefined;

      if (isDesktopScreenShare && !desktopCaptureSource) {
        reportDesktopCaptureDiagnostic('source-picker-cancelled');
        throw new DOMException('Screen share was cancelled.', 'AbortError');
      }

      let stream: MediaStream;

      if (desktopCaptureSource) {
        const desktopApi = getDesktopBridge();

        if (!desktopApi) {
          throw new Error('Desktop screen capture is unavailable.');
        }

        reportDesktopCaptureDiagnostic('source-picker-selected', {
          sourceType: desktopCaptureSource.type,
          systemAudioRequested: Boolean(devices.shareSystemAudio)
        });
        await operation.wait(
          desktopApi.setDesktopCaptureSource(desktopCaptureSource.id)
        );
        if (devices.shareSystemAudio) {
          const applicationAudio = await operation.wait(
            desktopApi.startApplicationAudioCapture(desktopCaptureSource.id),
            (capture) => {
              if (capture.captureId)
                return desktopApi.stopApplicationAudioCapture(
                  capture.captureId
                );
            }
          );

          if (
            applicationAudio.active &&
            applicationAudio.captureId &&
            applicationAudio.sampleRate &&
            applicationAudio.channels &&
            applicationAudio.format
          ) {
            try {
              processAudioTrack = await operation.wait(
                createProcessAudioTrack({
                  captureId: applicationAudio.captureId,
                  sampleRate: applicationAudio.sampleRate,
                  channels: applicationAudio.channels,
                  format: applicationAudio.format
                }),
                (track) => track.stop()
              );
              processAudioTrackRef.current = processAudioTrack;
              displayMediaConstraints.audio = false;
              reportDesktopCaptureDiagnostic('application-audio-enabled', {
                captureMode:
                  desktopCaptureSource.type === 'screen'
                    ? 'exclude-sandshark'
                    : 'include-application',
                sampleRate: applicationAudio.sampleRate,
                channels: applicationAudio.channels,
                format: applicationAudio.format
              });
            } catch (error) {
              await desktopApi.stopApplicationAudioCapture(
                applicationAudio.captureId
              );
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
        }
        // native audio capture avoids Electron loopback recapturing our playback.
        stream = await operation.wait(
          navigator.mediaDevices.getDisplayMedia(displayMediaConstraints),
          stopMediaStream
        );
      } else {
        stream = await operation.wait(
          navigator.mediaDevices.getDisplayMedia(displayMediaConstraints),
          stopMediaStream
        );
      }

      voiceLogger.info('screen: stream obtained', {
        videoTrackId: stream.getVideoTracks()[0]?.id,
        hasAudio: stream.getAudioTracks().length > 0
      });
      setLocalScreenShare(stream);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = processAudioTrack?.track ?? stream.getAudioTracks()[0];

      reportDesktopCaptureDiagnostic('capture-obtained', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrackReadyState: videoTrack?.readyState,
        audioTrackReadyState: audioTrack?.readyState,
        applicationAudio: Boolean(processAudioTrack),
        audioEnabled: audioTrack?.enabled,
        audioMuted: audioTrack?.muted
      });

      if (devices.shareSystemAudio && !audioTrack) {
        voiceLogger.info(
          'System audio is unavailable for the selected capture source'
        );
        toast.warning(
          'System audio is unavailable for this source. Sharing video only.'
        );
      }

      if (videoTrack) {
        try {
          await operation.wait(
            videoTrack.applyConstraints(screenCaptureConstraints)
          );
        } catch (error) {
          operation.assertCurrent();
          voiceLogger.info('Could not apply screen share output constraints', {
            error,
            requested: screenCaptureConstraints
          });
        }

        voiceLogger.info('Screen share track settings after constraints', {
          requested: screenCaptureConstraints,
          actual: videoTrack.getSettings()
        });
        voiceLogger.info('Obtained video track', { videoTrack });

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
            voiceLogger.info('screen: using preferred codec', {
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
          voiceLogger.info('screen: using vp8 for simulcast', {
            codec: simulcastCodec.mimeType
          });
        } else if (simulcastEnabled) {
          voiceLogger.warn(
            'screen: vp8 unavailable, creating without simulcast'
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
          localScreenShareProducer.current = await operation.wait(
            transport!.produce(simulcastScreenShareProducerOptions),
            (producer) => producer.close()
          );
        } catch (error) {
          operation.assertCurrent();
          if (!simulcastCodec) throw error;

          voiceLogger.warn(
            'screen: simulcast producer failed, retrying without simulcast',
            { error: getErrorMessage(error) }
          );

          localScreenShareProducer.current = await operation.wait(
            transport!.produce(fallbackScreenShareProducerOptions),
            (producer) => producer.close()
          );
        }

        voiceLogger.info('screen: producer created', {
          producerId: localScreenShareProducer.current?.id,
          simulcast: !!simulcastCodec
        });

        setScreenShareProducer(localScreenShareProducer.current);

        localScreenShareProducer.current?.observer.on('close', async () => {
          voiceLogger.info('screen: producer closed');

          if (!session.isCurrent() || producerTransport.current !== transport)
            return;

          try {
            await trpc.voice.closeProducer.mutate({
              kind: StreamKind.SCREEN
            });
          } catch (error) {
            voiceLogger.error(
              'screen: closing producer on the server failed',
              error
            );
          }
        });

        videoTrack.onended = () => {
          if (!operation.isCurrent()) return;
          voiceLogger.info('screen: track ended, cleaning up');

          stream.getTracks().forEach((track) => {
            track.stop();
          });
          localScreenShareProducer.current?.close();
          localScreenShareProducer.current = undefined;
          localScreenShareAudioProducer.current?.close();
          localScreenShareAudioProducer.current = undefined;
          stopProcessAudioTrack().catch(console.error);

          setScreenShareProducer(null);
          setLocalScreenShare(undefined);
          setLocalScreenShareAudio(undefined);
        };

        if (audioTrack) {
          voiceLogger.info('screen audio: audio track obtained', {
            trackId: audioTrack.id,
            settings: audioTrack.getSettings()
          });

          if (!producerTransport.current || producerTransport.current.closed) {
            throw new Error('Screen audio producer transport is unavailable.');
          }

          localScreenShareAudioProducer.current = await operation.wait(
            transport!.produce({
              track: audioTrack,
              codecOptions: {
                opusStereo: true,
                opusFec: true,
                opusDtx: false,
                opusMaxPlaybackRate: 48000,
                opusMaxAverageBitrate: 128000
              },
              appData: { kind: StreamKind.SCREEN_AUDIO }
            }),
            (producer) => producer.close()
          );

          monitorScreenAudio(localScreenShareAudioProducer.current);
          voiceLogger.info('screen audio: producer created', {
            producerId: localScreenShareAudioProducer.current?.id
          });

          setLocalScreenShareAudio(new MediaStream([audioTrack]));

          localScreenShareAudioProducer.current?.observer.on(
            'close',
            async () => {
              voiceLogger.info('screen audio: producer closed');

              if (
                !session.isCurrent() ||
                producerTransport.current !== transport
              )
                return;

              try {
                await trpc.voice.closeProducer.mutate({
                  kind: StreamKind.SCREEN_AUDIO
                });
              } catch (error) {
                voiceLogger.error(
                  'screen audio: closing producer on the server failed',
                  error
                );
              }
            }
          );

          audioTrack.onended = () => {
            if (!operation.isCurrent()) return;
            localScreenShareAudioProducer.current?.close();
            localScreenShareAudioProducer.current = undefined;
            setLocalScreenShareAudio(undefined);
            stopProcessAudioTrack().catch(console.error);
          };
        }

        return videoTrack;
      } else {
        throw new Error('No video track obtained for screen share');
      }
    } catch (error) {
      const current = operation.isCurrent();
      operation.dispose();
      if (!current) throw error;
      localScreenShareAudioProducer.current?.close();
      localScreenShareAudioProducer.current = undefined;
      localScreenShareProducer.current?.close();
      localScreenShareProducer.current = undefined;
      await stopProcessAudioTrack();

      setLocalScreenShare(undefined);
      setLocalScreenShareAudio(undefined);
      voiceLogger.info('Error starting screen share stream', { error });
      reportDesktopCaptureDiagnostic('capture-failed', {
        errorName: error instanceof DOMException ? error.name : 'Error',
        error: error instanceof Error ? error.message : String(error),
        errorStack:
          error instanceof Error ? error.stack?.slice(0, 2_000) : undefined,
        systemAudioRequested: Boolean(devices.shareSystemAudio),
        desktopApiAvailable: Boolean(getDesktopBridge())
      });
      voiceLogger.error('screen: start failed', error);
      throw error;
    }
  }, [
    screenOwner,
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
    devices.screenCursor,
    simulcastEnabled,
    routerRtpCapabilities,
    chooseDesktopCaptureSource,
    stopProcessAudioTrack
  ]);

  return {
    startScreenShareStream,
    stopScreenShareStream,
    stopProcessAudioTrack,
    desktopCapturePicker
  };
};
export { useScreenCapture };

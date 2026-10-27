import type { AppData, Producer } from 'mediasoup-client/types';
import { useCallback, useRef, useState } from 'react';

const useLocalStreams = () => {
  const [localVideoStream, setLocalVideoStream] = useState<
    MediaStream | undefined
  >(undefined);
  const [localAudioStream, setLocalAudioStream] = useState<
    MediaStream | undefined
  >(undefined);
  const [localScreenShareStream, setLocalScreenShare] = useState<
    MediaStream | undefined
  >(undefined);
  const [localScreenShareAudioStream, setLocalScreenShareAudio] = useState<
    MediaStream | undefined
  >(undefined);

  const localVideoProducer = useRef<Producer<AppData> | undefined>(undefined);
  const localAudioProducer = useRef<Producer<AppData> | undefined>(undefined);
  const localScreenShareProducer = useRef<Producer<AppData> | undefined>(
    undefined
  );
  const localScreenShareAudioProducer = useRef<Producer<AppData> | undefined>(
    undefined
  );

  const latestStreams = useRef([
    localVideoStream,
    localAudioStream,
    localScreenShareStream,
    localScreenShareAudioStream
  ]);
  latestStreams.current = [
    localVideoStream,
    localAudioStream,
    localScreenShareStream,
    localScreenShareAudioStream
  ];
  const clearLocalStreams = useCallback(() => {
    for (const stream of latestStreams.current) {
      stream?.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
    }
    latestStreams.current = [];

    setLocalVideoStream(undefined);
    setLocalAudioStream(undefined);
    setLocalScreenShare(undefined);
    setLocalScreenShareAudio(undefined);

    localVideoProducer.current?.close();
    localAudioProducer.current?.close();
    localScreenShareProducer.current?.close();
    localScreenShareAudioProducer.current?.close();

    localVideoProducer.current = undefined;
    localAudioProducer.current = undefined;
    localScreenShareProducer.current = undefined;
    localScreenShareAudioProducer.current = undefined;
  }, []);

  return {
    localVideoStream,
    setLocalVideoStream,

    localAudioStream,
    setLocalAudioStream,

    localScreenShareStream,
    setLocalScreenShare,

    localScreenShareAudioStream,
    setLocalScreenShareAudio,

    localVideoProducer,
    localAudioProducer,
    localScreenShareProducer,
    localScreenShareAudioProducer,

    clearLocalStreams
  };
};

export { useLocalStreams };

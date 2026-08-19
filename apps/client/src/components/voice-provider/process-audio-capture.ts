import processAudioCaptureProcessorUrl from '@/audio-worklets/process-audio-capture-processor.js?url';

type TApplicationAudioCapture = {
  captureId: string;
  sampleRate: number;
  channels: number;
  format: 'f32' | 's16';
};

type TProcessAudioTrack = {
  track: MediaStreamTrack;
  stop: () => Promise<void>;
};

const createProcessAudioTrack = async (
  capture: TApplicationAudioCapture
): Promise<TProcessAudioTrack> => {
  const desktopApi = window.sandSharkDesktop;
  if (!desktopApi)
    throw new Error('Desktop application audio capture is unavailable.');

  const audioContext = new AudioContext({ sampleRate: capture.sampleRate });
  await audioContext.audioWorklet.addModule(processAudioCaptureProcessorUrl);

  const worklet = new AudioWorkletNode(
    audioContext,
    'sandshark-process-audio-capture',
    {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [capture.channels]
    }
  );
  const destination = audioContext.createMediaStreamDestination();
  worklet.connect(destination);

  let remainder = new Uint8Array(0);
  const bytesPerSample = capture.format === 'f32' ? 4 : 2;
  const bytesPerFrame = bytesPerSample * capture.channels;
  const unsubscribe = desktopApi.onApplicationAudioData((captureId, data) => {
    if (captureId !== capture.captureId) return;

    const combined = new Uint8Array(remainder.length + data.length);
    combined.set(remainder);
    combined.set(data, remainder.length);
    const completeLength = combined.length - (combined.length % bytesPerFrame);
    remainder = combined.slice(completeLength);
    if (completeLength === 0) return;

    const samples = new Float32Array(completeLength / bytesPerSample);
    const view = new DataView(
      combined.buffer,
      combined.byteOffset,
      completeLength
    );
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] =
        capture.format === 'f32'
          ? view.getFloat32(index * 4, true)
          : view.getInt16(index * 2, true) / 32768;
    }
    worklet.port.postMessage({ type: 'audio', samples }, [samples.buffer]);
  });

  await audioContext.resume();
  const track = destination.stream.getAudioTracks()[0];
  if (!track) {
    unsubscribe();
    worklet.disconnect();
    await audioContext.close();
    throw new Error('Could not create an application audio track.');
  }

  return {
    track,
    stop: async () => {
      unsubscribe();
      track.stop();
      worklet.disconnect();
      await audioContext.close();
      await desktopApi.stopApplicationAudioCapture();
    }
  };
};

export { createProcessAudioTrack };
export type { TApplicationAudioCapture, TProcessAudioTrack };

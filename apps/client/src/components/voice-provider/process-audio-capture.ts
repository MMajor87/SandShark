import processAudioCaptureProcessorUrl from '@/audio-worklets/process-audio-capture-processor.js?url';
import { logVoice } from '@/helpers/browser-logger';
import { getDesktopBridge } from '@/platform/desktop';

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
  const desktopApi = getDesktopBridge();
  if (!desktopApi)
    throw new Error('Desktop application audio capture is unavailable.');

  const audioContext = new AudioContext({ sampleRate: capture.sampleRate });
  let worklet: AudioWorkletNode | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let diagnosticTimer: number | undefined;
  let unsubscribe: (() => void) | undefined;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(diagnosticTimer);
    unsubscribe?.();
    for (const track of destination?.stream.getTracks() ?? []) track.stop();
    worklet?.disconnect();
    await Promise.all([
      audioContext.state === 'closed' ? undefined : audioContext.close(),
      desktopApi.stopApplicationAudioCapture(capture.captureId)
    ]);
  };

  try {
    await audioContext.audioWorklet.addModule(processAudioCaptureProcessorUrl);
    worklet = new AudioWorkletNode(
      audioContext,
      'sandshark-process-audio-capture',
      {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [capture.channels]
      }
    );
    destination = audioContext.createMediaStreamDestination();
    worklet.connect(destination);
    worklet.onprocessorerror = () => {
      logVoice('Application audio worklet stopped processing', {
        captureId: capture.captureId,
        contextState: audioContext.state
      });
    };

    let remainder = new Uint8Array(0);
    let receivedBytes = 0;
    let peak = 0;
    diagnosticTimer = window.setInterval(() => {
      logVoice('Application audio input statistics', {
        captureId: capture.captureId,
        receivedBytes,
        peak,
        contextState: audioContext.state,
        sampleRate: audioContext.sampleRate
      });
      receivedBytes = 0;
      peak = 0;
    }, 10_000);
    const bytesPerSample = capture.format === 'f32' ? 4 : 2;
    const bytesPerFrame = bytesPerSample * capture.channels;
    unsubscribe = desktopApi.onApplicationAudioData((captureId, data) => {
      if (captureId !== capture.captureId) return;
      receivedBytes += data.length;

      const combined = new Uint8Array(remainder.length + data.length);
      combined.set(remainder);
      combined.set(data, remainder.length);
      const completeLength =
        combined.length - (combined.length % bytesPerFrame);
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
        if (Number.isFinite(samples[index])) {
          peak = Math.max(peak, Math.abs(samples[index]));
        }
      }
      worklet?.port.postMessage({ type: 'audio', samples }, [samples.buffer]);
    });

    await audioContext.resume();
    const track = destination.stream.getAudioTracks()[0];
    if (!track) throw new Error('Could not create an application audio track.');
    return { track, stop };
  } catch (error) {
    await stop().catch(console.error);
    throw error;
  }
};

export { createProcessAudioTrack };
export type { TApplicationAudioCapture, TProcessAudioTrack };

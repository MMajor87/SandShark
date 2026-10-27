import { afterEach, expect, mock, test } from 'bun:test';

mock.module('@/audio-worklets/process-audio-capture-processor.js?url', () => ({
  default: 'processor.js'
}));
const { createProcessAudioTrack } = await import('../process-audio-capture');
const originalWindow = globalThis.window;
const originalContext = globalThis.AudioContext;
const originalNode = globalThis.AudioWorkletNode;
afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.AudioContext = originalContext;
  globalThis.AudioWorkletNode = originalNode;
});
const setup = (failure?: string) => {
  const failAt = (step: string) => {
    if (failure === step) throw new Error(step);
  };
  const stop = mock(() => undefined);
  const disconnect = mock(() => undefined);
  const unsubscribe = mock(() => undefined);
  const clearInterval = mock(() => undefined);
  const stopNative = mock(async (_captureId?: string) => undefined);
  const close = mock(async () => undefined);
  const track = { stop };
  class Context {
    state = 'running';
    sampleRate = 48000;
    audioWorklet = { addModule: async () => failAt('load') };
    close = close;
    resume = async () => failAt('resume');
    createMediaStreamDestination = () => ({
      stream: {
        getTracks: () => [track],
        getAudioTracks: () => (failure === 'track' ? [] : [track])
      }
    });
  }
  class Node {
    constructor() {
      failAt('node');
    }
    connect = () => failAt('connect');
    disconnect = disconnect;
    port = { postMessage: () => {} };
  }
  globalThis.AudioContext = Context as unknown as typeof AudioContext;
  globalThis.AudioWorkletNode = Node as unknown as typeof AudioWorkletNode;
  globalThis.window = {
    location: { protocol: 'file:', search: '' },
    setInterval: () => 1,
    clearInterval,
    sandSharkDesktop: {
      onApplicationAudioData: () => {
        failAt('subscribe');
        return unsubscribe;
      },
      stopApplicationAudioCapture: stopNative
    }
  } as unknown as Window & typeof globalThis;
  return { stop, close, disconnect, unsubscribe, clearInterval, stopNative };
};
const capture = {
  captureId: 'old-capture',
  sampleRate: 48000,
  channels: 2,
  format: 'f32' as const
};
for (const failure of [
  'load',
  'node',
  'connect',
  'subscribe',
  'resume',
  'track'
]) {
  test(`application audio releases its context and native helper after ${failure} failure`, async () => {
    const resources = setup(failure);
    await expect(createProcessAudioTrack(capture)).rejects.toThrow();
    expect(resources.close).toHaveBeenCalledTimes(1);
    expect(resources.stopNative).toHaveBeenCalledWith('old-capture');
    if (failure === 'resume' || failure === 'track') {
      expect(resources.stop).toHaveBeenCalledTimes(1);
      expect(resources.unsubscribe).toHaveBeenCalledTimes(1);
      expect(resources.disconnect).toHaveBeenCalledTimes(1);
    }
  });
}
test('application audio stop is idempotent and targets only its owned native capture', async () => {
  const resources = setup();
  const audio = await createProcessAudioTrack(capture);
  await audio.stop();
  await audio.stop();
  expect(resources.stop).toHaveBeenCalledTimes(1);
  expect(resources.close).toHaveBeenCalledTimes(1);
  expect(resources.disconnect).toHaveBeenCalledTimes(1);
  expect(resources.unsubscribe).toHaveBeenCalledTimes(1);
  expect(resources.clearInterval).toHaveBeenCalledTimes(1);
  expect(resources.stopNative.mock.calls).toEqual([['old-capture']]);
});

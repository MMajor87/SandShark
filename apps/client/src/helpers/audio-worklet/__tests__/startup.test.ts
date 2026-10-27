import { afterEach, expect, mock, test } from 'bun:test';

let failLoad = true;
mock.module('../create-worklet-loader', () => ({
  isAudioWorkletSupported: () => true,
  createWorkletLoader: () => ({
    ensureLoaded: async () => {
      if (failLoad) throw new Error('worklet load failed');
    }
  })
}));
const { createDtlnChain } = await import('../dtln-worklet');
const { createRnnoiseChain } = await import('../rnnoise-worklet');
const originalContext = globalThis.AudioContext;
const originalNode = globalThis.AudioWorkletNode;
afterEach(() => {
  globalThis.AudioContext = originalContext;
  globalThis.AudioWorkletNode = originalNode;
  failLoad = true;
});
for (const create of [createDtlnChain, createRnnoiseChain]) {
  test(`${create.name} releases its audio context on partial startup failure`, async () => {
    const close = mock(async () => undefined);
    class Context {
      state = 'running';
      close = close;
    }
    globalThis.AudioContext = Context as unknown as typeof AudioContext;
    const stream = {
      getAudioTracks: () => [{ getSettings: () => ({ sampleRate: 48000 }) }]
    } as unknown as MediaStream;
    await expect(create(stream)).rejects.toThrow('worklet load failed');
    expect(close).toHaveBeenCalledTimes(1);
  });
}

for (const create of [createDtlnChain, createRnnoiseChain]) {
  test(`${create.name} stops its output track if connecting the processing graph fails`, async () => {
    failLoad = false;
    const close = mock(async () => undefined);
    const stop = mock(() => undefined);
    class Context {
      state = 'running';
      close = close;
      createMediaStreamSource = () => ({
        connect: () => {
          throw new Error('connect failed');
        }
      });
      createMediaStreamDestination = () => ({
        stream: { getTracks: () => [{ stop }] }
      });
    }
    class Node {
      port = {
        set onmessage(handler: (event: { data: string }) => void) {
          queueMicrotask(() => handler({ data: 'ready' }));
        }
      };
    }
    globalThis.AudioContext = Context as unknown as typeof AudioContext;
    globalThis.AudioWorkletNode = Node as unknown as typeof AudioWorkletNode;
    const stream = {
      getAudioTracks: () => [{ getSettings: () => ({ sampleRate: 48000 }) }]
    } as unknown as MediaStream;
    await expect(create(stream)).rejects.toThrow('connect failed');
    expect(close).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });
}

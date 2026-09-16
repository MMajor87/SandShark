import { afterEach, expect, mock, test } from 'bun:test';
import type { Producer } from 'mediasoup-client/types';
import { EventEmitter } from 'node:events';

const logVoice = mock(() => undefined);
mock.module('@/helpers/browser-logger', () => ({ logVoice }));
const { monitorScreenAudio } = await import('../screen-audio-diagnostics');
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
  logVoice.mockClear();
});

test('reports audio energy and sent bytes, and releases monitoring on close', async () => {
  const clearInterval = mock(() => undefined);
  let poll = () => {};
  globalThis.window = {
    setInterval: (callback: () => void) => {
      poll = callback;
      return 1;
    },
    clearInterval
  } as unknown as Window & typeof globalThis;
  const observer = new EventEmitter();
  const track = Object.assign(new EventTarget(), {
    readyState: 'live',
    enabled: true,
    muted: false,
    getSettings: () => ({ sampleRate: 48000, channelCount: 2 })
  });
  const getStats = mock(
    async () =>
      new Map([
        ['out', { type: 'outbound-rtp', bytesSent: 100, packetsSent: 5 }],
        [
          'source',
          {
            type: 'media-source',
            kind: 'audio',
            audioLevel: 0.5,
            totalAudioEnergy: 1,
            totalSamplesDuration: 2
          }
        ]
      ])
  );
  monitorScreenAudio({
    id: 'producer',
    track,
    observer,
    getStats,
    paused: false
  } as unknown as Producer);
  await Promise.resolve();
  expect(logVoice).toHaveBeenCalledWith('Screen audio outbound statistics', {
    producerId: 'producer',
    bytesSent: 100,
    bytesSinceLastReport: 100,
    packetsSent: 5
  });
  expect(logVoice).toHaveBeenCalledWith('Screen audio source statistics', {
    producerId: 'producer',
    audioLevel: 0.5,
    totalAudioEnergy: 1,
    totalSamplesDuration: 2
  });
  observer.emit('close');
  expect(clearInterval).toHaveBeenCalledWith(1);
  logVoice.mockClear();
  track.dispatchEvent(new Event('mute'));
  poll();
  expect(logVoice).not.toHaveBeenCalled();
  expect(getStats).toHaveBeenCalledTimes(1);
});

test('logs statistics failures without leaving an unhandled rejection', async () => {
  globalThis.window = {
    setInterval: () => 1,
    clearInterval: () => undefined
  } as unknown as Window & typeof globalThis;
  const observer = new EventEmitter();
  const error = new Error('transport unavailable');
  const track = Object.assign(new EventTarget(), {
    getSettings: () => ({})
  });
  monitorScreenAudio({
    id: 'producer',
    track,
    observer,
    getStats: async () => {
      throw error;
    }
  } as unknown as Producer);
  await Promise.resolve();
  expect(logVoice).toHaveBeenCalledWith('Screen audio statistics failed', {
    error
  });
  observer.emit('close');
});

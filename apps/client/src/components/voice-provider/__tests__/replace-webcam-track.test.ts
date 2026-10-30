import type { TDeviceSettings } from '@/types';
import { afterEach, expect, mock, test } from 'bun:test';
import type { Producer } from 'mediasoup-client/types';
import { replaceWebcamTrack } from '../replace-webcam-track';

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator'
);
afterEach(() => {
  if (originalNavigator)
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
});

const devices = {
  webcamId: 'replacement-camera',
  webcamFramerate: 30
} as TDeviceSettings;

const setup = (replaceTrack = mock(async (_options: unknown) => undefined)) => {
  const track = {
    stop: mock(() => undefined),
    onended: null
  } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track]
  } as unknown as MediaStream;
  const getUserMedia = mock(async () => stream);
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } }
  });
  const producer = { replaceTrack } as unknown as Producer;
  return { track, stream, getUserMedia, producer, replaceTrack };
};

test('camera replacement captures the selected device and keeps its track', async () => {
  const { track, stream, getUserMedia, producer, replaceTrack } = setup();
  const replacement = await replaceWebcamTrack(devices, producer, () => true);
  expect(replacement.stream).toBe(stream);
  expect(replacement.track).toBe(track);
  expect(getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      video: expect.objectContaining({
        deviceId: { exact: 'replacement-camera' },
        frameRate: 30
      }),
      audio: false
    })
  );
  expect(replaceTrack).toHaveBeenCalledWith({ track });
  expect(track.stop).not.toHaveBeenCalled();
});

test('failed camera replacement releases the new track', async () => {
  const replaceTrack = mock(async (_options: unknown) => {
    throw new Error('replacement failed');
  });
  const { track, producer } = setup(replaceTrack);
  await expect(
    replaceWebcamTrack(devices, producer, () => true)
  ).rejects.toThrow('replacement failed');
  expect(track.stop).toHaveBeenCalledTimes(1);
});

test('camera replacement does not publish after the voice session changes', async () => {
  const { track, producer, replaceTrack } = setup();
  await expect(
    replaceWebcamTrack(devices, producer, () => false)
  ).rejects.toThrow('Voice session changed.');
  expect(replaceTrack).not.toHaveBeenCalled();
  expect(track.stop).toHaveBeenCalledTimes(1);
});

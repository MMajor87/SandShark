import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let disconnected = true;
let failStart = false;
const state = {
  micMuted: false,
  soundMuted: false,
  webcamEnabled: false,
  sharingScreen: false,
  serverMuted: false
};
const mutate = mock(async (_state: unknown) => undefined);
const stopWebcamStream = mock(() => undefined);
const stopScreenShareStream = mock(() => undefined);
const updateOwnVoiceState = mock((_update: unknown) => undefined);
mock.module('@/features/app/hooks', () => ({
  usePushToTalkActive: () => false
}));
mock.module('@/features/server/channels/hooks', () => ({
  useCurrentVoiceChannelId: () => 2
}));
mock.module('@/features/server/voice/hooks', () => ({
  useOwnVoiceState: () => state
}));
mock.module('@/features/server/voice/actions', () => ({ updateOwnVoiceState }));
mock.module('@/helpers/sounds', () => ({ playSound: () => undefined }));
mock.module('@/lib/trpc', () => ({
  getTRPCClient: () => {
    if (disconnected) throw new Error('TRPC client is not initialized');
    return { voice: { updateState: { mutate } } };
  }
}));
mock.module('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));
mock.module('sonner', () => ({ toast: { error: () => undefined } }));
const { useVoiceControls } = await import('../hooks/use-voice-controls');

const renderControls = () => {
  let controls: ReturnType<typeof useVoiceControls> | undefined;
  const Harness = () => {
    controls = useVoiceControls({
      startMicStream: async () => undefined,
      localAudioStream: undefined,
      startWebcamStream: async () => {
        if (failStart) throw new Error('capture failed');
      },
      stopWebcamStream,
      startScreenShareStream: async () => {
        throw new Error('capture failed');
      },
      stopScreenShareStream
    });
    return null;
  };
  renderToStaticMarkup(createElement(Harness));
  return controls!;
};

const originalWindow = globalThis.window;
afterEach(() => {
  globalThis.window = originalWindow;
});

beforeEach(() => {
  globalThis.window = {} as Window & typeof globalThis;
  disconnected = true;
  failStart = false;
  mutate.mockClear();
  stopWebcamStream.mockClear();
  stopScreenShareStream.mockClear();
  updateOwnVoiceState.mockClear();
});

for (const action of [
  'toggleMic',
  'toggleSound',
  'toggleWebcam',
  'toggleScreenShare'
] as const) {
  test(`${action} releases its busy flag when the client is disconnected`, async () => {
    const controls = renderControls();
    await controls[action]();
    disconnected = false;
    await controls[action]();
    expect(mutate).toHaveBeenCalled();
  });
}

test('failed camera and screen startup releases capture resources', async () => {
  disconnected = false;
  failStart = true;
  const controls = renderControls();
  await controls.toggleWebcam();
  await controls.toggleScreenShare();
  expect(stopWebcamStream).toHaveBeenCalledTimes(1);
  expect(stopScreenShareStream).toHaveBeenCalledTimes(1);
  expect(mutate).toHaveBeenCalledWith({ webcamEnabled: false });
  expect(mutate).toHaveBeenCalledWith({ sharingScreen: false });
});

// server rendering exercises callbacks and refs; actual device release on server-state
// updates still needs the browser/capture smoke checks, since effects do not run here.

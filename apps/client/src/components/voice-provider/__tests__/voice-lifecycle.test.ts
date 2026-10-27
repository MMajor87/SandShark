import { StreamKind } from '@sharkord/shared';
import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import type { Device } from 'mediasoup-client/types';
import { EventEmitter } from 'node:events';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let disconnected = true;
let failStart = false;
let sessionCurrent = true;
let pendingCamera: Promise<void> | undefined;
const clearLocalVoiceSession = mock(() => undefined);
const state = {
  micMuted: false,
  soundMuted: false,
  webcamEnabled: false,
  sharingScreen: false,
  serverMuted: false
};
const mutate = mock(async (_state: unknown) => undefined);
const transportParams = { id: 'transport', iceCandidates: [] };
const createTransport = mock(async () => transportParams);
const client = {
  voice: {
    consume: {
      mutate: async () => ({
        producerId: 'remote',
        consumerId: 'consumer',
        consumerKind: StreamKind.AUDIO,
        consumerRtpParameters: { codecs: [] },
        consumerType: 'simple',
        qualityLayers: []
      })
    },
    updateState: { mutate },
    createProducerTransport: { mutate: createTransport },
    createConsumerTransport: { mutate: createTransport }
  }
};
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
mock.module('@/features/server/voice/actions', () => ({
  updateOwnVoiceState,
  clearLocalVoiceSession
}));
mock.module('@/features/server/hooks', () => ({
  useIsConnected: () => !disconnected
}));
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
mock.module('../voice-session', () => ({
  captureVoiceSession: () => {
    if (disconnected) throw new Error('TRPC client is not initialized');
    return {
      client,
      channelId: 2,
      isCurrent: () => sessionCurrent
    };
  }
}));
const { useVoiceControls } = await import('../hooks/use-voice-controls');

const renderControls = () => {
  let controls: ReturnType<typeof useVoiceControls> | undefined;
  const Harness = () => {
    controls = useVoiceControls({
      startMicStream: async () => undefined,
      localAudioStream: undefined,
      startWebcamStream: async () => {
        if (pendingCamera) await pendingCamera;
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
  sessionCurrent = true;
  pendingCamera = undefined;
  clearLocalVoiceSession.mockClear();
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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
for (const fails of [false, true]) {
  test(`late camera ${fails ? 'failure' : 'success'} cannot change a replacement session`, async () => {
    disconnected = false;
    const pending = deferred<void>();
    pendingCamera = pending.promise;
    failStart = fails;
    const result = renderControls().toggleWebcam();
    updateOwnVoiceState.mockClear();
    sessionCurrent = false;
    pending.resolve();
    await result;
    expect(mutate).not.toHaveBeenCalled();
    expect(stopWebcamStream).not.toHaveBeenCalled();
    expect(updateOwnVoiceState).not.toHaveBeenCalled();
  });
}
const loadDevice = mock(async (_options: unknown): Promise<void> => {});
mock.module('mediasoup-client', () => ({
  Device: class {
    rtpCapabilities = {};
    load = loadDevice;
  }
}));
const { useVoiceSession } = await import('../hooks/use-voice-session');
const renderSession = () => {
  const callbacks = {
    currentVoiceChannelId: 2,
    routerRtpCapabilities: { current: null },
    deviceRtpCapabilities: { current: null },
    transportRecoveryRef: { current: () => {} },
    producerTransport: { current: undefined },
    consumerTransport: { current: undefined },
    createProducerTransport: mock(async (_device: Device) => undefined),
    createConsumerTransport: mock(async (_device: Device) => undefined),
    consumeExistingProducers: mock(async () => undefined),
    cleanupTransports: mock(() => undefined),
    startMonitoring: mock(() => undefined),
    stopMonitoring: mock(() => undefined),
    resetStats: mock(() => undefined),
    startMicStream: mock(async () => undefined),
    cleanupMicProcessingResources: mock(() => undefined),
    stopWebcamStream: mock(() => undefined),
    stopScreenShareStream: mock(() => undefined),
    clearLocalStreams: mock(() => undefined),
    clearRemoteUserStreams: mock(() => undefined),
    clearExternalStreams: mock(() => undefined)
  };
  let session!: ReturnType<typeof useVoiceSession>;
  const Harness = () => {
    session = useVoiceSession(callbacks);
    return null;
  };
  renderToStaticMarkup(createElement(Harness));
  return { session, callbacks };
};
test('transport recovery rebuilds microphone and receivers and only resets camera/screen preferences', async () => {
  disconnected = false;
  const { session, callbacks } = renderSession();
  await session.init({}, 2);
  await session.recover();
  expect(callbacks.createProducerTransport).toHaveBeenCalledTimes(2);
  expect(callbacks.createConsumerTransport).toHaveBeenCalledTimes(2);
  expect(callbacks.startMicStream).toHaveBeenCalledTimes(2);
  expect(callbacks.startMonitoring).toHaveBeenCalledTimes(2);
  expect(mutate.mock.calls).toEqual([
    [{ webcamEnabled: false, sharingScreen: false }]
  ]);
  expect(updateOwnVoiceState.mock.calls).toEqual([
    [{ webcamEnabled: false, sharingScreen: false }]
  ]);
  expect(clearLocalVoiceSession).not.toHaveBeenCalled();
  session.cleanup();
  session.cleanup();
  await session.recover();
  expect(callbacks.createProducerTransport).toHaveBeenCalledTimes(2);
});
for (const reason of [
  'User is not in a voice channel',
  'Missing channel permission',
  'User banned'
]) {
  test(`stale transports cannot rejoin after recovery rejection: ${reason}`, async () => {
    disconnected = false;
    const { session, callbacks } = renderSession();
    await session.init({}, 2);
    mutate.mockImplementationOnce(async () => {
      throw new Error(reason);
    });
    await session.recover();
    await session.recover();
    expect(clearLocalVoiceSession).toHaveBeenCalledTimes(1);
    expect(callbacks.createProducerTransport).toHaveBeenCalledTimes(1);
    expect(callbacks.startMicStream).toHaveBeenCalledTimes(1);
    expect(callbacks.stopScreenShareStream).toHaveBeenCalledTimes(3);
    expect(mutate).toHaveBeenCalledTimes(1);
  });
}
test('lost WebSocket membership with surviving transports cannot initiate recovery or join', async () => {
  disconnected = false;
  const { session, callbacks } = renderSession();
  await session.init({}, 2);
  sessionCurrent = false;
  await session.recover();
  expect(mutate).not.toHaveBeenCalled();
  expect(callbacks.createProducerTransport).toHaveBeenCalledTimes(1);
  session.cleanup();
  expect(callbacks.cleanupTransports).toHaveBeenCalledTimes(2);
});
test('late device loading after leave cannot recreate transports or start microphone', async () => {
  disconnected = false;
  const pending = deferred<void>();
  loadDevice.mockImplementationOnce(() => pending.promise);
  const { session, callbacks } = renderSession();
  const result = session.init({}, 2);
  session.cleanup();
  pending.resolve();
  await result;
  expect(callbacks.createProducerTransport).not.toHaveBeenCalled();
  expect(callbacks.startMicStream).not.toHaveBeenCalled();
  expect(callbacks.startMonitoring).not.toHaveBeenCalled();
});
test('partial transport startup failure tears down and clears local membership', async () => {
  disconnected = false;
  const { session, callbacks } = renderSession();
  callbacks.createConsumerTransport.mockImplementationOnce(async () => {
    throw new Error('transport failed');
  });
  await expect(session.init({}, 2)).rejects.toThrow('transport failed');
  expect(callbacks.cleanupTransports).toHaveBeenCalledTimes(2);
  expect(callbacks.startMicStream).not.toHaveBeenCalled();
  expect(clearLocalVoiceSession).toHaveBeenCalledTimes(1);
  expect(callbacks.routerRtpCapabilities.current).toBeNull();
});
const { useTransports } = await import('../hooks/use-transports');
const renderTransports = () => {
  let transports!: ReturnType<typeof useTransports>;
  const noop = () => {};
  const Harness = () => {
    transports = useTransports({
      onTransportFailed: noop,
      addRemoteUserStream: noop,
      removeRemoteUserStream: noop,
      addExternalStreamTrack: noop,
      removeExternalStreamTrack: noop,
      setRemoteConsumerType: noop,
      setRemoteStreamQualityLayers: noop,
      clearRemoteConsumerMetadata: noop
    });
    return null;
  };
  renderToStaticMarkup(createElement(Harness));
  return transports;
};
const fakeTransport = () =>
  Object.assign(new EventEmitter(), {
    closed: false,
    close: mock(() => undefined)
  });
test('late transport response after cleanup cannot install a transport', async () => {
  disconnected = false;
  const pending = deferred<typeof transportParams>();
  createTransport.mockImplementationOnce(() => pending.promise);
  const transports = renderTransports();
  const createSendTransport = mock(() => fakeTransport());
  const result = transports.createProducerTransport({
    createSendTransport
  } as unknown as Device);
  transports.cleanupTransports();
  pending.resolve(transportParams);
  await expect(result).rejects.toThrow('Voice session changed.');
  expect(createSendTransport).not.toHaveBeenCalled();
  expect(transports.producerTransport.current).toBeUndefined();
});
test('old transport close events cannot clear the replacement transport', async () => {
  disconnected = false;
  const transports = renderTransports();
  const old = fakeTransport();
  const current = fakeTransport();
  const createSendTransport = mock(() => current).mockImplementationOnce(
    () => old
  );
  const device = { createSendTransport } as unknown as Device;
  await transports.createProducerTransport(device);
  transports.cleanupTransports();
  await transports.createProducerTransport(device);
  old.emit('connectionstatechange', 'closed');
  expect(transports.producerTransport.current).toBe(
    current as unknown as ReturnType<
      typeof useTransports
    >['producerTransport']['current']
  );
  transports.cleanupTransports();
});

mock.module('@/helpers/audio-worklet/ns-worklet', () => ({
  createNsChain: async () => {
    throw new Error('not enabled');
  }
}));
mock.module('@/helpers/audio-worklet/noise-gate-worklet', () => ({
  getNoiseGateWorkletAvailabilitySnapshot: () => ({ available: false }),
  createNoiseGateWorkletNode: async () => {
    throw new Error('not enabled');
  },
  markNoiseGateWorkletUnavailable: () => {},
  postNoiseGateWorkletConfig: () => {}
}));
const { useMicrophone } = await import('../hooks/use-microphone');
const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator'
);
afterEach(() => {
  if (originalNavigator)
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
});
const renderMicrophone = (
  getUserMedia: () => Promise<MediaStream>,
  muted = false
) => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } }
  });
  const producer = {
    id: 'microphone',
    close: mock(() => undefined),
    observer: new EventEmitter()
  };
  const produce = mock(async (_options: unknown) => producer);
  const localAudioProducer = { current: undefined };
  const setLocalAudioStream = mock(
    (
      _stream: Parameters<
        Parameters<typeof useMicrophone>[0]['setLocalAudioStream']
      >[0]
    ) => {}
  );
  let microphone!: ReturnType<typeof useMicrophone>;
  const Harness = () => {
    microphone = useMicrophone({
      devices: {
        microphoneId: 'selected-mic',
        noiseGateEnabled: false
      } as Parameters<typeof useMicrophone>[0]['devices'],
      ownVoiceState: { ...state, micMuted: muted },
      producerTransport: {
        current: { closed: false, produce } as unknown as Parameters<
          typeof useMicrophone
        >[0]['producerTransport']['current']
      },
      localAudioProducer,
      setLocalAudioStream,
      pushToTalkActive: false,
      pushToTalkRegistered: false,
      pushToTalkSettings: { mode: 'talk' } as Parameters<
        typeof useMicrophone
      >[0]['pushToTalkSettings']
    });
    return null;
  };
  renderToStaticMarkup(createElement(Harness));
  return {
    microphone,
    produce,
    producer,
    localAudioProducer,
    setLocalAudioStream
  };
};
const fakeMicrophone = () => {
  const track = {
    id: 'mic',
    enabled: true,
    onended: null,
    getSettings: () => ({}),
    stop: mock(() => undefined)
  };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track]
  } as unknown as MediaStream;
  return { track, stream };
};
test('microphone permission resolving after leave releases its track without producing', async () => {
  disconnected = false;
  const pending = deferred<MediaStream>();
  const { microphone, produce, setLocalAudioStream } = renderMicrophone(
    () => pending.promise
  );
  const { track, stream } = fakeMicrophone();
  const result = microphone.startMicStream();
  microphone.cleanupMicProcessingResources();
  pending.resolve(stream);
  await expect(result).rejects.toThrow('Voice operation was cancelled.');
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(produce).not.toHaveBeenCalled();
  expect(setLocalAudioStream).not.toHaveBeenCalled();
});
test('late microphone producer after cleanup is closed and never installed', async () => {
  disconnected = false;
  const { stream } = fakeMicrophone();
  const { microphone, produce, producer, localAudioProducer } =
    renderMicrophone(async () => stream);
  const pending = deferred<typeof producer>();
  produce.mockImplementationOnce(() => pending.promise);
  const result = microphone.startMicStream();
  await Promise.resolve();
  await Promise.resolve();
  expect(produce).toHaveBeenCalledTimes(1);
  microphone.cleanupMicProcessingResources();
  pending.resolve(producer);
  await expect(result).rejects.toThrow('Voice operation was cancelled.');
  expect(producer.close).toHaveBeenCalledTimes(1);
  expect(localAudioProducer.current).toBeUndefined();
});
test('microphone rebuild preserves the selected device and mute while cleanup is repeatable', async () => {
  disconnected = false;
  const { stream, track } = fakeMicrophone();
  const getUserMedia = mock(async () => stream);
  const { microphone, producer } = renderMicrophone(getUserMedia, true);
  await microphone.startMicStream();
  expect(getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ deviceId: { exact: 'selected-mic' } })
    })
  );
  expect(track.enabled).toBe(false);
  microphone.cleanupMicProcessingResources();
  microphone.cleanupMicProcessingResources();
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(producer.close).toHaveBeenCalledTimes(1);
});
test('failed microphone producer releases acquired capture resources', async () => {
  disconnected = false;
  const { stream, track } = fakeMicrophone();
  const { microphone, produce, setLocalAudioStream } = renderMicrophone(
    async () => stream
  );
  produce.mockImplementationOnce(async () => {
    throw new Error('producer failed');
  });
  await microphone.startMicStream();
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(setLocalAudioStream).toHaveBeenLastCalledWith(undefined);
});

mock.module('@/audio-worklets/process-audio-capture-processor.js?url', () => ({
  default: 'processor.js'
}));
mock.module('../hooks/use-desktop-capture-picker', () => ({
  useDesktopCapturePicker: () => ({
    chooseDesktopCaptureSource: async () => undefined,
    picker: null,
    cancel: () => {}
  })
}));
const { useScreenCapture } = await import('../hooks/use-screen-capture');
for (const cancelByLeave of [true, false]) {
  test(`screen picker completion after ${cancelByLeave ? 'leave' : 'server switch'} releases capture without publishing`, async () => {
    disconnected = false;
    globalThis.window = {
      location: { protocol: 'https:', search: '' }
    } as unknown as Window & typeof globalThis;
    const pending = deferred<MediaStream>();
    const requested = deferred<void>();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getSupportedConstraints: () => ({}),
          getDisplayMedia: () => {
            requested.resolve();
            return pending.promise;
          }
        }
      }
    });
    const { stream, track } = fakeMicrophone();
    const produce = mock(async () => undefined);
    const setLocalScreenShare = mock(() => undefined);
    let capture!: ReturnType<typeof useScreenCapture>;
    const Harness = () => {
      capture = useScreenCapture({
        localScreenShareStream: undefined,
        localScreenShareProducer: { current: undefined },
        localScreenShareAudioProducer: { current: undefined },
        setLocalScreenShare,
        setLocalScreenShareAudio: () => {},
        devices: {} as Parameters<typeof useScreenCapture>[0]['devices'],
        producerTransport: {
          current: { closed: false, produce } as unknown as Parameters<
            typeof useScreenCapture
          >[0]['producerTransport']['current']
        },
        routerRtpCapabilities: { current: null },
        simulcastEnabled: false,
        setScreenShareProducer: () => {}
      });
      return null;
    };
    renderToStaticMarkup(createElement(Harness));
    const result = capture.startScreenShareStream();
    await requested.promise;
    if (cancelByLeave) capture.stopScreenShareStream();
    else sessionCurrent = false;
    setLocalScreenShare.mockClear();
    pending.resolve(stream);
    await expect(result).rejects.toThrow('Voice operation was cancelled.');
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(produce).not.toHaveBeenCalled();
    expect(setLocalScreenShare).not.toHaveBeenCalled();
  });
}

test('a receiver created after transport cleanup is closed without restoring remote streams', async () => {
  disconnected = false;
  const transports = renderTransports();
  const consumer = Object.assign(new EventEmitter(), {
    id: 'consumer',
    close: mock(() => undefined),
    rtpParameters: { codecs: [] }
  });
  const pending = deferred<typeof consumer>();
  const requested = deferred<void>();
  transports.consumerTransport.current = {
    closed: false,
    close: () => {},
    consume: () => {
      requested.resolve();
      return pending.promise;
    }
  } as unknown as NonNullable<typeof transports.consumerTransport.current>;
  const result = transports.consume(2, StreamKind.AUDIO, {});
  await requested.promise;
  transports.cleanupTransports();
  pending.resolve(consumer);
  await result;
  expect(consumer.close).toHaveBeenCalledTimes(1);
  expect(transports.consumers.current).toEqual({});
  expect(transports.getConsumerCodec(2, StreamKind.AUDIO)).toBeUndefined();
});

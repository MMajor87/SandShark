import { expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { createApplicationAudio } from './application-audio.js';

const setup = () => {
  const children: ReturnType<typeof child>[] = [];
  const spawnProcess = mock(() => {
    const process = child();
    children.push(process);
    return process;
  });
  const sender = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    send: mock(() => {})
  });
  const audio = createApplicationAudio({
    getExecutablePath: () => process.execPath,
    writeDesktopCaptureDiagnostic: () => {},
    spawnProcess: spawnProcess as unknown as NonNullable<
      Parameters<typeof createApplicationAudio>[0]['spawnProcess']
    >,
    platform: 'win32'
  });
  return {
    audio,
    children,
    sender,
    spawnProcess,
    start: (source = 'window:1') =>
      audio.startApplicationAudioCapture(
        source,
        sender as unknown as Electron.WebContents
      )
  };
};
const child = () =>
  Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    killed: false,
    kill() {
      this.killed = true;
      return true;
    }
  });
const header = Buffer.from(
  'SANDSHARK_PROCESS_AUDIO {"sampleRate":48000,"channels":2,"format":"f32"}\n'
);

test('stopping during startup settles the request and a late ready header cannot resurrect capture', async () => {
  const { audio, children, sender, start } = setup();
  const pending = start();
  audio.stopApplicationAudioCapture();
  expect((await pending).active).toBe(false);
  children[0].stdout.emit('data', header);
  expect(children[0].killed).toBe(true);
  expect(children[0].stdout.listenerCount('data')).toBe(0);
  expect(sender.listenerCount('destroyed')).toBe(0);
  expect(audio.isCapturingSource('window:1')).toBe(false);
});

test('replacement cancels the old startup and renderer destruction stops the active helper', async () => {
  const { audio, children, sender, start } = setup();
  const first = start();
  const second = start('screen:0');
  expect((await first).active).toBe(false);
  children[1].stdout.emit('data', Buffer.concat([header, Buffer.from([1, 2])]));
  expect((await second).active).toBe(true);
  expect(sender.send).toHaveBeenCalledTimes(1);
  sender.emit('destroyed');
  expect(children.every((process) => process.killed)).toBe(true);
  expect(audio.isCapturingSource('screen:0')).toBe(false);
  children[1].stdout.emit('data', Buffer.from([3]));
  expect(sender.send).toHaveBeenCalledTimes(1);
  audio.stopApplicationAudioCapture();
});

test('invalid headers, process errors and early exit settle startup and clean up', async () => {
  for (const failure of ['header', 'error', 'exit']) {
    const { children, sender, start } = setup();
    const pending = start();
    if (failure === 'header')
      children[0].stdout.emit('data', Buffer.from('invalid\n'));
    if (failure === 'error') children[0].emit('error', new Error('failed'));
    if (failure === 'exit') children[0].emit('exit', 1);
    expect((await pending).active).toBe(false);
    expect(children[0].stdout.listenerCount('data')).toBe(0);
    expect(sender.listenerCount('destroyed')).toBe(0);
  }
});

test('late cleanup for an old capture cannot stop its replacement', async () => {
  const { audio, children, start } = setup();
  const first = start();
  children[0].stdout.emit('data', header);
  const old = await first;
  const second = start('screen:0');
  children[1].stdout.emit('data', header);
  const current = await second;
  audio.stopApplicationAudioCapture(old.captureId);
  expect(children[1].killed).toBe(false);
  expect(audio.isCapturingSource('screen:0')).toBe(true);
  audio.stopApplicationAudioCapture(current.captureId);
  audio.stopApplicationAudioCapture(current.captureId);
  expect(children[1].killed).toBe(true);
});

test('window capture asks the helper to refuse windows owned by SandShark', async () => {
  const { audio, spawnProcess, start } = setup();
  start('window:42:0');
  expect(spawnProcess).toHaveBeenCalledWith(
    process.execPath,
    ['window:42:0', '--owner-process', String(process.pid)],
    expect.anything()
  );
  start('screen:0');
  expect(spawnProcess).toHaveBeenLastCalledWith(
    process.execPath,
    ['--exclude-process', String(process.pid)],
    expect.anything()
  );
  audio.stopApplicationAudioCapture();
});

test('an unexpected helper exit tells the renderer, a requested stop does not', async () => {
  const { audio, children, sender, start } = setup();
  const pending = start('screen:0');
  children[0].stdout.emit('data', header);
  const capture = await pending;
  children[0].emit('exit', 1);
  expect(sender.send).toHaveBeenCalledWith(
    'sandshark:application-audio-ended',
    capture.captureId
  );
  sender.send.mockClear();
  const next = start('screen:0');
  children[1].stdout.emit('data', header);
  await next;
  audio.stopApplicationAudioCapture();
  children[1].emit('exit', null);
  expect(sender.send).not.toHaveBeenCalled();
});

test('reports whether the audio service sits inside the captured process tree', async () => {
  const diagnostics: Record<string, unknown>[] = [];
  const children: ReturnType<typeof child>[] = [];
  const audio = createApplicationAudio({
    getExecutablePath: () => process.execPath,
    writeDesktopCaptureDiagnostic: (stage, details) => {
      if (stage === 'application-audio-started')
        diagnostics.push(details ?? {});
    },
    getAudioServiceProcessId: () => 30,
    spawnProcess: (() => {
      const process = child();
      children.push(process);
      return process;
    }) as unknown as NonNullable<
      Parameters<typeof createApplicationAudio>[0]['spawnProcess']
    >,
    platform: 'win32'
  });
  const pending = audio.startApplicationAudioCapture(
    'screen:0',
    Object.assign(new EventEmitter(), {
      isDestroyed: () => false,
      send: () => {}
    }) as unknown as Electron.WebContents
  );
  children[0].stdout.emit(
    'data',
    Buffer.from(
      'SANDSHARK_PROCESS_AUDIO {"sampleRate":48000,"channels":2,"format":"f32","targetProcessName":"SandShark.exe","treeProcessIds":[10,20,30]}\n'
    )
  );
  await pending;
  expect(diagnostics[0]).toMatchObject({
    mode: 'exclude-sandshark',
    targetProcessName: 'SandShark.exe',
    treeProcessCount: 3,
    audioServiceProcessId: 30,
    audioServiceInTree: true
  });
  audio.stopApplicationAudioCapture();
});

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

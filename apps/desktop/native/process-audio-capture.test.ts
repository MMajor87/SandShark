import { expect, test } from 'bun:test';
import { join } from 'node:path';

const executable = join(import.meta.dir, 'bin', 'ProcessAudioCapture.exe');

test('rejects a zero exclusion process instead of capturing all audio', async () => {
  const helper = Bun.spawn([executable, '--exclude-process', '0'], {
    stdout: 'pipe',
    stderr: 'pipe',
    windowsHide: true
  });
  expect(await helper.exited).toBe(1);
  expect(await new Response(helper.stderr).text()).toContain(
    'process ID must be positive'
  );
  expect(await new Response(helper.stdout).text()).toBe('');
});

test('rejects invalid capture arguments', async () => {
  const helper = Bun.spawn([executable, '--unknown', '123'], {
    stdout: 'pipe',
    stderr: 'pipe',
    windowsHide: true
  });
  expect(await helper.exited).toBe(2);
  expect(await new Response(helper.stdout).text()).toBe('');
});

// audible exclusion needs two playback processes and a real Windows audio device.
test('starts Windows capture with process exclusion and returns the PCM format', async () => {
  const helper = Bun.spawn(
    [executable, '--exclude-process', String(process.pid)],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      windowsHide: true
    }
  );
  const timeout = setTimeout(() => helper.kill(), 10_000);
  try {
    const reader = helper.stdout.getReader();
    let header = '';
    while (!header.includes('\n')) {
      const { value, done } = await reader.read();
      if (done) break;
      header += new TextDecoder().decode(value);
    }
    expect(header.split('\n')[0]).toStartWith('SANDSHARK_PROCESS_AUDIO ');
    const format = JSON.parse(
      header.split('\n')[0].slice('SANDSHARK_PROCESS_AUDIO '.length)
    );
    expect(format).toMatchObject({
      channels: 2,
      sampleRate: 44100,
      format: 's16'
    });
  } finally {
    clearTimeout(timeout);
    helper.kill();
    await helper.exited;
  }
}, 15_000);

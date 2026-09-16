import { expect, test } from 'bun:test';
import { join } from 'node:path';

const executable = join(import.meta.dir, 'bin', 'ProcessAudioCapture.exe');
const run = async (...args: string[]) => {
  const process = Bun.spawn([executable, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    windowsHide: true
  });
  const [code, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text()
  ]);
  return { code, stdout, stderr };
};

test('rejects invalid restoration requests', async () => {
  for (const args of [
    ['--restore-window'],
    ['--restore-window', 'screen:123:0', '1'],
    ['--restore-window', 'window:0:0', '1'],
    ['--restore-window', 'window:123:0', '0'],
    ['--restore-window', 'window:123:0', '1']
  ]) {
    const result = await run(...args);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr.length).toBeGreaterThan(0);
  }
});

// a real game and GPU are still needed to verify exclusive fullscreen video capture.
test('lists a minimized window and restores only its verified process', async () => {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.Text = 'SandShark capture test ${crypto.randomUUID()}'
$form.FormBorderStyle = 'None'
$form.WindowState = 'Minimized'
$form.Add_Shown({ [Console]::WriteLine($form.Handle.ToInt64()); [Console]::Out.Flush() })
[System.Windows.Forms.Application]::Run($form)
`;
  const fixture = Bun.spawn(
    [
      'powershell.exe',
      '-NoProfile',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64')
    ],
    { stdout: 'pipe', stderr: 'pipe', windowsHide: true }
  );
  const timeout = setTimeout(() => fixture.kill(), 15000);
  try {
    const reader = fixture.stdout.getReader();
    let output = '';
    while (!output.includes('\n')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('Test window did not open');
      output += new TextDecoder().decode(chunk.value);
    }
    const id = `window:${output.trim()}:0`;
    const listed = await run('--list-minimized-windows');
    expect(listed.code).toBe(0);
    const sources = JSON.parse(listed.stdout) as {
      id: string;
      processId: number;
    }[];
    const source = sources.find((candidate) => candidate.id === id);
    expect(source?.processId).toBe(fixture.pid);
    const wrongOwner = await run('--restore-window', id, String(process.pid));
    expect(wrongOwner.code).toBe(1);
    expect(wrongOwner.stderr).toContain('no longer available');
    const restored = await run('--restore-window', id, String(fixture.pid));
    expect(restored).toEqual({ code: 0, stdout: '', stderr: '' });
    const after = await run('--list-minimized-windows');
    expect(
      JSON.parse(after.stdout).some(
        (candidate: { id: string }) => candidate.id === id
      )
    ).toBe(false);
  } finally {
    clearTimeout(timeout);
    fixture.kill();
    await fixture.exited;
  }
}, 20000);

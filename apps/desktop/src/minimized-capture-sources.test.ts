import { expect, mock, test } from 'bun:test';
import { createMinimizedCaptureSources } from './minimized-capture-sources.js';

test('offers minimized windows without requiring thumbnails and restores the selected owner', async () => {
  const run = mock(async (_args: string[]) =>
    JSON.stringify([
      { id: 'window:123:0', name: 'RimWorld', processId: 456 },
      { id: 'window:789:0', name: 'Another game', processId: 987 }
    ])
  );
  const sources = createMinimizedCaptureSources('unused', run);
  expect(await sources.list()).toEqual([
    { id: 'window:123:0', name: 'RimWorld', type: 'window' },
    { id: 'window:789:0', name: 'Another game', type: 'window' }
  ]);
  await sources.restore('window:123:0');
  expect(run.mock.calls).toEqual(
    [
      ['--list-minimized-windows'],
      ['--restore-window', 'window:123:0', '456']
    ].map((args) => [args])
  );
});

test('does not restore screens or windows that were not offered', async () => {
  const run = mock(async (_args: string[]) => '[]');
  const sources = createMinimizedCaptureSources('unused', run);
  await sources.list();
  await sources.restore('screen:123:0');
  await sources.restore('window:123:0');
  expect(run).toHaveBeenCalledTimes(1);
});

test('uses Electron source IDs for windows owned by the desktop process', async () => {
  const run = mock(async (_args: string[]) =>
    JSON.stringify([
      { id: 'window:123:0', name: 'SandShark', processId: process.pid }
    ])
  );
  const sources = createMinimizedCaptureSources('unused', run);
  expect(await sources.list()).toEqual([
    { id: 'window:123:1', name: 'SandShark', type: 'window' }
  ]);
  await sources.restore('window:123:1');
  expect(run).toHaveBeenLastCalledWith([
    '--restore-window',
    'window:123:0',
    String(process.pid)
  ]);
});

test('discards malformed native entries', async () => {
  const run = async () =>
    JSON.stringify([
      null,
      { id: 'screen:123:0', name: 'Screen', processId: 1 },
      { id: 'window:0:0', name: 'Invalid', processId: 1 },
      { id: 'window:123:0', name: '', processId: 1 },
      { id: 'window:123:0', name: 'Invalid', processId: 0 }
    ]);
  expect(await createMinimizedCaptureSources('unused', run).list()).toEqual([]);
});

test('clears old selections when refreshing fails', async () => {
  const run = mock(
    async (_args: string[]) =>
      '[{"id":"window:123:0","name":"Game","processId":456}]'
  );
  const sources = createMinimizedCaptureSources('unused', run);
  await sources.list();
  run.mockImplementation(async () => {
    throw new Error('Helper unavailable');
  });
  await expect(sources.list()).rejects.toThrow('Helper unavailable');
  await sources.restore('window:123:0');
  expect(run).toHaveBeenCalledTimes(2);
});

test('propagates restoration failure instead of granting a stale window', async () => {
  const sources = createMinimizedCaptureSources('unused', async (args) => {
    if (args[0] === '--restore-window') throw new Error('Window closed');
    return '[{"id":"window:123:0","name":"Game","processId":456}]';
  });
  await sources.list();
  await expect(sources.restore('window:123:0')).rejects.toThrow(
    'Window closed'
  );
});

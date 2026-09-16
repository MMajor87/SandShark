import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { TDesktopCaptureSource } from './desktop-api.js';

const execute = promisify(execFile);
type TMinimizedSource = { id: string; name: string; processId: number };

const createMinimizedCaptureSources = (
  executable: string,
  run = async (args: string[]) => {
    const { stdout } = await execute(executable, args, {
      windowsHide: true,
      timeout: 5000,
      maxBuffer: 1024 * 1024
    });
    return stdout;
  }
) => {
  const offeredWindows = new Map<string, number>();

  const list = async (): Promise<TDesktopCaptureSource[]> => {
    offeredWindows.clear();
    const result: unknown = JSON.parse(await run(['--list-minimized-windows']));
    if (!Array.isArray(result)) throw new Error('Invalid native window list.');
    const sources = result.filter(
      (value): value is TMinimizedSource =>
        value !== null &&
        typeof value === 'object' &&
        typeof value.id === 'string' &&
        /^window:[1-9]\d*:0$/.test(value.id) &&
        typeof value.name === 'string' &&
        value.name.length > 0 &&
        Number.isInteger(value.processId) &&
        value.processId > 0
    );
    return sources.map(({ id, name, processId }) => {
      // electron marks windows owned by its main process with a different suffix.
      const sourceId = processId === process.pid ? id.replace(/:0$/, ':1') : id;
      offeredWindows.set(sourceId, processId);
      return { id: sourceId, name, type: 'window' };
    });
  };

  const restore = async (sourceId: string) => {
    const processId = offeredWindows.get(sourceId);
    if (processId === undefined) return;
    await run([
      '--restore-window',
      sourceId.replace(/:1$/, ':0'),
      String(processId)
    ]);
  };

  return { list, restore };
};

export { createMinimizedCaptureSources };

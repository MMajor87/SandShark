import { describe, expect, test } from 'bun:test';
import { readProcessUsage } from '../process-usage';

describe('readProcessUsage', () => {
  test.skipIf(process.platform !== 'linux')(
    'reads the memory and cpu time of a running process',
    async () => {
      const usage = await readProcessUsage(process.pid);

      expect(usage?.memoryBytes).toBeGreaterThan(1024 * 1024);
      expect(usage?.cpuMs).toBeGreaterThan(0);
    }
  );

  test('reports nothing for a process that does not exist', async () => {
    // above the largest pid linux hands out
    expect(await readProcessUsage(2 ** 23)).toBeUndefined();
  });

  test.skipIf(process.platform === 'linux')(
    'reports nothing on platforms without /proc',
    async () => {
      expect(await readProcessUsage(process.pid)).toBeUndefined();
    }
  );
});

import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { DATA_PATH } from '../paths';
import { readLogTail } from '../read-log-tail';

const logPath = path.join(DATA_PATH, 'read-log-tail-test.log');

afterEach(async () => {
  await fs.rm(logPath, { force: true });
});

describe('readLogTail', () => {
  test('returns nothing for a log that does not exist yet', async () => {
    expect(await readLogTail(logPath)).toEqual([]);
  });

  test('returns every line of a short log', async () => {
    await fs.mkdir(DATA_PATH, { recursive: true });
    await fs.writeFile(logPath, 'first\r\nsecond\n\nthird\n');

    expect(await readLogTail(logPath)).toEqual(['first', 'second', 'third']);
  });

  test('keeps the newest lines of a long log and drops the one cut off', async () => {
    const lines = Array.from(
      { length: 5000 },
      (_, index) => `line ${index} ${'x'.repeat(40)}`
    );

    await fs.mkdir(DATA_PATH, { recursive: true });
    await fs.writeFile(logPath, `${lines.join('\n')}\n`);

    const tail = await readLogTail(logPath);

    expect(tail).toHaveLength(300);
    expect(tail.at(-1)).toBe(lines.at(-1));
    expect(tail[0]).toBe(lines[lines.length - 300]);
  });
});

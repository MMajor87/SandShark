import fs from 'fs/promises';

// enough for the last few hundred lines without reading a log that rotates at 10 MB
const TAIL_BYTES = 64 * 1024;
const MAX_LINES = 300;

// the last lines of a log file, newest last. the read starts mid file, so the first, cut off
// line is dropped unless the read began at the start of the file
const readLogTail = async (filePath: string): Promise<string[]> => {
  let handle: fs.FileHandle;

  try {
    handle = await fs.open(filePath, 'r');
  } catch {
    return [];
  }

  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);

    await handle.read(buffer, 0, buffer.length, start);

    const lines = buffer.toString('utf8').split(/\r?\n/);

    if (start > 0) lines.shift();

    return lines.filter(Boolean).slice(-MAX_LINES);
  } finally {
    await handle.close();
  }
};

export { readLogTail };

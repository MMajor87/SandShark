import { expect, spyOn, test } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { TMP_PATH } from '../../helpers/paths';
import { moveFile } from '../move-file';

test.skipIf(process.platform !== 'win32')(
  'retries a temporary windows lock and preserves the file contents',
  async () => {
    const src = path.join(TMP_PATH, 'retry-source.txt');
    const dest = path.join(TMP_PATH, 'retry-destination.txt');
    await fs.writeFile(src, 'preserved content');
    const rename = fs.rename.bind(fs);
    let attempts = 0;
    const mock = spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      attempts += 1;
      if (attempts < 3)
        throw Object.assign(new Error('locked'), { code: 'EPERM' });
      await rename(from, to);
    });
    try {
      await moveFile(src, dest);
      expect(attempts).toBe(3);
      expect(await fs.readFile(dest, 'utf8')).toBe('preserved content');
      expect(await fs.exists(src)).toBe(false);
    } finally {
      mock.mockRestore();
      await fs.rm(dest, { force: true });
      await fs.rm(src, { force: true });
    }
  }
);

test.skipIf(process.platform !== 'win32')(
  'stops retrying persistent locks and leaves the source intact',
  async () => {
    const src = path.join(TMP_PATH, 'locked-source.txt');
    await fs.writeFile(src, 'still here');
    const mock = spyOn(fs, 'rename').mockRejectedValue(
      Object.assign(new Error('locked'), { code: 'EPERM' })
    );
    try {
      await expect(moveFile(src, `${src}.dest`)).rejects.toThrow('locked');
      expect(mock).toHaveBeenCalledTimes(5);
      expect(await fs.readFile(src, 'utf8')).toBe('still here');
    } finally {
      mock.mockRestore();
      await fs.rm(src, { force: true });
    }
  }
);

test('does not retry unrelated filesystem failures', async () => {
  const mock = spyOn(fs, 'rename').mockRejectedValue(
    Object.assign(new Error('missing'), { code: 'ENOENT' })
  );
  try {
    await expect(moveFile('missing', 'destination')).rejects.toThrow('missing');
    expect(mock).toHaveBeenCalledTimes(1);
  } finally {
    mock.mockRestore();
  }
});

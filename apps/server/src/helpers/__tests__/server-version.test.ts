import { expect, spyOn, test } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { getCurrentVersion, patchServerVersion } from '../../../build/helpers';

test('reads and changes only the server package version', async () => {
  const packagePath = path.resolve(import.meta.dir, '../../../package.json');
  const read = spyOn(fs, 'readFile').mockResolvedValue(
    JSON.stringify({ name: '@sharkord/server', version: '0.0.28' })
  );
  const write = spyOn(fs, 'writeFile').mockResolvedValue();
  expect(await getCurrentVersion()).toBe('0.0.28');
  await patchServerVersion('0.1.0');
  expect(read).toHaveBeenCalledWith(packagePath, 'utf8');
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith(
    packagePath,
    `${JSON.stringify({ name: '@sharkord/server', version: '0.1.0' }, null, 2)}\n`,
    'utf8'
  );
});

test('rejects invalid versions before writing a package', async () => {
  const write = spyOn(fs, 'writeFile').mockResolvedValue();
  await expect(patchServerVersion('not-a-version')).rejects.toThrow(
    'Server version must be a valid semantic version.'
  );
  expect(write).not.toHaveBeenCalled();
});

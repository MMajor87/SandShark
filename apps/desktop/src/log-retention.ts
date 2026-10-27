import { existsSync, renameSync, rmSync, statSync } from 'node:fs';

const rotateLog = (path: string, maximumBytes = 5 * 1024 * 1024) => {
  if (!existsSync(path) || statSync(path).size < maximumBytes) return;
  rmSync(`${path}.2`, { force: true });
  if (existsSync(`${path}.1`)) renameSync(`${path}.1`, `${path}.2`);
  renameSync(path, `${path}.1`);
};

export { rotateLog };

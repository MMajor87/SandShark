import fs from 'fs/promises';
import path from 'path';
import { isPathInside } from './is-path-inside';

// a start script that only runs one file, the way most bots write it. the file is run
// directly rather than through the script, so the shim is preloaded into the bot itself
// and not into a shell or a node that is not there
const SINGLE_FILE_START =
  /^(?:node|bun|tsx|ts-node)(?:\s+--?[\w-]+)*\s+([^\s&|;<>]+)$/;

const DEFAULT_ENTRIES = ['index.js', 'index.ts'];

type TPackageJson = {
  main?: unknown;
  scripts?: { start?: unknown };
};

const readPackageJson = async (botPath: string) => {
  try {
    const raw = await fs.readFile(path.join(botPath, 'package.json'), 'utf8');

    return JSON.parse(raw) as TPackageJson;
  } catch {
    return undefined;
  }
};

const isFileInside = async (botPath: string, file: string) => {
  const resolved = path.resolve(botPath, file);

  if (!isPathInside(botPath, resolved)) return false;

  try {
    const stat = await fs.stat(resolved);

    return stat.isFile();
  } catch {
    return false;
  }
};

// the file `npm start` would end up running: the start script's file, then main, then an
// index at the root. undefined when the folder holds nothing to run
const resolveHostedBotEntry = async (botPath: string) => {
  const packageJson = await readPackageJson(botPath);
  const candidates: string[] = [];
  const start = packageJson?.scripts?.start;

  if (typeof start === 'string') {
    const match = SINGLE_FILE_START.exec(start.trim());

    if (match?.[1]) candidates.push(match[1]);
  }

  if (typeof packageJson?.main === 'string') {
    candidates.push(packageJson.main);
  }

  candidates.push(...DEFAULT_ENTRIES);

  for (const candidate of candidates) {
    if (await isFileInside(botPath, candidate)) {
      return path.resolve(botPath, candidate);
    }
  }

  return undefined;
};

export { resolveHostedBotEntry };

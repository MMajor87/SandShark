import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateLegacyDataPath } from '../migrate-legacy-data-path';

let root: string;
let legacyPath: string;
let dataPath: string;

const writeDatabase = (folder: string, content: string) => {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'db.sqlite'), content);
};

const readDatabase = (folder: string) =>
  fs.readFileSync(path.join(folder, 'db.sqlite'), 'utf8');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'sandshark-data-path-'));
  legacyPath = path.join(root, 'sharkord');
  dataPath = path.join(root, 'sandshark');
  spyOn(console, 'log').mockImplementation(() => {});
  spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('migrateLegacyDataPath', () => {
  test('uses the new folder when there is no legacy data', () => {
    expect(migrateLegacyDataPath(legacyPath, dataPath)).toBe(dataPath);
    expect(fs.existsSync(dataPath)).toBe(false);
  });

  test('moves the legacy folder to the new name', () => {
    writeDatabase(legacyPath, 'legacy');
    fs.mkdirSync(path.join(legacyPath, 'uploads'));

    expect(migrateLegacyDataPath(legacyPath, dataPath)).toBe(dataPath);
    expect(readDatabase(dataPath)).toBe('legacy');
    expect(fs.existsSync(path.join(dataPath, 'uploads'))).toBe(true);
    expect(fs.existsSync(legacyPath)).toBe(false);
  });

  test('replaces an empty new folder created before the server started', () => {
    writeDatabase(legacyPath, 'legacy');
    fs.mkdirSync(dataPath);

    expect(migrateLegacyDataPath(legacyPath, dataPath)).toBe(dataPath);
    expect(readDatabase(dataPath)).toBe('legacy');
  });

  test('leaves both folders alone once the new folder has a database', () => {
    writeDatabase(legacyPath, 'legacy');
    writeDatabase(dataPath, 'current');

    expect(migrateLegacyDataPath(legacyPath, dataPath)).toBe(dataPath);
    expect(readDatabase(dataPath)).toBe('current');
    expect(readDatabase(legacyPath)).toBe('legacy');
  });

  test('keeps using the legacy folder when it cannot be moved', () => {
    writeDatabase(legacyPath, 'legacy');
    fs.mkdirSync(dataPath);
    fs.writeFileSync(path.join(dataPath, 'other-file'), 'keep me');

    expect(migrateLegacyDataPath(legacyPath, dataPath)).toBe(legacyPath);
    expect(readDatabase(legacyPath)).toBe('legacy');
    expect(fs.readFileSync(path.join(dataPath, 'other-file'), 'utf8')).toBe(
      'keep me'
    );
    expect(console.warn).toHaveBeenCalled();
  });
});

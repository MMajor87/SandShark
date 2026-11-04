import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { resolveHostedBotEntry } from '../hosted-bot-entry';

let botPath: string;

beforeEach(async () => {
  botPath = await fs.mkdtemp(path.join(os.tmpdir(), 'hosted-bot-'));
});

afterEach(async () => {
  await fs.rm(botPath, { recursive: true, force: true });
});

const write = async (files: Record<string, string>) => {
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(botPath, name);

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
  }
};

describe('resolveHostedBotEntry', () => {
  test('runs the file a single file start script names', async () => {
    await write({
      'package.json': JSON.stringify({
        main: 'other.js',
        scripts: { start: 'node --enable-source-maps src/bot.js' }
      }),
      'src/bot.js': '',
      'other.js': ''
    });

    expect(await resolveHostedBotEntry(botPath)).toBe(
      path.join(botPath, 'src', 'bot.js')
    );
  });

  test('falls back to main when the start script does more than run a file', async () => {
    await write({
      'package.json': JSON.stringify({
        main: 'dist/index.js',
        scripts: { start: 'npm run build && node dist/index.js' }
      }),
      'dist/index.js': ''
    });

    expect(await resolveHostedBotEntry(botPath)).toBe(
      path.join(botPath, 'dist', 'index.js')
    );
  });

  test('falls back to an index at the root, typescript included', async () => {
    await write({ 'index.ts': '' });

    expect(await resolveHostedBotEntry(botPath)).toBe(
      path.join(botPath, 'index.ts')
    );
  });

  test('never runs a file outside the bot folder', async () => {
    await write({
      'package.json': JSON.stringify({
        main: '../outside.js',
        scripts: { start: 'node ../outside.js' }
      })
    });
    await fs.writeFile(path.join(botPath, '..', 'outside.js'), '');

    try {
      expect(await resolveHostedBotEntry(botPath)).toBeUndefined();
    } finally {
      await fs.rm(path.join(botPath, '..', 'outside.js'), { force: true });
    }
  });

  test('finds nothing in a folder with nothing to run', async () => {
    await write({ 'package.json': '{ not json', 'README.md': '' });

    expect(await resolveHostedBotEntry(botPath)).toBeUndefined();
  });
});

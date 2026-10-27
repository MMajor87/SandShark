import { expect, test } from 'bun:test';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJsonAtomically } from './atomic-json.js';
import { sanitizeLogDetails } from './log-details.js';
import { rotateLog } from './log-retention.js';
import { createDesktopPreferences } from './preferences.js';

test('atomic writes preserve the previous file on serialization failure and remove temporary files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandshark-atomic-'));
  try {
    const path = join(directory, 'preferences.json');
    writeJsonAtomically(path, { enabled: true });
    expect(() => writeJsonAtomically(path, { invalid: 1n })).toThrow();
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ enabled: true });
    writeJsonAtomically(path, { enabled: false });
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ enabled: false });
    expect(readdirSync(directory)).toEqual(['preferences.json']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('log retention keeps two archives and redaction omits secrets and message contents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandshark-logs-'));
  try {
    const path = join(directory, 'app.log');
    for (const value of ['first', 'second', 'third']) {
      writeFileSync(path, value);
      rotateLog(path, 1);
    }
    expect(readFileSync(`${path}.1`, 'utf8')).toBe('third');
    expect(readFileSync(`${path}.2`, 'utf8')).toBe('second');
    expect(readdirSync(directory)).toHaveLength(2);
    expect(
      sanitizeLogDetails({
        accessToken: 'secret',
        message: 'private',
        count: 3,
        value: 'x'.repeat(2100)
      })
    ).toEqual({
      accessToken: '[redacted]',
      message: '[omitted]',
      count: 3,
      value: 'x'.repeat(2000)
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('preferences preserve unrelated settings and secrets require encryption', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandshark-preferences-'));
  let available = true;
  const runtime = {
    app: { getPath: () => directory },
    safeStorage: {
      isEncryptionAvailable: () => available,
      encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
      decryptString: (value: Buffer) =>
        value.toString().replace('encrypted:', '')
    }
  } as unknown as Parameters<typeof createDesktopPreferences>[0];
  try {
    const preferences = createDesktopPreferences(runtime);
    preferences.setUpdateSettings({
      automaticallyCheck: false,
      automaticallyDownload: false
    });
    expect(preferences.setHardwareAcceleration(false)).toEqual({
      enabled: false,
      restartRequired: true
    });
    const reloaded = createDesktopPreferences(runtime);
    expect(reloaded.getHardwareAccelerationSettings()).toEqual({
      enabled: false,
      restartRequired: false
    });
    expect(reloaded.getUpdateSettings().automaticallyCheck).toBe(false);
    expect(preferences.setDesktopSecret('token', 'value')).toBe(true);
    expect(reloaded.getDesktopSecret('token')).toBe('value');
    expect(
      readFileSync(join(directory, 'desktop-secrets.json'), 'utf8')
    ).not.toContain('value');
    available = false;
    expect(preferences.setDesktopSecret('token', 'new')).toBe(false);
    expect(preferences.getDesktopSecret('token')).toBeUndefined();
    available = true;
    preferences.removeDesktopSecret('token');
    expect(reloaded.getDesktopSecret('token')).toBeUndefined();
    writeFileSync(join(directory, 'desktop-preferences.json'), 'broken');
    expect(
      createDesktopPreferences(runtime).getHardwareAccelerationSettings()
        .enabled
    ).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

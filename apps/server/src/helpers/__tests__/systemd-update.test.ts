import type { TRelease, TReleaseMetadata } from 'bun-sfe-autoupdater';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { DATA_PATH } from '../paths';
import { installSystemdUpdate } from '../systemd-update';

type TTarget = TReleaseMetadata['artifacts'][number]['target'];

const binaryPath = path.join(DATA_PATH, 'systemd-update-test', 'sandshark');
const newBinary = new TextEncoder().encode('#!/bin/sh\necho new server\n');
const target = (
  process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64'
) as TTarget;
const downloadUrl = 'https://example.test/sandshark-linux';
const realExecPath = process.execPath;

const sha256 = (bytes: Uint8Array) => {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(bytes);

  return hasher.digest('hex');
};

const release: TRelease = {
  tag_name: 'sandshark-server-v99.0.0',
  published_at: '2026-11-05T00:00:00Z',
  assets: [
    {
      name: 'sandshark-linux',
      browser_download_url: downloadUrl,
      url: downloadUrl,
      size: newBinary.length,
      digest: ''
    }
  ]
};

const metadata: TReleaseMetadata = {
  version: '99.0.0',
  releaseDate: '2026-11-05T00:00:00Z',
  artifacts: [
    {
      name: 'sandshark-linux',
      target,
      size: newBinary.length,
      checksum: sha256(newBinary)
    }
  ]
};

// the swap targets the running binary, so the test points execPath at a stand in and puts the
// real one back, since every later test file shares this process
const useStandIn = async () => {
  await fs.mkdir(path.dirname(binaryPath), { recursive: true });
  await fs.writeFile(binaryPath, 'old server', { mode: 0o755 });

  process.execPath = binaryPath;
};

afterEach(async () => {
  process.execPath = realExecPath;

  await fs.rm(path.dirname(binaryPath), { recursive: true, force: true });
});

describe('installSystemdUpdate', () => {
  test('replaces the running binary with the verified download', async () => {
    await useStandIn();
    spyOn(globalThis, 'fetch').mockResolvedValue(new Response(newBinary));

    await installSystemdUpdate(release, metadata);

    expect(new Uint8Array(await fs.readFile(binaryPath))).toEqual(newBinary);
    expect(await fs.exists(`${binaryPath}.download`)).toBe(false);

    if (process.platform !== 'win32') {
      const { mode } = await fs.stat(binaryPath);

      expect(mode & 0o111).toBe(0o111);
    }
  });

  test('leaves the running binary alone when the download does not match', async () => {
    await useStandIn();
    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new TextEncoder().encode('tampered'))
    );

    await expect(installSystemdUpdate(release, metadata)).rejects.toThrow(
      'The download of server 99.0.0 does not match its checksum.'
    );
    expect(await fs.readFile(binaryPath, 'utf8')).toBe('old server');
  });
});

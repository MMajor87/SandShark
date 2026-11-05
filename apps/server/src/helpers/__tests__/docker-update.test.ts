import type { TRelease, TReleaseMetadata } from 'bun-sfe-autoupdater';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import fs from 'fs/promises';
import {
  DOCKER_UPDATE_BINARY_PATH,
  DOCKER_UPDATE_VERSION_PATH,
  installDockerUpdate
} from '../docker-update';
import { DOCKER_UPDATE_PATH } from '../paths';

const binary = new TextEncoder().encode('#!/bin/sh\necho new server\n');
type TTarget = TReleaseMetadata['artifacts'][number]['target'];

const target = (
  process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64'
) as TTarget;
const downloadUrl = 'https://example.test/sandshark-linux';

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
      size: binary.length,
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
      size: binary.length,
      checksum: sha256(binary)
    }
  ]
};

const serve = (body: Uint8Array, status = 200) =>
  spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status }));

const readInstalled = async () => {
  const [installed, version] = await Promise.all([
    fs.readFile(DOCKER_UPDATE_BINARY_PATH),
    fs.readFile(DOCKER_UPDATE_VERSION_PATH, 'utf8')
  ]);

  return { installed: new Uint8Array(installed), version };
};

// the folder lives in the shared test data directory, so it must not reach the next test
afterEach(async () => {
  await fs.rm(DOCKER_UPDATE_PATH, { recursive: true, force: true });
});

describe('installDockerUpdate', () => {
  test('installs the verified binary and records its version', async () => {
    const fetchSpy = serve(binary);

    await installDockerUpdate(release, metadata);

    expect(fetchSpy).toHaveBeenCalledWith(downloadUrl);
    expect(await readInstalled()).toEqual({
      installed: binary,
      version: '99.0.0'
    });

    if (process.platform !== 'win32') {
      const { mode } = await fs.stat(DOCKER_UPDATE_BINARY_PATH);

      expect(mode & 0o111).toBe(0o111);
    }
  });

  test('replaces an earlier update', async () => {
    serve(new TextEncoder().encode('old'));

    await installDockerUpdate(release, {
      ...metadata,
      version: '98.0.0',
      artifacts: [
        {
          ...metadata.artifacts[0]!,
          checksum: sha256(new TextEncoder().encode('old'))
        }
      ]
    });

    serve(binary);

    await installDockerUpdate(release, metadata);

    expect(await readInstalled()).toEqual({
      installed: binary,
      version: '99.0.0'
    });
  });

  test('rejects a download that does not match its checksum and keeps the earlier update', async () => {
    serve(binary);

    await installDockerUpdate(release, metadata);

    serve(new TextEncoder().encode('tampered'));

    await expect(
      installDockerUpdate(release, { ...metadata, version: '100.0.0' })
    ).rejects.toThrow(
      'The download of server 100.0.0 does not match its checksum.'
    );
    expect(await readInstalled()).toEqual({
      installed: binary,
      version: '99.0.0'
    });
  });

  test('rejects a failed download', async () => {
    serve(new Uint8Array(), 404);

    await expect(installDockerUpdate(release, metadata)).rejects.toThrow(
      'Downloading server 99.0.0 failed: 404'
    );
    expect(await fs.exists(DOCKER_UPDATE_VERSION_PATH)).toBe(false);
  });

  test('rejects a release without a binary for this architecture', async () => {
    const fetchSpy = serve(binary);

    await expect(
      installDockerUpdate(release, {
        ...metadata,
        artifacts: [
          { ...metadata.artifacts[0]!, target: 'windows-x64' as TTarget }
        ]
      })
    ).rejects.toThrow(`Server 99.0.0 has no ${target} binary.`);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

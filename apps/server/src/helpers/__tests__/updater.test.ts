import { afterEach, expect, test } from 'bun:test';
import { updater } from '../updater';

const latestReleaseUrl =
  'https://api.github.com/repos/MMajor87/SandShark/releases/latest';
const metadataUrl =
  'https://github.com/MMajor87/SandShark/releases/download/v99.0.0/release.json';
const realFetch = globalThis.fetch;
const target = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('checks SandShark and reads the server version from its release manifest', async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    requests.push(url);

    if (url === latestReleaseUrl) {
      return Response.json({
        tag_name: 'v99.0.0',
        assets: [
          {
            name: 'release.json',
            browser_download_url: metadataUrl,
            url: metadataUrl
          },
          { name: 'server-binary' }
        ]
      });
    }

    if (url === metadataUrl) {
      return Response.json({
        version: '99.0.0',
        releaseDate: '2026-09-16T00:00:00Z',
        artifacts: [
          { name: 'server-binary', target, size: 1, checksum: 'test-checksum' }
        ]
      });
    }

    throw new Error(`Unexpected update request: ${url}`);
  }) as typeof fetch;

  expect(await updater.getLatestVersion()).toBe('99.0.0');
  expect(requests).toEqual([latestReleaseUrl, metadataUrl]);
  expect(await updater.hasUpdates()).toBe(true);
});

test('does not treat a desktop-only release as a server update', async () => {
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    expect(String(input)).toBe(latestReleaseUrl);

    return Response.json({
      tag_name: 'sandshark-v1.0.30',
      assets: [{ name: 'latest.yml' }]
    });
  }) as typeof fetch;

  await expect(updater.getLatestVersion()).rejects.toThrow(
    'release.json artifact not found in the latest release.'
  );
});

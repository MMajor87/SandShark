import { BunUpdater } from 'bun-sfe-autoupdater';
import { afterEach, expect, test } from 'bun:test';
import { updater } from '../updater';

const releasesUrl =
  'https://api.github.com/repos/MMajor87/SandShark/releases?per_page=100&page=';
const metadataUrl =
  'https://github.com/MMajor87/SandShark/releases/download/sandshark-server-v99.0.0/release.json';
const realFetch = globalThis.fetch;
const target = `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
const serverRelease = {
  tag_name: 'sandshark-server-v99.0.0',
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'release.json',
      browser_download_url: metadataUrl,
      url: metadataUrl
    },
    { name: 'server-binary' }
  ]
};
const metadata = {
  version: '99.0.0',
  releaseDate: '2026-10-28T00:00:00Z',
  artifacts: [
    { name: 'server-binary', target, size: 1, checksum: 'test-checksum' }
  ]
};

const mockReleases = (releases: unknown[], manifest: unknown = metadata) => {
  const requests: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    requests.push(url);
    if (url === `${releasesUrl}1`) return Response.json(releases);
    if (url === metadataUrl) return Response.json(manifest);
    throw new Error(`Unexpected update request: ${url}`);
  }) as unknown as typeof fetch;
  return requests;
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('selects the stable server release behind desktop, draft and prerelease entries', async () => {
  const requests = mockReleases([
    { ...serverRelease, tag_name: 'sandshark-v100.0.0' },
    { ...serverRelease, draft: true },
    { ...serverRelease, prerelease: true },
    { ...serverRelease, tag_name: 'sandshark-server-v100.0.0-beta.1' },
    { ...serverRelease, tag_name: 'sandshark-server-vinvalid' },
    serverRelease
  ]);
  expect(await updater.getLatestVersion()).toBe('99.0.0');
  expect(requests).toEqual([`${releasesUrl}1`, metadataUrl]);
  expect(await updater.hasUpdates()).toBe(true);
});

test('searches another page when newer releases belong to the desktop', async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    requests.push(url);
    if (url === `${releasesUrl}1`) {
      return Response.json(
        Array.from({ length: 100 }, () => ({
          ...serverRelease,
          tag_name: 'sandshark-v1.1.2'
        }))
      );
    }
    if (url === `${releasesUrl}2`) return Response.json([serverRelease]);
    if (url === metadataUrl) return Response.json(metadata);
    throw new Error(`Unexpected update request: ${url}`);
  }) as unknown as typeof fetch;
  expect(await updater.getLatestVersion()).toBe('99.0.0');
  expect(requests).toEqual([`${releasesUrl}1`, `${releasesUrl}2`, metadataUrl]);
});

test('rejects a desktop-only release list instead of using desktop metadata', async () => {
  mockReleases([{ ...serverRelease, tag_name: 'sandshark-v1.1.2' }]);
  await expect(updater.getLatestVersion()).rejects.toThrow(
    'No stable release found'
  );
});

test('rejects missing server metadata', async () => {
  mockReleases([{ ...serverRelease, assets: [] }]);
  await expect(updater.getLatestVersion()).rejects.toThrow(
    'release.json artifact not found'
  );
});

test('rejects mismatched tag and manifest versions', async () => {
  mockReleases([serverRelease], { ...metadata, version: '98.0.0' });
  await expect(updater.getLatestVersion()).rejects.toThrow(
    'Release tag does not match'
  );
});

test('rejects invalid metadata', async () => {
  mockReleases([serverRelease], { version: '99.0.0' });
  await expect(updater.getLatestVersion()).rejects.toThrow();
});

test('does not offer updates without an asset for this architecture', async () => {
  mockReleases([{ ...serverRelease, assets: [serverRelease.assets[0]] }]);
  expect(await updater.hasUpdates()).toBe(false);
});

test('does not downgrade or reinstall the current version', async () => {
  const current = new BunUpdater({
    repoOwner: 'MMajor87',
    repoName: 'SandShark',
    releaseTagPrefix: 'sandshark-server-v',
    currentVersion: '99.0.0'
  });
  mockReleases([serverRelease]);
  expect(await current.hasUpdates()).toBe(false);
  await current.checkForUpdates();
});

test('reports GitHub failures instead of falling back to desktop latest', async () => {
  globalThis.fetch = (async () =>
    new Response(null, { status: 403 })) as unknown as typeof fetch;
  await expect(updater.getLatestVersion()).rejects.toThrow(
    'Error fetching releases: 403'
  );
});

test('rejects invalid release lists and bounds pagination', async () => {
  globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;
  await expect(updater.getLatestVersion()).rejects.toThrow(
    'Invalid GitHub releases response'
  );
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return Response.json(
      Array.from({ length: 100 }, () => ({
        ...serverRelease,
        tag_name: 'sandshark-v1.1.2'
      }))
    );
  }) as unknown as typeof fetch;
  await expect(updater.getLatestVersion()).rejects.toThrow(
    'No stable release found'
  );
  expect(calls).toBe(10);
});

// binary replacement is delegated to the existing checksum-verifying updater;
// tests never spawn its installer or replace the running test executable.

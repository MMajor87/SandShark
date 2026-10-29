import { afterEach, expect, test } from 'bun:test';
import { getDesktopReleaseUrl } from './desktop-release.js';

const realFetch = globalThis.fetch;
const desktopRelease = {
  tag_name: 'sandshark-v1.1.2',
  draft: false,
  prerelease: false,
  assets: [{ name: 'latest.yml' }]
};
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('selects desktop releases independently of server and prerelease publication', async () => {
  globalThis.fetch = (async () =>
    Response.json([
      { ...desktopRelease, tag_name: 'sandshark-server-v99.0.0' },
      { ...desktopRelease, draft: true },
      { ...desktopRelease, prerelease: true },
      { ...desktopRelease, tag_name: 'sandshark-v2.0.0-beta.1' },
      desktopRelease
    ])) as unknown as typeof fetch;
  expect(await getDesktopReleaseUrl()).toBe(
    'https://github.com/MMajor87/SandShark/releases/download/sandshark-v1.1.2/'
  );
});

test('paginates past server releases', async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    urls.push(String(input));
    if (urls.length === 1)
      return Response.json(
        Array.from({ length: 100 }, () => ({
          ...desktopRelease,
          tag_name: 'sandshark-server-v1.0.0'
        }))
      );
    return Response.json([desktopRelease]);
  }) as unknown as typeof fetch;
  await getDesktopReleaseUrl();
  expect(urls).toEqual([
    'https://api.github.com/repos/MMajor87/SandShark/releases?per_page=100&page=1',
    'https://api.github.com/repos/MMajor87/SandShark/releases?per_page=100&page=2'
  ]);
});

test('fails closed for absent desktop releases or missing metadata', async () => {
  globalThis.fetch = (async () => Response.json([])) as unknown as typeof fetch;
  await expect(getDesktopReleaseUrl()).rejects.toThrow(
    'No stable desktop release'
  );
  globalThis.fetch = (async () =>
    Response.json([
      { ...desktopRelease, assets: [] }
    ])) as unknown as typeof fetch;
  await expect(getDesktopReleaseUrl()).rejects.toThrow('missing latest.yml');
});

test('reports API failures and malformed responses', async () => {
  globalThis.fetch = (async () =>
    new Response(null, { status: 403 })) as unknown as typeof fetch;
  await expect(getDesktopReleaseUrl()).rejects.toThrow(
    'Release lookup failed: 403'
  );
  globalThis.fetch = (async () => Response.json({})) as unknown as typeof fetch;
  await expect(getDesktopReleaseUrl()).rejects.toThrow(
    'Invalid releases response'
  );
});

test('bounds release pagination', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return Response.json(
      Array.from({ length: 100 }, () => ({
        ...desktopRelease,
        tag_name: 'sandshark-server-v1.0.0'
      }))
    );
  }) as unknown as typeof fetch;
  await expect(getDesktopReleaseUrl()).rejects.toThrow(
    'No stable desktop release'
  );
  expect(calls).toBe(10);
});

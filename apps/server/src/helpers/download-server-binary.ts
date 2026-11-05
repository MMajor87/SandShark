import type { TRelease, TReleaseMetadata } from 'bun-sfe-autoupdater';

// the linux binary of a release for this machine, checked against the checksum in its
// release.json. used where the server replaces its own binary instead of handing the swap to
// the external updater (docker, systemd)
const downloadServerBinary = async (
  release: TRelease,
  metadata: TReleaseMetadata
) => {
  const target = process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  const artifact = metadata.artifacts.find(
    (candidate) => candidate.target === target
  );
  const asset = release.assets.find(({ name }) => name === artifact?.name);

  if (!artifact || !asset) {
    throw new Error(`Server ${metadata.version} has no ${target} binary.`);
  }

  const response = await fetch(asset.browser_download_url);

  if (!response.ok) {
    throw new Error(
      `Downloading server ${metadata.version} failed: ${response.status} ${response.statusText}`
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(bytes);

  if (hasher.digest('hex') !== artifact.checksum) {
    throw new Error(
      `The download of server ${metadata.version} does not match its checksum.`
    );
  }

  return bytes;
};

export { downloadServerBinary };

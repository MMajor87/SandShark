import type { TRelease, TReleaseMetadata } from 'bun-sfe-autoupdater';
import fs from 'fs/promises';
import path from 'path';
import { downloadServerBinary } from './download-server-binary';
import { DOCKER_UPDATE_PATH } from './paths';

const DOCKER_UPDATE_BINARY_PATH = path.join(DOCKER_UPDATE_PATH, 'sandshark');
const DOCKER_UPDATE_VERSION_PATH = path.join(DOCKER_UPDATE_PATH, 'version');

// the image's own binary cannot be replaced: the server runs as the bun user, the binary sits
// in the root of the image, and a recreated container would bring the old one back anyway. the
// new binary goes into the data volume instead, and docker-entrypoint.sh runs it whenever it
// is newer than the image's
const installDockerUpdate = async (
  release: TRelease,
  metadata: TReleaseMetadata
) => {
  const bytes = await downloadServerBinary(release, metadata);
  const downloadPath = `${DOCKER_UPDATE_BINARY_PATH}.download`;

  await fs.mkdir(DOCKER_UPDATE_PATH, { recursive: true });
  await fs.writeFile(downloadPath, bytes, { mode: 0o755 });

  // the entrypoint only runs the binary while its version is recorded, so the old record goes
  // before the binary is swapped and the new one after: a crash in between falls back to the
  // image instead of running a binary under another version's number
  await fs.rm(DOCKER_UPDATE_VERSION_PATH, { force: true });
  await fs.rename(downloadPath, DOCKER_UPDATE_BINARY_PATH);
  await fs.writeFile(DOCKER_UPDATE_VERSION_PATH, metadata.version);
};

export {
  DOCKER_UPDATE_BINARY_PATH,
  DOCKER_UPDATE_VERSION_PATH,
  installDockerUpdate
};

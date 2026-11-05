import type { TRelease, TReleaseMetadata } from 'bun-sfe-autoupdater';
import fs from 'fs/promises';
import { downloadServerBinary } from './download-server-binary';

// under systemd the external updater cannot do the swap: it runs in the service's control
// group, which systemd kills as soon as the server exits, before the new binary is in place.
// linux lets a running binary be replaced, so the server swaps its own file and exits, and the
// unit's Restart=always starts the new one. the install script gives the service user the
// binary's folder for this
const installSystemdUpdate = async (
  release: TRelease,
  metadata: TReleaseMetadata
) => {
  const bytes = await downloadServerBinary(release, metadata);
  const binaryPath = process.execPath;
  const downloadPath = `${binaryPath}.download`;

  await fs.writeFile(downloadPath, bytes, { mode: 0o755 });
  await fs.rename(downloadPath, binaryPath);
};

export { installSystemdUpdate };

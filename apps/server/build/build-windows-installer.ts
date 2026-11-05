import fs from 'fs/promises';
import path from 'path';
import { getCurrentVersion, getFileChecksum } from './helpers';

// pinned by checksum: github publishes no digest for this release's assets, so this is the
// sha-256 of the file as downloaded when the version was chosen. a different file stops the build
const WINSW_VERSION = '2.12.0';
const WINSW_URL = `https://github.com/winsw/winsw/releases/download/v${WINSW_VERSION}/WinSW-x64.exe`;
const WINSW_SHA256 =
  '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da';

const serverCwd = path.resolve(import.meta.dir, '..');
const repoRoot = path.resolve(serverCwd, '..', '..');
const outDir = path.join(serverCwd, 'build', 'out');
const cacheDir = path.join(serverCwd, 'build', 'temp');
const serverExe = path.join(outDir, 'sandshark-windows-x64.exe');
const winswExe = path.join(cacheDir, `WinSW-x64-${WINSW_VERSION}.exe`);
const script = path.join(
  serverCwd,
  'installer',
  'windows',
  'sandshark-server.nsi'
);

const downloadWinsw = async () => {
  if (await fs.exists(winswExe)) {
    if ((await getFileChecksum(winswExe)) === WINSW_SHA256) return;

    await fs.rm(winswExe);
  }

  console.log(`Downloading WinSW ${WINSW_VERSION}...`);

  const response = await fetch(WINSW_URL);

  if (!response.ok) {
    throw new Error(
      `Downloading WinSW failed: ${response.status} ${response.statusText}`
    );
  }

  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(winswExe, new Uint8Array(await response.arrayBuffer()));

  const checksum = await getFileChecksum(winswExe);

  if (checksum !== WINSW_SHA256) {
    await fs.rm(winswExe);

    throw new Error(
      `WinSW ${WINSW_VERSION} does not match its pinned checksum (got ${checksum}).`
    );
  }
};

if (!(await fs.exists(serverExe))) {
  throw new Error(`${serverExe} is missing. Run bun run build first.`);
}

await downloadWinsw();

const version = await getCurrentVersion();
const outFile = path.join(outDir, `sandshark-server-${version}-setup-x64.exe`);
const makensis = process.env.MAKENSIS || 'makensis';

console.log(`Building ${path.basename(outFile)}...`);

const proc = Bun.spawn(
  [
    makensis,
    '-V3',
    '-WX',
    `-DVERSION=${version}`,
    `-DSERVER_EXE=${serverExe}`,
    `-DWINSW_EXE=${winswExe}`,
    `-DOUTFILE=${outFile}`,
    `-DLICENSE_FILE=${path.join(repoRoot, 'LICENSE')}`,
    `-DICON_FILE=${path.join(repoRoot, 'apps', 'client', 'public', 'favicon.ico')}`,
    script
  ],
  { stdout: 'inherit', stderr: 'inherit' }
);

const exitCode = await proc.exited;

if (exitCode !== 0) {
  throw new Error(`makensis exited with ${exitCode}`);
}

console.log(`Built ${outFile}`);

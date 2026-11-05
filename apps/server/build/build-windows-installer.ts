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
const installerDir = path.join(serverCwd, 'installer', 'windows');
const script = path.join(installerDir, 'sandshark-server.nsi');
const trayScript = path.join(installerDir, 'sandshark-tray.ps1');

// nothing runs the tray script before it reaches a windows machine, so a syntax error in it is
// caught here. ci has pwsh on linux; a local build without powershell skips the check
const checkTrayScript = async () => {
  const shell = Bun.which('pwsh') ?? Bun.which('powershell');

  if (!shell) {
    if (process.env.CI) {
      throw new Error('PowerShell is needed to check the tray script.');
    }

    console.warn('PowerShell not found, skipping the tray script check.');

    return;
  }

  const proc = Bun.spawn(
    [
      shell,
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$errors = $null; [System.Management.Automation.Language.Parser]::ParseFile($env:TRAY_SCRIPT, [ref]$null, [ref]$errors) | Out-Null; $errors | ForEach-Object { "$($_.Extent.StartLineNumber): $($_.Message)" }; exit $errors.Count'
    ],
    {
      env: { ...process.env, TRAY_SCRIPT: trayScript },
      stdout: 'inherit',
      stderr: 'inherit'
    }
  );

  if ((await proc.exited) !== 0) {
    throw new Error(`${path.basename(trayScript)} does not parse.`);
  }
};

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

await checkTrayScript();
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
    `-DTRAY_SCRIPT=${trayScript}`,
    script
  ],
  { stdout: 'inherit', stderr: 'inherit' }
);

const exitCode = await proc.exited;

if (exitCode !== 0) {
  throw new Error(`makensis exited with ${exitCode}`);
}

console.log(`Built ${outFile}`);

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const desktopRoot = resolve(import.meta.dirname, '..');
const mainSource = await readFile(resolve(desktopRoot, 'src/main.ts'), 'utf8');
const preloadSource = await readFile(
  resolve(desktopRoot, 'src/preload.cts'),
  'utf8'
);

const requiredMainSettings = [
  'contextIsolation: true',
  'nodeIntegration: false',
  'sandbox: true',
  'webSecurity: true',
  'allowRunningInsecureContent: false',
  'webviewTag: false'
];

for (const setting of requiredMainSettings) {
  if (!mainSource.includes(setting)) {
    throw new Error(`Missing required Electron security setting: ${setting}`);
  }
}

for (const navigationGuard of [
  "window.webContents.on('will-navigate', handleNavigation)",
  "window.webContents.on('will-redirect', handleNavigation)",
  'window.webContents.setWindowOpenHandler',
  'shell.openExternal(url)'
]) {
  if (!mainSource.includes(navigationGuard)) {
    throw new Error(`Missing required navigation guard: ${navigationGuard}`);
  }
}

const ipcHandlerCount = (mainSource.match(/ipcMain\.handle\(/g) ?? []).length;
const trustedSenderCheckCount = (
  mainSource.match(/getSenderWindow\(event\)/g) ?? []
).length;

if (trustedSenderCheckCount < ipcHandlerCount) {
  throw new Error('Every desktop IPC handler must validate its sender.');
}

if (!mainSource.includes("preload: join(currentDirectory, 'preload.cjs')")) {
  throw new Error('The main window must use the bundled preload script.');
}

const bridgeMatches = preloadSource.match(/contextBridge\.exposeInMainWorld/g);

if (bridgeMatches?.length !== 1) {
  throw new Error('Preload must expose exactly one namespaced bridge.');
}

if (
  !preloadSource.includes(
    "contextBridge.exposeInMainWorld('sandSharkDesktop', desktopApi)"
  )
) {
  throw new Error('Preload must expose only the SandShark desktop API.');
}

for (const forbiddenIpcMethod of ['send(', 'sendSync(', 'postMessage(']) {
  if (preloadSource.includes(`ipcRenderer.${forbiddenIpcMethod}`)) {
    throw new Error(`Preload must not expose raw IPC via ${forbiddenIpcMethod}`);
  }
}

console.log('Desktop security boundary verified.');

import ts from 'typescript';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const desktopRoot = resolve(import.meta.dirname, '..');
const mainSource = await readFile(resolve(desktopRoot, 'src/desktop-window.ts'), 'utf8');
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

// this static inventory complements behavioral sender/payload tests; it is not a security proof.
const channels = new Set();
const sourceDirectory = resolve(desktopRoot, 'src');
for (const filename of await readdir(sourceDirectory)) {
  if (!filename.endsWith('.ts') || filename.endsWith('.test.ts')) continue;
  const source = await readFile(resolve(sourceDirectory, filename), 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'handle') {
      const owner = node.expression.expression.getText(ast);
      if (owner === 'ipcMain' && filename === 'desktop-ipc.ts') {
        const callback = node.arguments[1];
        const first = callback?.body?.statements?.[0];
        if (!first || !ts.isExpressionStatement(first) || first.expression.getText(ast) !== 'getSenderWindow(event)') {
          throw new Error('The IPC registry must validate the sender before invoking a handler.');
        }
      } else {
        if (!['ipc', 'desktopIpc'].includes(owner)) throw new Error(`IPC bypass in ${filename}`);
        const channel = node.arguments[0];
        if (!channel || !ts.isStringLiteral(channel)) throw new Error(`Nonliteral IPC channel in ${filename}`);
        if (channels.has(channel.text)) throw new Error(`Duplicate IPC channel: ${channel.text}`);
        channels.add(channel.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
const preloadAst = ts.createSourceFile('preload.cts', preloadSource, ts.ScriptTarget.Latest, true);
const verifyInvoke = (node) => {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'invoke') {
    const channel = node.arguments[0];
    if (!channel || !ts.isStringLiteral(channel) || !channels.has(channel.text)) {
      throw new Error('Every preload invocation must have exactly one registered owner.');
    }
  }
  ts.forEachChild(node, verifyInvoke);
};
verifyInvoke(preloadAst);
if (!channels.size) throw new Error('No desktop IPC registrations found.');

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

console.log(`Desktop static security checks passed (${channels.size} uniquely owned IPC channels). Run desktop tests for behavioral guard coverage.`);

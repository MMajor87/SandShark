import { app, shell } from 'electron';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  TDesktopCaptureDiagnostic,
  TDesktopLogDiagnostic
} from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';
import { sanitizeLogDetails, type TDesktopLogDetails } from './log-details.js';
import { rotateLog } from './log-retention.js';

const getDesktopCaptureLogPath = () =>
  join(app.getPath('logs'), 'screen-capture.log');
const getChromiumMediaLogPath = () =>
  join(app.getPath('logs'), 'chromium-media.log');
const getDesktopAppLogPath = () => join(app.getPath('logs'), 'sandshark.log');

const writeDesktopLog = (
  category: string,
  message: string,
  details: TDesktopLogDetails = {}
) => {
  try {
    const logPath = getDesktopAppLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    rotateLog(logPath);
    appendFileSync(
      logPath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        category,
        message,
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        chromiumVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
        platform: process.platform,
        isPackaged: app.isPackaged,
        details: sanitizeLogDetails(details)
      })}\n`,
      'utf8'
    );
  } catch (error) {
    console.error('SandShark could not write desktop diagnostics.', error);
  }
};

const ensureLogFiles = () => {
  try {
    const logDirectory = app.getPath('logs');
    mkdirSync(logDirectory, { recursive: true });
    for (const logPath of [
      getDesktopAppLogPath(),
      getDesktopCaptureLogPath(),
      getChromiumMediaLogPath()
    ]) {
      if (!existsSync(logPath)) writeFileSync(logPath, '', 'utf8');
    }
  } catch (error) {
    console.error('SandShark could not create log files.', error);
  }
};

const writeDesktopCaptureDiagnostic = (
  stage: string,
  details: Record<string, boolean | number | string | undefined> = {}
) => {
  writeDesktopLog('screen-capture', stage, details);

  try {
    const logPath = getDesktopCaptureLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    rotateLog(logPath);
    appendFileSync(
      logPath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        version: app.getVersion(),
        platform: process.platform,
        stage,
        ...sanitizeLogDetails(details)
      })}\n`,
      'utf8'
    );
  } catch (error) {
    console.error(
      'SandShark could not write screen capture diagnostics.',
      error
    );
  }
};

const isDesktopCaptureDiagnostic = (
  value: unknown
): value is TDesktopCaptureDiagnostic => {
  if (!value || typeof value !== 'object') return false;

  const diagnostic = value as Record<string, unknown>;

  if (
    typeof diagnostic.stage !== 'string' ||
    diagnostic.stage.length === 0 ||
    diagnostic.stage.length > 128
  ) {
    return false;
  }

  if (diagnostic.details === undefined) return true;
  if (!diagnostic.details || typeof diagnostic.details !== 'object')
    return false;

  return Object.entries(diagnostic.details as Record<string, unknown>).every(
    ([key, detail]) =>
      key.length <= 128 &&
      (typeof detail === 'string'
        ? detail.length <= 2_000
        : typeof detail === 'boolean' ||
          (typeof detail === 'number' && Number.isFinite(detail)) ||
          detail === undefined)
  );
};

const isDesktopLogDiagnostic = (
  value: unknown
): value is TDesktopLogDiagnostic => {
  if (!value || typeof value !== 'object') return false;

  const diagnostic = value as Record<string, unknown>;

  if (
    typeof diagnostic.category !== 'string' ||
    diagnostic.category.length === 0 ||
    diagnostic.category.length > 64 ||
    !/^[a-z0-9-]+$/i.test(diagnostic.category)
  ) {
    return false;
  }

  if (
    typeof diagnostic.message !== 'string' ||
    diagnostic.message.length === 0 ||
    diagnostic.message.length > 256
  ) {
    return false;
  }

  if (diagnostic.details === undefined) return true;
  if (!diagnostic.details || typeof diagnostic.details !== 'object')
    return false;

  return Object.entries(diagnostic.details as Record<string, unknown>).every(
    ([key, detail]) =>
      key.length <= 128 &&
      (typeof detail === 'string'
        ? detail.length <= 2_000
        : typeof detail === 'boolean' ||
          (typeof detail === 'number' && Number.isFinite(detail)) ||
          detail === undefined)
  );
};
const openDesktopLogFolder = async () => {
  ensureLogFiles();

  const error = await shell.openPath(app.getPath('logs'));
  if (error) throw new Error(error);
};

const configureChromiumMediaLogging = () => {
  // chromium reduces native audio-device startup failures to a generic DOM error.
  // keep its verbose output narrowly scoped to media components for diagnosis.
  try {
    const chromiumMediaLogPath = getChromiumMediaLogPath();
    mkdirSync(dirname(chromiumMediaLogPath), { recursive: true });
    // chromium owns this file while running, so rotate it only before startup.
    rotateLog(chromiumMediaLogPath);
    if (!existsSync(chromiumMediaLogPath)) {
      writeFileSync(chromiumMediaLogPath, '', 'utf8');
    }
    app.commandLine.appendSwitch('enable-logging', 'file');
    app.commandLine.appendSwitch('log-file', chromiumMediaLogPath);
    app.commandLine.appendSwitch(
      'vmodule',
      'audio*=2,media*=2,media_stream*=2,webrtc*=2'
    );
  } catch (error) {
    console.error(
      'SandShark could not configure Chromium media diagnostics.',
      error
    );
  }
};

export {
  configureChromiumMediaLogging,
  ensureLogFiles,
  getChromiumMediaLogPath,
  getDesktopAppLogPath,
  getDesktopCaptureLogPath,
  isDesktopCaptureDiagnostic,
  isDesktopLogDiagnostic,
  openDesktopLogFolder,
  sanitizeLogDetails,
  writeDesktopCaptureDiagnostic,
  writeDesktopLog
};

export type { TDesktopLogDetails };

const registerDiagnosticsIpc = (ipc: TDesktopIpc) => {
  const { getSenderWindow } = ipc;
  ipc.handle(
    'sandshark:report-desktop-capture-diagnostic',
    (event, diagnostic: unknown) => {
      getSenderWindow(event);

      if (!isDesktopCaptureDiagnostic(diagnostic)) {
        throw new Error('Invalid desktop capture diagnostic.');
      }

      writeDesktopCaptureDiagnostic(
        `renderer-${diagnostic.stage}`,
        diagnostic.details
      );
    }
  );
  ipc.handle('sandshark:show-desktop-capture-log', (event) => {
    getSenderWindow(event);
    const logPath = getDesktopCaptureLogPath();
    mkdirSync(dirname(logPath), { recursive: true });
    if (!existsSync(logPath)) writeFileSync(logPath, '', 'utf8');
    shell.showItemInFolder(logPath);
  });
  ipc.handle(
    'sandshark:report-desktop-diagnostic',
    (event, diagnostic: unknown) => {
      getSenderWindow(event);

      if (!isDesktopLogDiagnostic(diagnostic)) {
        throw new Error('Invalid desktop diagnostic.');
      }

      writeDesktopLog(
        diagnostic.category,
        diagnostic.message,
        diagnostic.details
      );
    }
  );
  ipc.handle('sandshark:open-log-folder', async (event) => {
    getSenderWindow(event);
    await openDesktopLogFolder();
  });
};
export { registerDiagnosticsIpc };

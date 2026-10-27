import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import type { TApplicationAudioCapture } from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';
import type { TDesktopLogDetails } from './diagnostics.js';

const createApplicationAudio = ({
  getExecutablePath,
  writeDesktopCaptureDiagnostic,
  spawnProcess = spawn,
  platform = process.platform
}: {
  getExecutablePath: () => string;
  writeDesktopCaptureDiagnostic: (
    stage: string,
    details?: TDesktopLogDetails
  ) => void;
  spawnProcess?: typeof spawn;
  platform?: NodeJS.Platform;
}) => {
  type TActiveApplicationAudioCapture = {
    captureId: string;
    sourceId: string;
    process: ChildProcess;
    stop: () => void;
  };
  let activeApplicationAudioCapture: TActiveApplicationAudioCapture | undefined;
  const stopApplicationAudioCapture = () => {
    const capture = activeApplicationAudioCapture;
    activeApplicationAudioCapture = undefined;

    capture?.stop();
  };

  const startApplicationAudioCapture = async (
    sourceId: string,
    sender: Electron.WebContents
  ): Promise<TApplicationAudioCapture> => {
    stopApplicationAudioCapture();

    if (
      platform !== 'win32' ||
      (!sourceId.startsWith('window:') && !sourceId.startsWith('screen:'))
    ) {
      return {
        active: false,
        reason: 'Native desktop audio capture is only available on Windows.'
      };
    }

    const executablePath = getExecutablePath();
    if (!existsSync(executablePath)) {
      writeDesktopCaptureDiagnostic('application-audio-unavailable', {
        reason: 'helper-not-found'
      });
      return {
        active: false,
        reason: 'Application audio capture is not installed.'
      };
    }

    return new Promise((resolve) => {
      const captureId = randomUUID();
      // exclude the Electron main process and all of its audio-rendering children.
      const excludeOwnAudio = sourceId.startsWith('screen:');
      const captureArguments = excludeOwnAudio
        ? ['--exclude-process', String(process.pid)]
        : [sourceId];
      writeDesktopCaptureDiagnostic('native-audio-requested', {
        mode: excludeOwnAudio ? 'exclude-sandshark' : 'include-application',
        excludedProcessId: excludeOwnAudio ? process.pid : undefined
      });
      const captureProcess = spawnProcess(executablePath, captureArguments, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let startupBuffer = Buffer.alloc(0);
      let helperError = '';
      let settled = false;
      const startupTimeout = setTimeout(() => {
        finish({
          active: false,
          reason: 'Application audio capture timed out while starting.'
        });
      }, 10_000);

      const finish = (result: TApplicationAudioCapture) => {
        if (settled) return;
        settled = true;
        clearTimeout(startupTimeout);

        if (!result.active) {
          cleanup();
          if (!captureProcess.killed) captureProcess.kill();
          if (activeApplicationAudioCapture?.captureId === captureId) {
            activeApplicationAudioCapture = undefined;
          }
        }

        resolve(result);
      };

      const sendAudioData = (data: Buffer) => {
        if (
          !activeApplicationAudioCapture ||
          activeApplicationAudioCapture.captureId !== captureId ||
          sender.isDestroyed()
        ) {
          return;
        }

        sender.send('sandshark:application-audio-data', captureId, data);
      };

      const consumeOutput = (data: Buffer) => {
        if (settled) {
          sendAudioData(data);
          return;
        }

        startupBuffer = Buffer.concat([startupBuffer, data]);
        const lineEnd = startupBuffer.indexOf(10);
        if (lineEnd < 0) return;

        const header = startupBuffer.subarray(0, lineEnd).toString('utf8');
        const remainingAudio = startupBuffer.subarray(lineEnd + 1);
        startupBuffer = Buffer.alloc(0);
        const prefix = 'SANDSHARK_PROCESS_AUDIO ';

        if (!header.startsWith(prefix)) {
          finish({
            active: false,
            reason: 'Application audio capture returned an invalid response.'
          });
          return;
        }

        try {
          const details = JSON.parse(header.slice(prefix.length)) as {
            sampleRate?: unknown;
            channels?: unknown;
            format?: unknown;
          };
          if (
            typeof details.sampleRate !== 'number' ||
            typeof details.channels !== 'number' ||
            (details.format !== 'f32' && details.format !== 's16')
          ) {
            throw new Error('invalid audio format');
          }

          writeDesktopCaptureDiagnostic('application-audio-started', {
            sampleRate: details.sampleRate,
            channels: details.channels,
            format: details.format
          });
          finish({
            active: true,
            captureId,
            sampleRate: details.sampleRate,
            channels: details.channels,
            format: details.format
          });
          if (remainingAudio.length > 0) sendAudioData(remainingAudio);
        } catch {
          finish({
            active: false,
            reason: 'Application audio capture returned an invalid format.'
          });
        }
      };

      const onStderr = (data: Buffer) => {
        helperError = `${helperError}${data.toString('utf8')}`
          .trim()
          .slice(0, 1_000);
        writeDesktopCaptureDiagnostic('application-audio-helper', {
          helperError
        });
      };
      const onSenderDestroyed = () => stopCapture();
      const cleanup = () => {
        clearTimeout(startupTimeout);
        captureProcess.stdout.removeListener('data', consumeOutput);
        captureProcess.stderr.removeListener('data', onStderr);
        sender.removeListener('destroyed', onSenderDestroyed);
      };
      const stopCapture = () => {
        finish({ active: false, reason: 'Application audio capture stopped.' });
        cleanup();
        if (!captureProcess.killed) captureProcess.kill();
        if (activeApplicationAudioCapture?.captureId === captureId)
          activeApplicationAudioCapture = undefined;
      };
      activeApplicationAudioCapture = {
        captureId,
        sourceId,
        process: captureProcess,
        stop: stopCapture
      };
      sender.once('destroyed', onSenderDestroyed);
      captureProcess.stdout.on('data', consumeOutput);
      captureProcess.stderr.on('data', onStderr);
      // bun's Node compatibility types omit EventEmitter methods from the
      // overloaded spawn return type even though Electron exposes them at runtime.
      const processEvents = captureProcess as unknown as EventEmitter;
      processEvents.once('error', (error: Error) => {
        finish({ active: false, reason: helperError || error.message });
        stopCapture();
      });
      processEvents.once('exit', (code: number | null) => {
        cleanup();
        if (!settled) {
          finish({
            active: false,
            reason:
              helperError ||
              `Application audio capture stopped before starting (${code ?? 'unknown'}).`
          });
        } else if (activeApplicationAudioCapture?.captureId === captureId) {
          activeApplicationAudioCapture = undefined;
          writeDesktopCaptureDiagnostic('application-audio-stopped', {
            code: code ?? undefined
          });
        }
      });
    });
  };

  const registerIpc = (ipc: TDesktopIpc) => {
    const { getSenderWindow } = ipc;
    ipc.handle(
      'sandshark:start-application-audio-capture',
      async (event, sourceId: unknown) => {
        const senderWindow = getSenderWindow(event);

        if (
          typeof sourceId !== 'string' ||
          (!sourceId.startsWith('window:') && !sourceId.startsWith('screen:'))
        ) {
          throw new Error(
            'Desktop audio requires a valid screen or application window.'
          );
        }

        return startApplicationAudioCapture(sourceId, senderWindow.webContents);
      }
    );
    ipc.handle('sandshark:stop-application-audio-capture', (event) => {
      getSenderWindow(event);
      stopApplicationAudioCapture();
    });
  };
  return {
    startApplicationAudioCapture,
    stopApplicationAudioCapture,
    registerIpc,
    isCapturingSource: (sourceId: string | undefined) =>
      !!sourceId && activeApplicationAudioCapture?.sourceId === sourceId
  };
};
export { createApplicationAudio };

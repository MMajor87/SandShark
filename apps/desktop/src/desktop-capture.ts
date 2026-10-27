import { BrowserWindow, desktopCapturer, session } from 'electron';
import type { createApplicationAudio } from './application-audio.js';
import type { TDesktopCaptureSource } from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';
import { writeDesktopCaptureDiagnostic } from './diagnostics.js';
import { createMinimizedCaptureSources } from './minimized-capture-sources.js';
const createDesktopCapture = (
  getProcessAudioCaptureExecutablePath: () => string,
  applicationAudio: ReturnType<typeof createApplicationAudio>,
  isAllowedRendererUrl: (value: string) => boolean,
  getMainWindow: () => BrowserWindow | null
) => {
  let selectedDesktopCaptureSourceId: string | undefined;
  const minimizedCaptureSources = createMinimizedCaptureSources(
    getProcessAudioCaptureExecutablePath()
  );

  const configureMediaPermissions = () => {
    const canUseMedia = (
      webContents: Electron.WebContents | null,
      permission: string
    ) => {
      if (!webContents) return false;

      const senderWindow = BrowserWindow.fromWebContents(webContents);
      const isTrustedMainWindow =
        senderWindow !== null &&
        senderWindow === getMainWindow() &&
        isAllowedRendererUrl(webContents.getURL());

      return (
        isTrustedMainWindow &&
        (permission === 'media' || permission === 'display-capture')
      );
    };

    session.defaultSession.setPermissionCheckHandler(
      (webContents, permission) => {
        const granted = canUseMedia(webContents, permission);

        if (permission === 'media') {
          writeDesktopCaptureDiagnostic('permission-check', {
            permission,
            granted,
            hasWebContents: Boolean(webContents)
          });
        }

        return granted;
      }
    );

    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        const granted = canUseMedia(webContents, permission);

        if (permission === 'media' || permission === 'display-capture') {
          writeDesktopCaptureDiagnostic('permission-request', {
            permission,
            granted,
            hasWebContents: Boolean(webContents)
          });
        }

        callback(granted);
      }
    );

    session.defaultSession.setDisplayMediaRequestHandler(
      async (request, callback) => {
        const sourceId = selectedDesktopCaptureSourceId;
        selectedDesktopCaptureSourceId = undefined;

        writeDesktopCaptureDiagnostic('display-media-request', {
          audioRequested: request.audioRequested,
          videoRequested: request.videoRequested,
          userGesture: request.userGesture,
          sourceSelected: Boolean(sourceId),
          sourceType: sourceId?.startsWith('screen:')
            ? 'screen'
            : sourceId?.startsWith('window:')
              ? 'window'
              : undefined
        });

        if (!sourceId) {
          writeDesktopCaptureDiagnostic('display-media-denied', {
            reason: 'no-source-selected'
          });
          callback({});
          return;
        }

        try {
          if (process.platform === 'win32') {
            await minimizedCaptureSources.restore(sourceId);
          }
          const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false
          });
          const source = sources.find((candidate) => candidate.id === sourceId);

          if (!source) {
            writeDesktopCaptureDiagnostic('display-media-denied', {
              reason: 'source-not-found'
            });
            callback({});
            return;
          }

          const includeLoopbackAudio =
            request.audioRequested &&
            process.platform === 'win32' &&
            source.id.startsWith('screen:');
          writeDesktopCaptureDiagnostic('display-media-granted', {
            sourceType: source.id.startsWith('screen:') ? 'screen' : 'window',
            loopbackAudio: includeLoopbackAudio,
            applicationAudio: applicationAudio.isCapturingSource(sourceId)
          });
          callback(
            includeLoopbackAudio
              ? { video: source, audio: 'loopback' }
              : { video: source }
          );
        } catch (error) {
          console.error(
            'SandShark could not grant screen capture access.',
            error
          );
          writeDesktopCaptureDiagnostic('display-media-handler-error', {
            error: error instanceof Error ? error.message : String(error)
          });
          callback({});
        }
      }
    );
  };

  const registerIpc = (ipc: TDesktopIpc) => {
    const { getSenderWindow } = ipc;
    ipc.handle('sandshark:get-desktop-capture-sources', async (event) => {
      getSenderWindow(event);

      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 640, height: 360 },
        fetchWindowIcons: false
      });

      const captureSources = sources.map<TDesktopCaptureSource>((source) => ({
        id: source.id,
        name: source.name || 'Untitled source',
        type: source.id.startsWith('screen:') ? 'screen' : 'window',
        thumbnailDataUrl: source.thumbnail.isEmpty()
          ? undefined
          : source.thumbnail.toDataURL()
      }));

      if (process.platform === 'win32') {
        try {
          const minimizedSources = await minimizedCaptureSources.list();
          const sourceIds = new Set(captureSources.map(({ id }) => id));
          captureSources.push(
            ...minimizedSources.filter(({ id }) => !sourceIds.has(id))
          );
        } catch (error) {
          writeDesktopCaptureDiagnostic('minimized-window-list-error', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return captureSources;
    });
    ipc.handle(
      'sandshark:set-desktop-capture-source',
      (event, sourceId: unknown) => {
        getSenderWindow(event);

        if (
          typeof sourceId !== 'string' ||
          !/^(screen|window):/.test(sourceId)
        ) {
          throw new Error('Invalid desktop capture source.');
        }

        selectedDesktopCaptureSourceId = sourceId;
        writeDesktopCaptureDiagnostic('source-selected', {
          sourceType: sourceId.startsWith('screen:') ? 'screen' : 'window'
        });
      }
    );
  };
  const dispose = () => {
    selectedDesktopCaptureSourceId = undefined;
    session.defaultSession.setPermissionRequestHandler(null);
    session.defaultSession.setPermissionCheckHandler(null);
    session.defaultSession.setDisplayMediaRequestHandler(null);
  };
  return { configureMediaPermissions, registerIpc, dispose };
};
export { createDesktopCapture };

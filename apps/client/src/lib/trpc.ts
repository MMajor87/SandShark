import { resetApp } from '@/features/app/actions';
import { resetDialogs } from '@/features/dialogs/actions';
import { resetServerScreens } from '@/features/server-screens/actions';
import { resetServerState, setDisconnectInfo } from '@/features/server/actions';
import { playSound } from '@/features/server/sounds/actions';
import { SoundType } from '@/features/server/types';
import { logDesktopDiagnostic } from '@/helpers/browser-logger';
import {
  clearCurrentServerAutoLogin,
  clearCurrentSessionToken,
  getCurrentSessionToken
} from '@/helpers/server-session';
import { type AppRouter, type TConnectionParams } from '@sharkord/shared';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';

let wsClient: ReturnType<typeof createWSClient> | null = null;
let trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;
let currentUrl: string | null = null;
let isCleaningUp = false;
let ignoreNextClose = false;
let reconnectAttempt = 0;

// Firefox fires WebSocket onClose during page refresh; Chrome does not. When navigating away,
// we must not clear auto-login localStorage or it will be lost on refresh in Firefox.
let isNavigatingAway = false;
window.addEventListener('beforeunload', () => {
  isNavigatingAway = true;
});

const initializeTRPC = (url: string) => {
  logDesktopDiagnostic('server-connection', 'Creating WebSocket client');

  wsClient = createWSClient({
    url,
    onOpen: () => {
      reconnectAttempt = 0;
      logDesktopDiagnostic('server-connection', 'WebSocket connected');
    },
    onError: () => {
      logDesktopDiagnostic('server-connection', 'WebSocket error');
    },
    // @ts-expect-error - the onclose type is not correct in trpc
    onClose: (cause: CloseEvent) => {
      const wasIntentionalClose = ignoreNextClose;
      ignoreNextClose = false;
      logDesktopDiagnostic('server-connection', 'WebSocket closed', {
        code: cause.code,
        reason: cause.reason,
        wasClean: cause.wasClean,
        intentional: wasIntentionalClose
      });
      cleanup();

      if (wasIntentionalClose) return;

      setDisconnectInfo({
        code: cause.code,
        reason: cause.reason,
        wasClean: cause.wasClean,
        time: new Date()
      });

      if (!cause.wasClean) {
        logDesktopDiagnostic(
          'server-connection',
          'WebSocket disconnected uncleanly',
          {
            code: cause.code,
            reason: cause.reason,
            wasClean: cause.wasClean
          }
        );
        playSound(SoundType.SERVER_DISCONNECTED);
      }
    },
    retryDelayMs: (attemptIndex) => {
      reconnectAttempt = attemptIndex + 1;
      const delayMs =
        attemptIndex === 0 ? 0 : Math.min(1000 * 2 ** attemptIndex, 30_000);

      logDesktopDiagnostic(
        'websocket-reconnect',
        'Scheduling WebSocket reconnect',
        {
          attempt: reconnectAttempt,
          delayMs
        }
      );

      return delayMs;
    },
    connectionParams: async (): Promise<TConnectionParams> => {
      return {
        token: getCurrentSessionToken() || ''
      };
    },
    keepAlive: {
      enabled: true,
      intervalMs: 30_000,
      pongTimeoutMs: 5_000
    }
  });

  trpc = createTRPCProxyClient<AppRouter>({
    links: [wsLink({ client: wsClient })]
  });

  currentUrl = url;
  logDesktopDiagnostic('server-connection', 'TRPC client initialized');

  return trpc;
};

const connectToTRPC = (url: string) => {
  if (trpc && currentUrl === url) {
    logDesktopDiagnostic('server-connection', 'Reusing existing TRPC client');
    return trpc;
  }

  logDesktopDiagnostic('server-connection', 'Connecting to server');
  return initializeTRPC(url);
};

const getTRPCClient = () => {
  if (!trpc) {
    throw new Error('TRPC client is not initialized');
  }

  return trpc;
};

const cleanup = ({ clearPersistedSession = !isNavigatingAway } = {}) => {
  if (isCleaningUp) {
    return;
  }

  isCleaningUp = true;
  logDesktopDiagnostic('server-connection', 'Cleaning up server connection', {
    clearPersistedSession
  });

  if (wsClient) {
    ignoreNextClose = true;
    wsClient.close();
    wsClient = null;
  }

  trpc = null;
  currentUrl = null;

  // cleanup can be called due to various reasons (manual disconnect, connection error, auto-login failure, etc).
  // so we remove any persisted auto-login token to prevent auto-login loops.
  // skip this when navigating away (refresh/close) - Firefox fires onClose during refresh, Chrome does not
  if (clearPersistedSession) clearCurrentServerAutoLogin();

  resetServerScreens();
  resetServerState();
  resetDialogs();
  resetApp();

  clearCurrentSessionToken();

  // this should help Firefox users who report that auto login is not consistent
  setTimeout(() => {
    isCleaningUp = false;
  }, 100);
};

export { cleanup, connectToTRPC, getTRPCClient, type AppRouter };

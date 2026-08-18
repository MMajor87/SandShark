import { resetApp } from '@/features/app/actions';
import { resetDialogs } from '@/features/dialogs/actions';
import { resetServerScreens } from '@/features/server-screens/actions';
import { resetServerState, setDisconnectInfo } from '@/features/server/actions';
import { playSound } from '@/features/server/sounds/actions';
import { SoundType } from '@/features/server/types';
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

// Firefox fires WebSocket onClose during page refresh; Chrome does not. When navigating away,
// we must not clear auto-login localStorage or it will be lost on refresh in Firefox.
let isNavigatingAway = false;
window.addEventListener('beforeunload', () => {
  isNavigatingAway = true;
});

const initializeTRPC = (url: string) => {
  wsClient = createWSClient({
    url,
    // @ts-expect-error - the onclose type is not correct in trpc
    onClose: (cause: CloseEvent) => {
      const wasIntentionalClose = ignoreNextClose;
      ignoreNextClose = false;
      cleanup();

      if (wasIntentionalClose) return;

      setDisconnectInfo({
        code: cause.code,
        reason: cause.reason,
        wasClean: cause.wasClean,
        time: new Date()
      });

      if (!cause.wasClean) {
        playSound(SoundType.SERVER_DISCONNECTED);
      }
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

  return trpc;
};

const connectToTRPC = (url: string) => {
  if (trpc && currentUrl === url) {
    return trpc;
  }

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
  if (clearPersistedSession)
    clearCurrentServerAutoLogin();

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

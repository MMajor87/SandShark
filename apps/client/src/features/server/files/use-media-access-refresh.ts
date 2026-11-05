import { store } from '@/features/store';
import { setMediaAccessToken } from '@/helpers/media-access-token';
import { getServerConnection } from '@/helpers/server-connection';
import { getCurrentSessionToken } from '@/helpers/server-session';
import { getTRPCClient } from '@/lib/trpc';
import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { channelPermissionsSelector } from '../channels/selectors';
import { serverSliceActions } from '../slice';
import { getHeldFileIds } from './helpers';

const BATCH_SIZE = 50;
const MAX_BATCHES = 4;
const REFRESH_INTERVAL_MS = 5 * 60_000;

const useMediaAccessRefresh = () => {
  const channelPermissions = useSelector(channelPermissionsSelector);
  const nextIndex = useRef(0);
  const inFlight = useRef(false);

  // full renews every url the client holds, which drops files from channels the user can no
  // longer see. otherwise only the urls about to run out are renewed: renewing changes a url and
  // reloads every image and video showing it, which on every focus froze the window for a moment
  const refresh = useCallback(async (full: boolean) => {
    if (inFlight.current || document.visibilityState === 'hidden') return;
    inFlight.current = true;

    const session = getCurrentSessionToken();
    const server = getServerConnection()?.httpUrl;
    if (!session || !server) {
      inFlight.current = false;
      return;
    }

    try {
      const fileIds = getHeldFileIds(store.getState(), Date.now(), !full);
      const start = nextIndex.current % Math.max(fileIds.length, 1);
      const selected = [
        ...fileIds.slice(start),
        ...fileIds.slice(0, start)
      ].slice(0, BATCH_SIZE * MAX_BATCHES);
      nextIndex.current =
        (start + selected.length) % Math.max(fileIds.length, 1);
      const trpc = getTRPCClient();

      for (
        let index = 0;
        index < selected.length || index === 0;
        index += BATCH_SIZE
      ) {
        const requestedIds = selected.slice(index, index + BATCH_SIZE);
        const result = await trpc.files.refreshAccess.query({
          fileIds: requestedIds
        });
        if (
          session !== getCurrentSessionToken() ||
          server !== getServerConnection()?.httpUrl
        )
          return;

        setMediaAccessToken(result.mediaAccessToken);

        // nothing was due, so the request only renewed the media access token
        if (requestedIds.length === 0) return;

        store.dispatch(
          serverSliceActions.refreshFileAccess({
            requestedIds,
            files: result.files
          })
        );
      }
    } catch {
      // reconnect will retry with a new session; the interval handles transient failures.
    } finally {
      inFlight.current = false;
    }
  }, []);

  const refreshDue = useCallback(() => {
    refresh(false);
  }, [refresh]);

  useEffect(() => {
    refresh(true);
    const interval = setInterval(refreshDue, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshDue);
    document.addEventListener('visibilitychange', refreshDue);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshDue);
      document.removeEventListener('visibilitychange', refreshDue);
    };
  }, [refresh, refreshDue, channelPermissions]);
};

export { useMediaAccessRefresh };

import { store } from '@/features/store';
import { setMediaAccessToken } from '@/helpers/media-access-token';
import { getServerConnection } from '@/helpers/server-connection';
import { getCurrentSessionToken } from '@/helpers/server-session';
import { getTRPCClient } from '@/lib/trpc';
import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { channelPermissionsSelector } from '../channels/selectors';
import { serverSliceActions } from '../slice';

const BATCH_SIZE = 50;
const MAX_BATCHES = 4;
const REFRESH_INTERVAL_MS = 5 * 60_000;

const useMediaAccessRefresh = () => {
  const channelPermissions = useSelector(channelPermissionsSelector);
  const nextIndex = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState === 'hidden') return;
    inFlight.current = true;

    const session = getCurrentSessionToken();
    const server = getServerConnection()?.httpUrl;
    if (!session || !server) {
      inFlight.current = false;
      return;
    }

    try {
      const state = store.getState();
      const ids = new Set<number>();
      for (const emoji of state.server.emojis) ids.add(emoji.file.id);
      for (const messages of Object.values(state.server.messagesMap)) {
        for (const message of messages) {
          for (const file of message.files) ids.add(file.id);
          for (const reaction of message.reactions) {
            if (reaction.file) ids.add(reaction.file.id);
          }
        }
      }

      const fileIds = [...ids];
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

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refresh, channelPermissions]);
};

export { useMediaAccessRefresh };

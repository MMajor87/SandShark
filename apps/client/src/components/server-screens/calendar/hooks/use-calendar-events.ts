import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  type TCalendarCursor,
  type TJoinedCalendarEvent
} from '@sandshark/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// pages through the calendar from `from`, or from the very first event when it is undefined.
// a reply that lands after the screen closed, the filter changed or the client reconnected
// is dropped instead of overwriting the newer list
const useCalendarEvents = (from: number | undefined) => {
  const { t } = useTranslation('calendar');
  const [events, setEvents] = useState<TJoinedCalendarEvent[]>([]);
  const [cursor, setCursor] = useState<TCalendarCursor>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const revision = useRef(0);
  const active = useRef(true);
  const loadingMore = useRef(false);

  const loadEvents = useCallback(
    async (after?: TCalendarCursor) => {
      const request = ++revision.current;
      setLoading(true);
      setFailed(false);
      try {
        const trpc = getTRPCClient();
        const page = await trpc.calendar.getAll.query({ cursor: after, from });
        if (
          !active.current ||
          revision.current !== request ||
          getTRPCClient() !== trpc
        )
          return;
        setEvents((current) =>
          after ? [...current, ...page.events] : page.events
        );
        setCursor(page.nextCursor);
      } catch (error) {
        if (active.current && revision.current === request) {
          setFailed(true);
          toast.error(getTrpcError(error, t('failedLoad')));
        }
      } finally {
        if (active.current && revision.current === request) {
          setLoading(false);
          loadingMore.current = false;
        }
      }
    },
    [from, t]
  );

  const refresh = useCallback(() => loadEvents(), [loadEvents]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    return loadEvents(cursor);
  }, [cursor, loadEvents]);

  useEffect(() => {
    active.current = true;
    loadEvents();
    return () => {
      active.current = false;
      revision.current += 1;
    };
  }, [loadEvents]);

  return {
    events,
    loading,
    failed,
    hasMore: !!cursor,
    refresh,
    loadMore,
    isActive: active
  };
};

export { useCalendarEvents };

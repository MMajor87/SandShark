import { getTRPCClient, type TRouterOutputs } from '@/lib/trpc';
import { getTrpcError, type TCalendarCursor } from '@sharkord/shared';
import { Button } from '@sharkord/ui';
import { CalendarDays } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TServerScreenBaseProps } from '../screens';
import { ServerScreenLayout } from '../server-screen-layout';
import { CreateEventForm } from './create-event-form';
import { CalendarEventCard } from './event-card';

type TCalendarEvent = TRouterOutputs['calendar']['getAll']['events'][number];
const CalendarScreen = memo(({ close }: TServerScreenBaseProps) => {
  const { t } = useTranslation('calendar');
  const [events, setEvents] = useState<TCalendarEvent[]>([]);
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
        const page = await trpc.calendar.getAll.query({ cursor: after });
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
    [t]
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
  const deleteEvent = useCallback(
    async (eventId: number) => {
      try {
        const trpc = getTRPCClient();
        await trpc.calendar.delete.mutate({ eventId });
        if (!active.current || getTRPCClient() !== trpc) return;
        await loadEvents();
        if (active.current && getTRPCClient() === trpc)
          toast.success(t('deleted'));
      } catch (error) {
        if (active.current) toast.error(getTrpcError(error, t('failedDelete')));
      }
    },
    [loadEvents, t]
  );
  return (
    <ServerScreenLayout close={close} title={t('calendar')}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">{t('events')}</h2>
          </div>
          {events.map((event) => (
            <CalendarEventCard
              key={event.id}
              event={event}
              onDelete={deleteEvent}
            />
          ))}
          {loading && (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          )}
          {!loading && !failed && events.length === 0 && (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t('empty')}
            </p>
          )}
          {failed && <Button onClick={refresh}>{t('retry')}</Button>}
          {cursor && (
            <Button disabled={loading} onClick={loadMore}>
              {t('loadMore')}
            </Button>
          )}
        </section>
        <CreateEventForm onCreated={refresh} />
      </div>
    </ServerScreenLayout>
  );
});
export { CalendarScreen };

import { fetchUpcomingCalendarEvents } from '@/features/server/calendar/actions';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  TestId,
  type CalendarResponseStatus,
  type TJoinedCalendarEvent
} from '@sandshark/shared';
import { Button, Label, Switch } from '@sandshark/ui';
import { CalendarDays } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TServerScreenBaseProps } from '../screens';
import { ServerScreenLayout } from '../server-screen-layout';
import { CalendarEventCard } from './event-card';
import { EventForm } from './event-form';
import { useCalendarEvents } from './hooks/use-calendar-events';

const CalendarScreen = memo(({ close }: TServerScreenBaseProps) => {
  const { t } = useTranslation('calendar');
  const [showPast, setShowPast] = useState(false);
  // fixed when the screen opens, so paging does not shift as the clock moves
  const [openedAt] = useState(() => Date.now());
  const [editingEvent, setEditingEvent] = useState<TJoinedCalendarEvent>();
  const { events, loading, failed, hasMore, refresh, loadMore, isActive } =
    useCalendarEvents(showPast ? undefined : openedAt);

  const onChanged = useCallback(async () => {
    fetchUpcomingCalendarEvents();
    await refresh();
  }, [refresh]);

  const onSaved = useCallback(async () => {
    setEditingEvent(undefined);
    await onChanged();
  }, [onChanged]);

  const onCancelEdit = useCallback(() => {
    setEditingEvent(undefined);
  }, []);

  const deleteEvent = useCallback(
    async (eventId: number) => {
      try {
        const trpc = getTRPCClient();
        await trpc.calendar.delete.mutate({ eventId });
        if (!isActive.current || getTRPCClient() !== trpc) return;
        setEditingEvent((current) =>
          current?.id === eventId ? undefined : current
        );
        await onChanged();
        if (isActive.current && getTRPCClient() === trpc)
          toast.success(t('deleted'));
      } catch (error) {
        if (isActive.current)
          toast.error(getTrpcError(error, t('failedDelete')));
      }
    },
    [isActive, onChanged, t]
  );

  const respondToEvent = useCallback(
    async (eventId: number, status: CalendarResponseStatus) => {
      try {
        const trpc = getTRPCClient();
        await trpc.calendar.respond.mutate({ eventId, status });
        if (!isActive.current || getTRPCClient() !== trpc) return;
        await onChanged();
      } catch (error) {
        if (isActive.current)
          toast.error(getTrpcError(error, t('failedRespond')));
      }
    },
    [isActive, onChanged, t]
  );

  return (
    <ServerScreenLayout close={close} title={t('calendar')}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">
                {showPast ? t('allEvents') : t('upcoming')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="calendar-show-past"
                checked={showPast}
                onCheckedChange={setShowPast}
                data-testid={TestId.CALENDAR_SHOW_PAST}
              />
              <Label htmlFor="calendar-show-past">{t('showPast')}</Label>
            </div>
          </div>
          {events.map((event) => (
            <CalendarEventCard
              key={event.id}
              event={event}
              onDelete={deleteEvent}
              onEdit={setEditingEvent}
              onRespond={respondToEvent}
            />
          ))}
          {loading && (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          )}
          {!loading && !failed && events.length === 0 && (
            <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {showPast ? t('empty') : t('noUpcoming')}
            </p>
          )}
          {failed && <Button onClick={refresh}>{t('retry')}</Button>}
          {hasMore && (
            <Button disabled={loading} onClick={loadMore}>
              {t('loadMore')}
            </Button>
          )}
        </section>
        <EventForm
          key={editingEvent?.id ?? 'new'}
          editingEvent={editingEvent}
          onSaved={onSaved}
          onCancelEdit={onCancelEdit}
        />
      </div>
    </ServerScreenLayout>
  );
});
export { CalendarScreen };

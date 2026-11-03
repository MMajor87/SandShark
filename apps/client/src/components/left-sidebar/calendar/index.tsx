import { useCalendarDateFormatter } from '@/components/server-screens/calendar/hooks/use-calendar-date-formatter';
import { ServerScreen } from '@/components/server-screens/screens';
import { openServerScreen } from '@/features/server-screens/actions';
import { useUpcomingCalendarEvents } from '@/features/server/calendar/hooks';
import { TestId, type TJoinedCalendarEvent } from '@sandshark/shared';
import { Button } from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../section-header';

const UPCOMING_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
};

const openCalendarScreen = () => openServerScreen(ServerScreen.CALENDAR);

type TUpcomingEventProps = {
  event: TJoinedCalendarEvent;
  formatter: Intl.DateTimeFormat;
};

const UpcomingEvent = memo(({ event, formatter }: TUpcomingEventProps) => {
  const { t } = useTranslation('calendar');
  const isPending = !event.canEdit && event.ownResponse === null;

  let status = t('organizer');

  if (!event.canEdit) {
    status = event.ownResponse
      ? t(`response_${event.ownResponse}`)
      : t('awaitingResponse');
  }

  return (
    <button
      type="button"
      data-testid={TestId.CALENDAR_UPCOMING_ITEM}
      onClick={openCalendarScreen}
      className="flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <span className="w-full truncate font-medium text-foreground">
        {event.title}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatter.format(event.startsAt)}
      </span>
      <span
        className={
          isPending
            ? 'text-xs font-medium text-primary'
            : 'text-xs text-muted-foreground'
        }
      >
        {status}
      </span>
    </button>
  );
});

const UpcomingEvents = memo(() => {
  const { t } = useTranslation('calendar');
  const events = useUpcomingCalendarEvents();
  const formatter = useCalendarDateFormatter(UPCOMING_DATE_OPTIONS);

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <SectionHeader title={t('upcoming')} />
      <div className="space-y-0.5">
        {events.map((event) => (
          <UpcomingEvent key={event.id} event={event} formatter={formatter} />
        ))}
        {events.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            {t('noUpcoming')}
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={openCalendarScreen}
        data-testid={TestId.CALENDAR_OPEN_FULL}
      >
        {t('openFullCalendar')}
      </Button>
    </div>
  );
});

export { UpcomingEvents };

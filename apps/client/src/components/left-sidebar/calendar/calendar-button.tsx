import { UnreadCount } from '@/components/unread-count';
import {
  fetchUpcomingCalendarEvents,
  setCalendarOpen
} from '@/features/server/calendar/actions';
import {
  useCalendarOpen,
  usePendingCalendarInvitationsCount
} from '@/features/server/calendar/hooks';
import { TestId } from '@sandshark/shared';
import { cn, Tooltip } from '@sandshark/ui';
import { CalendarDays, X } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// events finish while the app stays open, so the list is refreshed now and then rather
// than only when this user writes to the calendar
const UPCOMING_REFRESH_MS = 5 * 60_000;

const CalendarButton = memo(() => {
  const { t } = useTranslation('calendar');
  const calendarOpen = useCalendarOpen();
  const pendingCount = usePendingCalendarInvitationsCount();

  useEffect(() => {
    fetchUpcomingCalendarEvents();

    const interval = setInterval(
      fetchUpcomingCalendarEvents,
      UPCOMING_REFRESH_MS
    );

    return () => clearInterval(interval);
  }, []);

  const onToggleCalendar = useCallback(() => {
    setCalendarOpen(!calendarOpen);
  }, [calendarOpen]);

  return (
    <Tooltip content={calendarOpen ? t('closeCalendar') : t('openCalendar')}>
      <button
        type="button"
        data-testid={TestId.CALENDAR_TOGGLE}
        onClick={onToggleCalendar}
        className={cn(
          'flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          calendarOpen &&
            'bg-accent font-medium text-accent-foreground ring-1 ring-inset ring-border'
        )}
        aria-current={calendarOpen ? 'page' : undefined}
      >
        <CalendarDays className="h-4 w-4" />
        <span className="flex-1 text-left">{t('calendar')}</span>
        {calendarOpen && <X className="h-4 w-4" />}
        <UnreadCount count={pendingCount} />
      </button>
    </Tooltip>
  );
});

export { CalendarButton };

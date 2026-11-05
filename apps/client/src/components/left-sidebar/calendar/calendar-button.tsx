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
import { SIDEBAR_ITEM_ACTIVE_CLASS, SIDEBAR_ITEM_CLASS } from '../helpers';

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
          SIDEBAR_ITEM_CLASS,
          calendarOpen && SIDEBAR_ITEM_ACTIVE_CLASS
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

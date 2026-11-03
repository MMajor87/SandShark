import { useSelector } from 'react-redux';
import {
  calendarOpenSelector,
  pendingCalendarInvitationsCountSelector,
  upcomingCalendarEventsSelector
} from './selectors';

export const useCalendarOpen = () => useSelector(calendarOpenSelector);

export const useUpcomingCalendarEvents = () =>
  useSelector(upcomingCalendarEventsSelector);

export const usePendingCalendarInvitationsCount = () =>
  useSelector(pendingCalendarInvitationsCountSelector);

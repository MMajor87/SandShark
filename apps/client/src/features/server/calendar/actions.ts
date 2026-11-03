import { store } from '@/features/store';
import { getTRPCClient } from '@/lib/trpc';
import { serverSliceActions } from '../slice';
import { setThreadsOpen } from '../threads/actions';
import { threadsOpenSelector } from '../threads/selectors';

// enough for the sidebar list and the pending badge, the full screen pages through the rest
const UPCOMING_CALENDAR_EVENTS_LIMIT = 20;

export const setCalendarOpen = (open: boolean) => {
  const state = store.getState();

  // the threads view covers the main view, leaving it through its action marks what it
  // uncovers as read
  if (open && threadsOpenSelector(state)) {
    setThreadsOpen(false);
  }

  store.dispatch(serverSliceActions.setCalendarOpen(open));
};

// shared by the sidebar, which loads it, and every calendar write, which has to refresh it
export const fetchUpcomingCalendarEvents = async () => {
  try {
    const trpc = getTRPCClient();
    const page = await trpc.calendar.getAll.query({
      from: Date.now(),
      limit: UPCOMING_CALENDAR_EVENTS_LIMIT
    });

    store.dispatch(serverSliceActions.setUpcomingCalendarEvents(page.events));
  } catch (error) {
    // the badge and the list keep what they had, the full screen reports its own failures
    console.error('Failed to load upcoming calendar events:', error);
  }
};

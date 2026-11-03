import type { IRootState } from '@/features/store';
import { createSelector } from '@reduxjs/toolkit';

export const calendarOpenSelector = (state: IRootState) =>
  state.server.calendarOpen;

export const upcomingCalendarEventsSelector = (state: IRootState) =>
  state.server.upcomingCalendarEvents;

// an invitation is pending until the invitee answers it, the organizer has nothing to answer
export const pendingCalendarInvitationsCountSelector = createSelector(
  [upcomingCalendarEventsSelector],
  (events) =>
    events.filter((event) => !event.canEdit && event.ownResponse === null)
      .length
);

import type { IRootState } from '@/features/store';
import {
  CalendarResponseStatus,
  type TJoinedCalendarEvent
} from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { serverSliceActions, serverSliceReducer } from '../../slice';
import { pendingCalendarInvitationsCountSelector } from '../selectors';

const event = (
  id: number,
  canEdit: boolean,
  ownResponse: CalendarResponseStatus | null
) =>
  ({
    id,
    title: `event-${id}`,
    canEdit,
    ownResponse
  }) as unknown as TJoinedCalendarEvent;

const initial = () => serverSliceReducer(undefined, { type: 'init' });

describe('calendar reducers', () => {
  test('opening dms or threads closes the calendar sidebar', () => {
    for (const action of [
      serverSliceActions.setDmsOpen(true),
      serverSliceActions.setThreadsOpen(true)
    ]) {
      let state = serverSliceReducer(
        initial(),
        serverSliceActions.setCalendarOpen(true)
      );

      expect(state.calendarOpen).toBe(true);

      state = serverSliceReducer(state, action);

      expect(state.calendarOpen).toBe(false);
    }
  });

  test('closing dms or threads leaves an open calendar alone', () => {
    let state = serverSliceReducer(
      initial(),
      serverSliceActions.setCalendarOpen(true)
    );

    state = serverSliceReducer(state, serverSliceActions.setDmsOpen(false));
    state = serverSliceReducer(state, serverSliceActions.setThreadsOpen(false));

    expect(state.calendarOpen).toBe(true);
  });

  test('a reset clears the calendar state', () => {
    let state = serverSliceReducer(
      initial(),
      serverSliceActions.setCalendarOpen(true)
    );

    state = serverSliceReducer(
      state,
      serverSliceActions.setUpcomingCalendarEvents([event(1, false, null)])
    );
    state = serverSliceReducer(state, serverSliceActions.resetState());

    expect(state.calendarOpen).toBe(false);
    expect(state.upcomingCalendarEvents).toEqual([]);
  });
});

describe('pending calendar invitations', () => {
  test('counts only unanswered invitations the user did not organize', () => {
    const server = serverSliceReducer(
      initial(),
      serverSliceActions.setUpcomingCalendarEvents([
        event(1, false, null),
        event(2, false, CalendarResponseStatus.MAYBE),
        event(3, true, null),
        event(4, false, null)
      ])
    );

    expect(
      pendingCalendarInvitationsCountSelector({ server } as IRootState)
    ).toBe(2);
  });
});

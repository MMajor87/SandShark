import { CALENDAR_PAGE_SIZE, MAX_CALENDAR_TIMESTAMP } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { getCaller, initTest } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { config } from '../../config';
import {
  calendarEventInvitees,
  calendarEvents,
  userRoles
} from '../../db/schema';

const input = {
  title: 'Planning',
  description: 'Details',
  startsAt: 1000,
  endsAt: 2000,
  targets: [
    { type: 'user' as const, id: 2 },
    { type: 'role' as const, id: 2 }
  ]
};

describe('calendar', () => {
  test('lists organizer, direct and role invitations without leaking other events', async () => {
    const owner = await initTest();
    const member = await initTest(2);
    const stranger = await initTest(5);
    expect(
      (await owner.caller.calendar.getAll()).events.map((e) => [
        e.id,
        e.canDelete
      ])
    ).toEqual([
      [1, true],
      [2, true],
      [3, true]
    ]);
    expect(
      (await member.caller.calendar.getAll()).events.map((e) => [
        e.id,
        e.canDelete
      ])
    ).toEqual([
      [2, false],
      [3, false]
    ]);
    expect((await stranger.caller.calendar.getAll()).events).toEqual([]);
  });

  test('requires authentication for every operation', async () => {
    const { caller } = await getCaller(2, undefined, { authenticated: false });
    await expect(caller.calendar.getAll()).rejects.toThrow(
      'You must be authenticated'
    );
    await expect(caller.calendar.create(input)).rejects.toThrow(
      'You must be authenticated'
    );
    await expect(caller.calendar.delete({ eventId: 1 })).rejects.toThrow(
      'You must be authenticated'
    );
  });

  test('persists the event and deduplicated user and role invitations', async () => {
    const { caller } = await initTest();
    const event = await caller.calendar.create({
      ...input,
      targets: [...input.targets, input.targets[0]!]
    });
    expect(
      await tdb
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, event.id))
        .get()
    ).toMatchObject({
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      creatorId: 1
    });
    const invitees = await tdb
      .select()
      .from(calendarEventInvitees)
      .where(eq(calendarEventInvitees.eventId, event.id));
    expect(invitees).toHaveLength(2);
    expect(invitees.map((i) => [i.userId, i.roleId])).toEqual([
      [2, null],
      [null, 2]
    ]);
  });

  test('allows ordinary authenticated users to organize events', async () => {
    const { caller } = await initTest(2);
    const event = await caller.calendar.create(input);
    expect(event.creatorId).toBe(2);
  });

  for (const type of ['user', 'role'] as const) {
    test(`rejects nonexistent ${type} targets before writing`, async () => {
      const { caller } = await initTest();
      await expect(
        caller.calendar.create({ ...input, targets: [{ type, id: 999 }] })
      ).rejects.toThrow(
        type === 'user'
          ? 'One or more invited users no longer exist.'
          : 'One or more invited groups no longer exist.'
      );
      expect(await tdb.select().from(calendarEvents)).toHaveLength(3);
    });
  }

  test('rejects an end before or equal to its start', async () => {
    const { caller } = await initTest();
    for (const endsAt of [999, 1000]) {
      await expect(
        caller.calendar.create({ ...input, endsAt })
      ).rejects.toThrow('The event end time must be after the start time.');
    }
  });

  test('validates input bounds', async () => {
    const { caller } = await initTest();
    for (const invalid of [
      { title: ' ' },
      { title: 'x'.repeat(121) },
      { description: 'x'.repeat(2001) },
      { startsAt: 0 },
      { startsAt: 1.5 },
      { endsAt: 0 },
      { endsAt: 1.5 },
      { targets: [] },
      { targets: Array.from({ length: 101 }, () => input.targets[0]!) },
      { targets: [{ type: 'user' as const, id: 0 }] },
      { targets: [{ type: 'role' as const, id: 1.5 }] }
    ]) {
      await expect(
        caller.calendar.create({ ...input, ...invalid })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    await expect(caller.calendar.delete({ eventId: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST'
    });
  });

  test('rolls back event creation if invitation persistence fails', async () => {
    const { caller } = await initTest();
    tdb.run(
      sql`CREATE TEMP TRIGGER reject_calendar_invite BEFORE INSERT ON calendar_event_invitees BEGIN SELECT RAISE(ABORT, 'invite failure'); END`
    );
    await expect(caller.calendar.create(input)).rejects.toThrow();
    expect(await tdb.select().from(calendarEvents)).toHaveLength(3);
    expect(await tdb.select().from(calendarEventInvitees)).toHaveLength(2);
  });

  test('only the organizer can delete, and invitation rows cascade', async () => {
    const member = await initTest(2);
    await expect(member.caller.calendar.delete({ eventId: 2 })).rejects.toThrow(
      'Only the event organizer can delete this event.'
    );
    const owner = await initTest();
    await expect(
      owner.caller.calendar.delete({ eventId: 999 })
    ).rejects.toThrow('Event not found.');
    await owner.caller.calendar.delete({ eventId: 2 });
    expect(
      await tdb
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, 2))
        .get()
    ).toBeUndefined();
    expect(
      await tdb
        .select()
        .from(calendarEventInvitees)
        .where(eq(calendarEventInvitees.eventId, 2))
    ).toHaveLength(0);
  });
});

describe('calendar pagination and access', () => {
  test('paginates tied start times without duplicates or hidden events', async () => {
    const { caller } = await initTest(2);
    const first = await caller.calendar.getAll({ limit: 1 });
    expect(first.events.map((event) => event.id)).toEqual([2]);
    expect(first.nextCursor).toEqual({ startsAt: 200, id: 2 });
    const second = await caller.calendar.getAll({
      limit: 1,
      cursor: first.nextCursor
    });
    expect(second.events.map((event) => event.id)).toEqual([3]);
    expect(second.nextCursor).toBeUndefined();
    expect(
      (await caller.calendar.getAll({ cursor: { startsAt: 200, id: 3 } }))
        .events
    ).toEqual([]);
  });
  test('a cursor does not grant visibility and removed role membership revokes invitations', async () => {
    const stranger = await initTest(5);
    expect(
      (
        await stranger.caller.calendar.getAll({
          cursor: { startsAt: 1, id: 1 }
        })
      ).events
    ).toEqual([]);
    const { caller } = await initTest(2);
    await tdb.delete(userRoles).where(eq(userRoles.userId, 2));
    expect(
      (await caller.calendar.getAll()).events.map((event) => event.id)
    ).toEqual([2]);
  });
  test('does not reveal hidden events to a delete probe', async () => {
    const { caller } = await initTest(5);
    await expect(caller.calendar.delete({ eventId: 1 })).rejects.toThrow(
      'Event not found.'
    );
    expect(await tdb.select().from(calendarEvents)).toHaveLength(3);
  });
  test('bounds page size, cursor fields and timestamps', async () => {
    const { caller } = await initTest();
    for (const limit of [0, -1, 1.5, CALENDAR_PAGE_SIZE + 1]) {
      await expect(caller.calendar.getAll({ limit })).rejects.toMatchObject({
        code: 'BAD_REQUEST'
      });
    }
    for (const cursor of [
      { startsAt: 0, id: 1 },
      { startsAt: 1, id: 0 },
      { startsAt: 1.5, id: 1 },
      { startsAt: 1, id: 1.5 },
      { startsAt: MAX_CALENDAR_TIMESTAMP + 1, id: 1 }
    ]) {
      await expect(caller.calendar.getAll({ cursor })).rejects.toMatchObject({
        code: 'BAD_REQUEST'
      });
    }
    await expect(
      caller.calendar.create({ ...input, startsAt: MAX_CALENDAR_TIMESTAMP + 1 })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    const page = await caller.calendar.getAll({ limit: 2 });
    expect(page.events).toHaveLength(2);
    expect(page.nextCursor).toBeDefined();
  });
  test('rate limits reads without changing event visibility', async () => {
    const { caller } = await initTest(5);
    for (let i = 0; i < config.rateLimiters.calendarRead.maxRequests; i++)
      await caller.calendar.getAll();
    await expect(caller.calendar.getAll()).rejects.toThrow(
      'Too many requests. Please try again shortly.'
    );
  });
  test('rate limits writes before inserting another event', async () => {
    const { caller } = await initTest();
    for (let i = 0; i < config.rateLimiters.calendarWrite.maxRequests; i++)
      await caller.calendar.create(input);
    await expect(caller.calendar.create(input)).rejects.toThrow(
      'Too many requests. Please try again shortly.'
    );
    expect(await tdb.select().from(calendarEvents)).toHaveLength(
      3 + config.rateLimiters.calendarWrite.maxRequests
    );
  });
  test('rate limits repeated delete probes', async () => {
    const { caller } = await initTest(5);
    for (let i = 0; i < config.rateLimiters.calendarWrite.maxRequests; i++) {
      await expect(caller.calendar.delete({ eventId: 1 })).rejects.toThrow(
        'Event not found.'
      );
    }
    await expect(caller.calendar.delete({ eventId: 1 })).rejects.toThrow(
      'Too many requests. Please try again shortly.'
    );
  });
});

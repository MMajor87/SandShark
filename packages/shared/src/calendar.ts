import { z } from 'zod';

export const CALENDAR_PAGE_SIZE = 50;
export const MAX_CALENDAR_TIMESTAMP = 8_640_000_000_000_000;
export const zCalendarTime = z
  .number()
  .int()
  .positive()
  .max(MAX_CALENDAR_TIMESTAMP);
export const zCalendarTarget = z.object({
  type: z.enum(['user', 'role']),
  id: z.number().int().positive()
});
export const zCalendarCursor = z.object({
  startsAt: zCalendarTime,
  id: z.number().int().positive()
});

const zCalendarEventFields = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).optional(),
  startsAt: zCalendarTime,
  endsAt: zCalendarTime.optional(),
  targets: z.array(zCalendarTarget).min(1).max(100)
});

const endsAfterStart = (input: { startsAt: number; endsAt?: number }) =>
  input.endsAt === undefined || input.endsAt > input.startsAt;

const END_AFTER_START_ISSUE = {
  message: 'The event end time must be after the start time.',
  path: ['endsAt']
};

export const zCalendarEventInput = zCalendarEventFields.refine(
  endsAfterStart,
  END_AFTER_START_ISSUE
);

export const zCalendarEventUpdateInput = zCalendarEventFields
  .extend({ eventId: z.number().int().positive() })
  .refine(endsAfterStart, END_AFTER_START_ISSUE);

export enum CalendarResponseStatus {
  GOING = 'going',
  MAYBE = 'maybe',
  DECLINED = 'declined'
}

export const zCalendarResponseStatus = z.enum(CalendarResponseStatus);

export type TCalendarTarget = z.infer<typeof zCalendarTarget>;
export type TCalendarCursor = z.infer<typeof zCalendarCursor>;
export type TCalendarEventInput = z.infer<typeof zCalendarEventInput>;
export type TCalendarEventUpdateInput = z.infer<
  typeof zCalendarEventUpdateInput
>;
export type TCalendarResponseCounts = Record<CalendarResponseStatus, number>;
export type TCalendarInvitee = TCalendarTarget & { name: string };
export type TJoinedCalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  startsAt: number;
  endsAt: number | null;
  creatorId: number;
  creatorName: string;
  createdAt: number;
  updatedAt: number;
  canDelete: boolean;
  canEdit: boolean;
  invitees: TCalendarInvitee[];
  responseCounts: TCalendarResponseCounts;
  ownResponse: CalendarResponseStatus | null;
};

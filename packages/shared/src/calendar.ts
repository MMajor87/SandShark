import { z } from 'zod';

export const CALENDAR_PAGE_SIZE = 50;
export const MAX_CALENDAR_TIMESTAMP = 8_640_000_000_000_000;
const zCalendarTime = z.number().int().positive().max(MAX_CALENDAR_TIMESTAMP);
export const zCalendarTarget = z.object({
  type: z.enum(['user', 'role']),
  id: z.number().int().positive()
});
export const zCalendarCursor = z.object({
  startsAt: zCalendarTime,
  id: z.number().int().positive()
});
export const zCalendarEventInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).optional(),
    startsAt: zCalendarTime,
    endsAt: zCalendarTime.optional(),
    targets: z.array(zCalendarTarget).min(1).max(100)
  })
  .refine(
    (input) => input.endsAt === undefined || input.endsAt > input.startsAt,
    {
      message: 'The event end time must be after the start time.',
      path: ['endsAt']
    }
  );
export type TCalendarTarget = z.infer<typeof zCalendarTarget>;
export type TCalendarCursor = z.infer<typeof zCalendarCursor>;
export type TCalendarEventInput = z.infer<typeof zCalendarEventInput>;

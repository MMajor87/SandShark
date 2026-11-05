// the presets in index.css, under :root[data-accent=...]. each has a shade for light and one
// for dark mode, picked to stay readable on that background
export const ACCENTS = [
  'blue',
  'violet',
  'pink',
  'rose',
  'orange',
  'amber',
  'green',
  'teal',
  'slate'
] as const;

export type TAccent = (typeof ACCENTS)[number];

export const DEFAULT_ACCENT: TAccent = 'blue';

export const isAccent = (value: unknown): value is TAccent =>
  ACCENTS.includes(value as TAccent);

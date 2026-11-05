import type { TSettingsEntry } from './types';

// a settings form is dirty by value, not by identity: a toggle flipped back to its original state,
// or a rebuilt array holding the same members, counts as clean
const hasUnsavedChanges = (values: unknown, baseline: unknown) =>
  JSON.stringify(values) !== JSON.stringify(baseline);

// consecutive entries with the same group share one heading. an entry without a group gets
// none, which keeps the screens that never set one (channel and category settings) as they were
type TSettingsEntryGroup = {
  label: string | undefined;
  entries: TSettingsEntry[];
};

const groupSettingsEntries = (entries: TSettingsEntry[]) => {
  const groups: TSettingsEntryGroup[] = [];

  for (const entry of entries) {
    const last = groups.at(-1);

    if (last && last.label === entry.group) {
      last.entries.push(entry);
    } else {
      groups.push({ label: entry.group, entries: [entry] });
    }
  }

  return groups;
};

export { groupSettingsEntries, hasUnsavedChanges };

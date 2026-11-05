import { describe, expect, test } from 'bun:test';
import { Settings } from 'lucide-react';
import { groupSettingsEntries, hasUnsavedChanges } from '../helpers';
import type { TSettingsEntry } from '../types';

describe('hasUnsavedChanges', () => {
  test('should report a form matching its baseline as clean', () => {
    expect(hasUnsavedChanges({ name: 'general' }, { name: 'general' })).toBe(
      false
    );
  });

  test('should report an edited field as dirty', () => {
    expect(hasUnsavedChanges({ name: 'edited' }, { name: 'general' })).toBe(
      true
    );
  });

  // the save bar must disappear again when a toggle is flipped twice, so the comparison is by
  // value and never by object identity
  test('should report a toggle flipped back to its original state as clean', () => {
    const baseline = { enabled: false };
    const flipped = { ...baseline, enabled: true };
    const flippedBack = { ...flipped, enabled: false };

    expect(hasUnsavedChanges(flipped, baseline)).toBe(true);
    expect(hasUnsavedChanges(flippedBack, baseline)).toBe(false);
  });

  // role permissions and channel overrides hand back a rebuilt array on every toggle
  test('should compare arrays by their members, not by reference', () => {
    expect(
      hasUnsavedChanges({ permissions: [1, 2] }, { permissions: [1, 2] })
    ).toBe(false);
    expect(
      hasUnsavedChanges({ permissions: [2, 1] }, { permissions: [1, 2] })
    ).toBe(true);
  });

  // an untouched image is absent from the draft, picking one adds the key
  test('should treat an added optional key as dirty', () => {
    expect(
      hasUnsavedChanges({ bio: '', avatar: { fileId: 'a' } }, { bio: '' })
    ).toBe(true);
    expect(hasUnsavedChanges({ bio: '', avatar: undefined }, { bio: '' })).toBe(
      false
    );
  });
});

const entry = (id: string, group?: string): TSettingsEntry => ({
  id,
  label: id,
  icon: Settings,
  content: null,
  group
});

describe('groupSettingsEntries', () => {
  test('should put consecutive entries of a group under one heading', () => {
    const groups = groupSettingsEntries([
      entry('profile', 'Account'),
      entry('password', 'Account'),
      entry('appearance', 'App'),
      entry('plugin-1', 'Plugin settings')
    ]);

    expect(
      groups.map(({ label, entries }) => [label, entries.map(({ id }) => id)])
    ).toEqual([
      ['Account', ['profile', 'password']],
      ['App', ['appearance']],
      ['Plugin settings', ['plugin-1']]
    ]);
  });

  // channel and category settings set no groups, and must keep a single list with no heading
  test('should keep entries without a group together and unlabelled', () => {
    const groups = groupSettingsEntries([
      entry('general'),
      entry('permissions')
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBeUndefined();
    expect(groups[0]?.entries.map(({ id }) => id)).toEqual([
      'general',
      'permissions'
    ]);
  });

  test('should keep the order the entries were given in', () => {
    const groups = groupSettingsEntries([
      entry('a', 'One'),
      entry('b', 'Two'),
      entry('c', 'One')
    ]);

    expect(groups.map(({ label }) => label)).toEqual(['One', 'Two', 'One']);
  });

  test('should return no groups for no entries', () => {
    expect(groupSettingsEntries([])).toEqual([]);
  });
});

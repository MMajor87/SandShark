import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { getUpdateStatusText } from '../helpers';
import type { TDesktopUpdateStatus } from '../types';

// renders the key and its values, so a test can see which text was picked and with what
const t = ((key: string, values?: Record<string, unknown>) =>
  values
    ? `${key} ${JSON.stringify(values)}`
    : key) as unknown as TFunction<'settings'>;

const text = (status: TDesktopUpdateStatus) => getUpdateStatusText(status, t);

describe('getUpdateStatusText', () => {
  test('has a text for every state', () => {
    const states: TDesktopUpdateStatus['state'][] = [
      'idle',
      'checking',
      'available',
      'not-available',
      'downloading',
      'downloaded',
      'error',
      'unsupported'
    ];

    for (const state of states) {
      expect(text({ state })).toStartWith('updateState_');
    }
  });

  test('names the version that is available or downloaded', () => {
    expect(text({ state: 'available', version: '1.7.0' })).toBe(
      'updateState_available {"version":"1.7.0"}'
    );
    expect(text({ state: 'downloaded', version: '1.7.0' })).toBe(
      'updateState_downloaded {"version":"1.7.0"}'
    );
  });

  test('says unknown when the updater gave no version', () => {
    expect(text({ state: 'available' })).toBe(
      'updateState_available {"version":"desktopVersionUnknown"}'
    );
  });

  test('shows the download progress once the updater reports it', () => {
    expect(text({ state: 'downloading' })).toBe('updateState_downloading');
    expect(text({ state: 'downloading', percent: 42 })).toBe(
      'updateState_downloadingPercent {"percent":42}'
    );
  });

  // the updater's own message says why it failed or is unsupported, which beats a generic text
  test("prefers the updater's message for an error or an unsupported build", () => {
    expect(text({ state: 'error', message: 'Network down' })).toBe(
      'Network down'
    );
    expect(text({ state: 'unsupported', message: 'Portable build' })).toBe(
      'Portable build'
    );
    expect(text({ state: 'error' })).toBe('updateState_error');
  });

  test('ignores a message for the other states', () => {
    expect(text({ state: 'not-available', message: 'stale' })).toBe(
      'updateState_notAvailable'
    );
  });
});

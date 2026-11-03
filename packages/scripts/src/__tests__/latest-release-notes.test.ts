import { describe, expect, test } from 'bun:test';
import { getReleaseNotesSection } from '../latest-release-notes';

const notes = `# SandShark 1.2.0

- Adds a soundboard.

## Upgrade notes

Install this version manually.

# SandShark 1.1.7

- Renames old identifiers.

# SandShark 1.1.6

- Keeps audio out of screen shares.
`;

describe('getReleaseNotesSection', () => {
  test('should keep only the newest version, including its subsections', () => {
    expect(getReleaseNotesSection(notes)).toBe(`# SandShark 1.2.0

- Adds a soundboard.

## Upgrade notes

Install this version manually.
`);
  });

  test('should pick the section of a given version', () => {
    expect(getReleaseNotesSection(notes, '1.1.7')).toBe(
      '# SandShark 1.1.7\n\n- Renames old identifiers.\n'
    );
  });

  test('should not match a version that only shares a suffix', () => {
    expect(() => getReleaseNotesSection(notes, '1.6')).toThrow(
      'No release notes section found for 1.6.'
    );
  });

  test('should handle windows line endings', () => {
    const windowsNotes = notes.replace(/\n/g, '\r\n');

    expect(getReleaseNotesSection(windowsNotes, '1.1.6')).toBe(
      '# SandShark 1.1.6\n\n- Keeps audio out of screen shares.\n'
    );
  });

  test('should refuse notes without a version heading', () => {
    expect(() => getReleaseNotesSection('just text')).toThrow(
      'The release notes have no "# " section.'
    );
  });
});

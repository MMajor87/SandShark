import { describe, expect, test } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { ACCENTS, DEFAULT_ACCENT, isAccent } from '../accents';

const srcDir = path.resolve(import.meta.dir, '..', '..', '..');
const css = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf8');
const localesDir = path.join(srcDir, 'i18n', 'locales');

describe('accents', () => {
  // the list and the css presets are kept by hand in two places, so a preset added to one and
  // not the other would show a swatch with no color, or a color nobody can pick
  test('every accent has a preset in index.css, and every preset is listed', () => {
    const presets = [...css.matchAll(/\[data-accent='([a-z]+)'\]\s*\{/g)].map(
      ([, name]) => name
    );

    expect([...presets].sort()).toEqual([...ACCENTS].sort());

    for (const accent of ACCENTS) {
      const block = css.slice(css.indexOf(`[data-accent='${accent}']`));
      const body = block.slice(0, block.indexOf('}'));

      expect(body).toContain('--highlight-light:');
      expect(body).toContain('--highlight-dark:');
    }
  });

  test('every accent has a name in every language', () => {
    for (const locale of fs.readdirSync(localesDir)) {
      const settings = JSON.parse(
        fs.readFileSync(path.join(localesDir, locale, 'settings.json'), 'utf8')
      ) as Record<string, string>;

      for (const accent of ACCENTS) {
        expect(
          settings[`accent_${accent}`],
          `${locale} accent_${accent}`
        ).toBeTruthy();
      }
    }
  });

  test('accepts the presets and rejects anything else from storage', () => {
    expect(isAccent(DEFAULT_ACCENT)).toBe(true);
    expect(ACCENTS.every(isAccent)).toBe(true);
    expect(isAccent('neon')).toBe(false);
    expect(isAccent(null)).toBe(false);
    expect(isAccent(undefined)).toBe(false);
  });
});

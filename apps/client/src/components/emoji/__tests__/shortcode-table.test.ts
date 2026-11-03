import { describe, expect, test } from 'bun:test';
import committed from '../../../../../../packages/shared/src/statics/emoji-shortcodes.json';
import { buildEmojiShortcodeTable } from '../shortcode-table';

describe('emoji shortcode table', () => {
  // the server translates bot reactions with the committed copy, so a picker upgrade that
  // adds or renames emoji has to regenerate it with `bun run sync:emoji`
  test('the copy packages/shared ships matches the emoji set the picker uses', () => {
    expect(committed).toEqual(buildEmojiShortcodeTable());
  });
});

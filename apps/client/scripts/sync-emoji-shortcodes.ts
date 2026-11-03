import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildEmojiShortcodeTable } from '../src/components/emoji/shortcode-table';

// regenerates the table packages/shared ships, run after upgrading @tiptap/extension-emoji.
// one entry per line keeps an upgrade readable as a diff
const target = fileURLToPath(
  new URL(
    '../../../packages/shared/src/statics/emoji-shortcodes.json',
    import.meta.url
  )
);
const table = buildEmojiShortcodeTable();

writeFileSync(
  target,
  `[\n${table.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`
);

console.log(`Wrote ${table.length} emoji to ${target}`);

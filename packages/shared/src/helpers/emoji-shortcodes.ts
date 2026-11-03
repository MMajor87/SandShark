import table from '../statics/emoji-shortcodes.json' with { type: 'json' };

// each entry is the emoji character followed by its shortcodes, the first being the one the
// client stores when someone reacts with it
export type TEmojiShortcodeTable = [string, ...string[]][];

const VARIATION_SELECTOR = /️/g;

// discord sends some emoji with the variation selector and some without, so lookups ignore it
const normalize = (emoji: string) => emoji.replace(VARIATION_SELECTOR, '');

const shortcodeByEmoji = new Map<string, string>();
const emojiByShortcode = new Map<string, string>();

for (const [emoji, ...shortcodes] of table as TEmojiShortcodeTable) {
  shortcodeByEmoji.set(normalize(emoji), shortcodes[0]!);

  for (const shortcode of shortcodes) {
    emojiByShortcode.set(shortcode, emoji);
  }
}

// the shortcode a member's client would store for this character, if it knows one
export const emojiToShortcode = (emoji: string) =>
  shortcodeByEmoji.get(normalize(emoji));

// the character behind a stored shortcode, if it is a built in emoji
export const shortcodeToEmoji = (shortcode: string) =>
  emojiByShortcode.get(shortcode);

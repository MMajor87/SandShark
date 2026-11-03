import { describe, expect, test } from 'bun:test';
import { emojiToShortcode, shortcodeToEmoji } from '../emoji-shortcodes';

describe('emoji shortcodes', () => {
  test('a character maps to the shortcode the client reacts with', () => {
    expect(emojiToShortcode('👍')).toBe('+1');
    // the picker lists the long name first, so that is what members store
    expect(emojiToShortcode('😄')).toBe('grinning_face_with_closed_eyes');
    expect(shortcodeToEmoji('smile')).toBe('😄');
  });

  test('every shortcode alias maps back to the character', () => {
    for (const shortcode of ['+1', 'thumbsup', 'yes']) {
      expect(shortcodeToEmoji(shortcode)).toBe('👍');
    }
  });

  test('the variation selector does not change the lookup', () => {
    expect(emojiToShortcode('❤')).toBe(emojiToShortcode('❤️'));
    expect(emojiToShortcode('❤')).toBeDefined();
  });

  test('anything unknown stays unmapped', () => {
    expect(emojiToShortcode('not an emoji')).toBeUndefined();
    expect(shortcodeToEmoji('my_custom_emoji')).toBeUndefined();
  });
});

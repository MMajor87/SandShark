import type { TEmojiShortcodeTable } from '@sandshark/shared';
import { gitHubEmojis } from '@tiptap/extension-emoji';

// the table packages/shared ships so the server can translate between the shortcodes this
// client reacts with and the characters discord bots send. built from the same emoji set
// the picker uses, and a test fails when the committed copy drifts from it
export const buildEmojiShortcodeTable = (): TEmojiShortcodeTable =>
  gitHubEmojis
    .filter((emoji) => emoji.emoji && emoji.shortcodes.length > 0)
    .map(
      (emoji) => [emoji.emoji!, ...emoji.shortcodes] as [string, ...string[]]
    )
    .sort((a, b) => (a[1] < b[1] ? -1 : 1));

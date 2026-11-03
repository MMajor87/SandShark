import { emojiToShortcode } from '@sandshark/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { getReaction } from '../../db/queries/messages';
import { emojis } from '../../db/schema';
import { resolveEmojiSnowflake } from '../../helpers/discord/resolve';
import { callProcedure } from './call-procedure';
import { createBotCaller } from './context';
import { DiscordApiError, DiscordErrorCode } from './errors';
import { loadMessageId, loadVisibleChannel } from './helpers';
import { NO_CONTENT, type TBotRequest } from './types';

const CUSTOM_EMOJI = /^\w{2,32}:(\d{1,20})$/;

// discord names a custom emoji `name:id` and a built in one by its character. a built in
// one is stored as the shortcode a member's client uses, so a bot's 👍 and a member's
// count as the same reaction. a character the table does not know is kept as it is
const resolveReactionEmoji = async (emoji: string) => {
  const custom = CUSTOM_EMOJI.exec(emoji);

  if (!custom) return emojiToShortcode(emoji) ?? emoji;

  const emojiId = await resolveEmojiSnowflake(custom[1]!);
  const row =
    emojiId === undefined
      ? undefined
      : await db
          .select({ name: emojis.name })
          .from(emojis)
          .where(eq(emojis.id, emojiId))
          .limit(1)
          .get();

  if (!row) {
    throw new DiscordApiError(
      400,
      DiscordErrorCode.UNKNOWN_EMOJI,
      'Unknown Emoji'
    );
  }

  return row.name;
};

// the reaction procedure toggles, while discord's put and delete each name the state they
// want, so the current state is read first and the toggle only runs when it would differ
const setOwnReaction = async (
  { bot, info, params }: TBotRequest,
  present: boolean
) => {
  const channel = await loadVisibleChannel(bot.id, params.channelId!);
  const messageId = await loadMessageId(channel.id, params.messageId!);
  const emoji = await resolveReactionEmoji(params.emoji!);
  const existing = await getReaction(messageId, emoji, bot.id);

  if (!!existing === present) return NO_CONTENT;

  const caller = createBotCaller(bot, info);

  await callProcedure(
    () => caller.messages.toggleReaction({ messageId, emoji }),
    { code: DiscordErrorCode.UNKNOWN_MESSAGE, what: 'Message' }
  );

  return NO_CONTENT;
};

export { setOwnReaction };

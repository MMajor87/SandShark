import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { channels, emojis, users } from '../../db/schema';
import { roleSnowflake, type TGuildContext } from './guild';
import { collectMarkdownMentions, markdownToHtml } from './markdown';
import { decodeSnowflake, encodeSnowflake, SnowflakeTag } from './snowflake';

type TRow = { id: number; createdAt: number };

// keeps only the snowflakes that re-encode from a real row, so a forged id in a mention
// stays plain text instead of pointing at someone else
const verifiedById = <T extends TRow>(
  snowflakes: string[],
  tag: SnowflakeTag,
  rows: T[]
) => {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const result = new Map<string, T>();

  for (const snowflake of snowflakes) {
    const decoded = decodeSnowflake(snowflake);
    const row = decoded ? rowsById.get(decoded.idBits) : undefined;

    if (row && encodeSnowflake(tag, row.id, row.createdAt) === snowflake) {
      result.set(snowflake, row);
    }
  }

  return result;
};

const idBitsOf = (snowflakes: string[], tag: SnowflakeTag) =>
  snowflakes
    .map(decodeSnowflake)
    .filter((decoded) => decoded?.tag === tag)
    .map((decoded) => decoded!.idBits);

// turns the markdown a bot sends into the html a member's client would have produced. the
// result still goes through the send or edit procedure, which sanitizes it like any other
const toStoredHtml = async (markdown: string, guild: TGuildContext) => {
  const { userIds, roleIds, channelIds, emojiIds } =
    collectMarkdownMentions(markdown);
  const userBits = idBitsOf(userIds, SnowflakeTag.USER);
  const channelBits = idBitsOf(channelIds, SnowflakeTag.CHANNEL);
  const emojiBits = idBitsOf(emojiIds, SnowflakeTag.EMOJI);

  const [userRows, channelRows, emojiRows] = await Promise.all([
    userBits.length
      ? db
          .select({
            id: users.id,
            name: users.name,
            createdAt: users.createdAt
          })
          .from(users)
          .where(inArray(users.id, userBits))
      : [],
    channelBits.length
      ? db
          .select({ id: channels.id, createdAt: channels.createdAt })
          .from(channels)
          .where(inArray(channels.id, channelBits))
      : [],
    emojiBits.length
      ? db
          .select({
            id: emojis.id,
            name: emojis.name,
            createdAt: emojis.createdAt
          })
          .from(emojis)
          .where(inArray(emojis.id, emojiBits))
      : []
  ]);

  const rolesBySnowflake = new Map(
    guild.roles.map((role) => [roleSnowflake(role), role])
  );

  return markdownToHtml(markdown, {
    users: verifiedById(userIds, SnowflakeTag.USER, userRows),
    roles: new Map(
      roleIds
        .map((id) => [id, rolesBySnowflake.get(id)] as const)
        .filter(([, role]) => role !== undefined)
        .map(([id, role]) => [id, { id: role!.id, name: role!.name }])
    ),
    channels: verifiedById(channelIds, SnowflakeTag.CHANNEL, channelRows),
    emojis: verifiedById(emojiIds, SnowflakeTag.EMOJI, emojiRows)
  });
};

export { toStoredHtml };

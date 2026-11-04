import {
  getMentions,
  shortcodeToEmoji,
  type TFile,
  type TJoinedMessage,
  type TJoinedMessageReaction
} from '@sandshark/shared';
import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { getPublicUsers } from '../../db/queries/users';
import { channels, emojis, messages } from '../../db/schema';
import { channelSnowflake } from './channel';
import { serializeEmbed } from './embed';
import { roleSnowflake, type TGuildContext } from './guild';
import {
  collectHtmlMentions,
  htmlToMarkdown,
  type THtmlMentionLookups
} from './markdown';
import { encodeSnowflake, SnowflakeTag } from './snowflake';
import { serializeUser, userSnowflake, type TDiscordUserSource } from './user';

const DiscordMessageType = {
  DEFAULT: 0,
  REPLY: 19,
  CHAT_INPUT_COMMAND: 20
} as const;

const DiscordMessageFlag = {
  EPHEMERAL: 1 << 6,
  LOADING: 1 << 7
} as const;

type TMessageSerializeOptions = {
  guild: TGuildContext;
  botId: number;
  // the address the bot reached this server on, attachment urls must be absolute
  origin: string;
  // lets the bot download files from channels it can see without a session
  mediaToken: string;
};

const messageSnowflake = (message: { id: number; createdAt: number }) =>
  encodeSnowflake(SnowflakeTag.MESSAGE, message.id, message.createdAt);

const unique = <T>(values: T[]) => [...new Set(values)];

// everything a page of messages refers to, loaded in one round of queries instead of per
// message: authors, mentioned users, roles and channels, custom emoji and reply targets
const loadMessageLookups = async (page: TJoinedMessage[]) => {
  // mentions in embeds resolve like those in the content
  const mentions = page.map((message) =>
    collectHtmlMentions(
      [
        message.content ?? '',
        ...(message.embeds ?? []).flatMap((embed) => [
          embed.description ?? '',
          ...(embed.fields ?? []).map((field) => field.value)
        ])
      ].join('')
    )
  );
  const channelIds = unique([
    ...page.map((message) => message.channelId),
    ...mentions.flatMap((mention) => mention.channelIds)
  ]);
  const replyIds = unique(
    page
      .map((message) => message.replyToMessageId)
      .filter((id): id is number => id !== null)
  );

  const [users, channelRows, emojiRows, replyRows] = await Promise.all([
    getPublicUsers(),
    channelIds.length
      ? db
          .select({
            id: channels.id,
            createdAt: channels.createdAt,
            isDm: channels.isDm
          })
          .from(channels)
          .where(inArray(channels.id, channelIds))
      : [],
    db
      .select({ id: emojis.id, name: emojis.name, createdAt: emojis.createdAt })
      .from(emojis),
    replyIds.length
      ? db
          .select({
            id: messages.id,
            channelId: messages.channelId,
            createdAt: messages.createdAt
          })
          .from(messages)
          .where(inArray(messages.id, replyIds))
      : []
  ]);

  return {
    usersById: new Map(users.map((user) => [user.id, user])),
    channelsById: new Map(channelRows.map((channel) => [channel.id, channel])),
    emojisByName: new Map(emojiRows.map((emoji) => [emoji.name, emoji])),
    repliesById: new Map(replyRows.map((reply) => [reply.id, reply]))
  };
};

type TMessageLookups = Awaited<ReturnType<typeof loadMessageLookups>>;

const toHtmlLookups = (
  lookups: TMessageLookups,
  guild: TGuildContext
): THtmlMentionLookups => ({
  userSnowflakes: new Map(
    [...lookups.usersById.values()].map((user) => [
      user.id,
      userSnowflake(user)
    ])
  ),
  roleSnowflakes: new Map(
    guild.roles.map((role) => [role.id, roleSnowflake(role)])
  ),
  channelSnowflakes: new Map(
    [...lookups.channelsById.values()].map((channel) => [
      channel.id,
      channelSnowflake(channel)
    ])
  ),
  customEmojis: new Map(
    [...lookups.emojisByName.values()].map((emoji) => [
      emoji.name,
      encodeSnowflake(SnowflakeTag.EMOJI, emoji.id, emoji.createdAt)
    ])
  )
});

const fileUrl = (
  file: TFile,
  { origin, mediaToken }: TMessageSerializeOptions
) => {
  const params = new URLSearchParams({ mediaToken });

  if (file._accessToken && file._accessTokenExpiresAt) {
    params.set('accessToken', file._accessToken);
    params.set('expires', String(file._accessTokenExpiresAt));
  }

  return `${origin}/public/${encodeURIComponent(file.name)}?${params}`;
};

const serializeAttachment = (
  file: TFile,
  options: TMessageSerializeOptions
) => {
  const url = fileUrl(file, options);

  return {
    id: encodeSnowflake(SnowflakeTag.ATTACHMENT, file.id, file.createdAt),
    filename: file.originalName,
    size: file.size,
    url,
    proxy_url: url,
    content_type: file.mimeType
  };
};

// a reaction that carries a file is a custom emoji, named by its name. a built in one is
// stored as a shortcode, or as the character for older plugin and bot reactions, and
// discord names it by the character, so both forms are grouped under that character
const serializeReactions = (
  reactions: TJoinedMessageReaction[],
  lookups: TMessageLookups,
  botId: number
) => {
  const grouped = new Map<
    string,
    { count: number; me: boolean; customId: string | null }
  >();

  for (const reaction of reactions) {
    const isCustom = reaction.fileId !== null;
    const name = isCustom
      ? reaction.emoji
      : (shortcodeToEmoji(reaction.emoji) ?? reaction.emoji);
    const customEmoji = isCustom
      ? lookups.emojisByName.get(reaction.emoji)
      : undefined;
    const entry = grouped.get(name) ?? {
      count: 0,
      me: false,
      customId: customEmoji
        ? encodeSnowflake(
            SnowflakeTag.EMOJI,
            customEmoji.id,
            customEmoji.createdAt
          )
        : null
    };

    entry.count += 1;
    entry.me ||= reaction.userId === botId;
    grouped.set(name, entry);
  }

  return [...grouped.entries()].map(([name, { count, me, customId }]) => ({
    count,
    count_details: { burst: 0, normal: count },
    me,
    me_burst: false,
    burst_colors: [],
    emoji: { id: customId, name }
  }));
};

// an answer to a slash command is sent through the bot's interaction webhook, and the first
// one says who ran which command. the interaction row is gone after fifteen minutes, so the
// message itself stands in for its id from then on
const serializeInteractionFields = (
  message: TJoinedMessage,
  author: TDiscordUserSource | undefined,
  invoker: TDiscordUserSource | undefined,
  guildId: string | undefined
) => {
  if (
    message.interactionId === null &&
    message.interactionCommandName === null
  ) {
    return {};
  }

  const applicationId = author ? userSnowflake(author) : undefined;
  const fields = { webhook_id: applicationId, application_id: applicationId };

  if (message.interactionCommandName === null || !invoker) return fields;

  const id = encodeSnowflake(
    SnowflakeTag.INTERACTION,
    message.interactionId ?? message.id,
    message.createdAt
  );
  const user = serializeUser(invoker);

  return {
    ...fields,
    interaction_metadata: {
      id,
      type: 2,
      user,
      authorizing_integration_owners: guildId ? { '0': guildId } : {},
      name: message.interactionCommandName,
      command_type: 1
    },
    interaction: { id, type: 2, name: message.interactionCommandName, user }
  };
};

const serializeMessages = async (
  page: TJoinedMessage[],
  options: TMessageSerializeOptions
) => {
  const lookups = await loadMessageLookups(page);
  const htmlLookups = toHtmlLookups(lookups, options.guild);
  const rolesById = new Map(options.guild.roles.map((role) => [role.id, role]));

  return page.map((message) => {
    const author =
      message.userId === null
        ? undefined
        : lookups.usersById.get(message.userId);
    const channel = lookups.channelsById.get(message.channelId);
    const channelId = channel ? channelSnowflake(channel) : '0';
    const guildId = channel?.isDm ? undefined : options.guild.guildId;
    const { userIds, roleIds } = getMentions(message.content);
    const reply =
      message.replyToMessageId === null
        ? undefined
        : lookups.repliesById.get(message.replyToMessageId);
    const invoker =
      message.interactionUserId === null
        ? undefined
        : lookups.usersById.get(message.interactionUserId);
    let type: number = DiscordMessageType.DEFAULT;

    if (message.interactionCommandName !== null) {
      type = DiscordMessageType.CHAT_INPUT_COMMAND;
    } else if (reply) {
      type = DiscordMessageType.REPLY;
    }

    return {
      id: messageSnowflake(message),
      type,
      channel_id: channelId,
      ...(guildId ? { guild_id: guildId } : {}),
      author: author
        ? serializeUser(author)
        : {
            id: '0',
            username: 'Deleted',
            discriminator: '0',
            global_name: null,
            avatar: null
          },
      content: htmlToMarkdown(message.content ?? '', htmlLookups),
      timestamp: new Date(message.createdAt).toISOString(),
      edited_timestamp: message.editedAt
        ? new Date(message.editedAt).toISOString()
        : null,
      tts: false,
      mention_everyone: false,
      mentions: userIds
        .map((id) => lookups.usersById.get(id))
        .filter((user) => user !== undefined)
        .map(serializeUser),
      mention_roles: roleIds
        .map((id) => rolesById.get(id))
        .filter((role) => role !== undefined)
        .map(roleSnowflake),
      attachments: message.files.map((file) =>
        serializeAttachment(file, options)
      ),
      embeds: (message.embeds ?? []).map((embed) =>
        serializeEmbed(embed, htmlLookups)
      ),
      reactions: serializeReactions(message.reactions, lookups, options.botId),
      pinned: message.pinned ?? false,
      flags: message.loading ? DiscordMessageFlag.LOADING : 0,
      ...serializeInteractionFields(message, author, invoker, guildId),
      ...(reply
        ? {
            message_reference: {
              type: 0,
              message_id: messageSnowflake(reply),
              channel_id: channelId,
              ...(guildId ? { guild_id: guildId } : {})
            }
          }
        : {})
    };
  });
};

export {
  DiscordMessageFlag,
  DiscordMessageType,
  messageSnowflake,
  serializeMessages,
  type TMessageSerializeOptions
};

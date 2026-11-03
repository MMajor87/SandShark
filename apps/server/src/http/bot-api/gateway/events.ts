import {
  ServerEvents,
  shortcodeToEmoji,
  type TJoinedMessage,
  type TJoinedUser
} from '@sandshark/shared';
import type { Unsubscribable } from '@trpc/server/observable';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { categories, channels, emojis, messages } from '../../../db/schema';
import {
  channelSnowflake,
  serializeGuildChannel
} from '../../../helpers/discord/channel';
import { getGuildContext } from '../../../helpers/discord/guild';
import { serializeMember } from '../../../helpers/discord/member';
import {
  messageSnowflake,
  serializeMessages,
  type TMessageSerializeOptions
} from '../../../helpers/discord/message';
import {
  encodeSnowflake,
  SnowflakeTag
} from '../../../helpers/discord/snowflake';
import { serializeUser } from '../../../helpers/discord/user';
import { logger } from '../../../logger';
import { pubsub } from '../../../utils/pubsub';
import { presenceOf, type TKnownObjects } from './payloads';
import { GatewayIntent } from './protocol';

type TGatewaySessionApi = {
  bot: TJoinedUser;
  guildId: string;
  intents: number;
  known: TKnownObjects;
  serializeOptions: Omit<TMessageSerializeOptions, 'guild'>;
  dispatch: (event: string, data: unknown) => void;
};

const hasIntent = (session: TGatewaySessionApi, intent: number) =>
  (session.intents & intent) === intent;

// a channel the session never described is a dm, or one it has just been allowed to see
const describeChannel = async (
  session: TGatewaySessionApi,
  channelId: number
) => {
  const known = session.known.channels.get(channelId);

  if (known) return { id: known.id as string, guildId: session.guildId };

  const row = await db
    .select({
      id: channels.id,
      createdAt: channels.createdAt,
      isDm: channels.isDm
    })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1)
    .get();

  if (!row) return undefined;

  return {
    id: channelSnowflake(row),
    guildId: row.isDm ? undefined : session.guildId
  };
};

const withGuild = (guildId: string | undefined) =>
  guildId ? { guild_id: guildId } : {};

// without the message content intent discord blanks the content of guild messages that
// neither come from the bot nor mention it
const dispatchMessage = async (
  session: TGatewaySessionApi,
  event: 'MESSAGE_CREATE' | 'MESSAGE_UPDATE',
  message: TJoinedMessage
) => {
  // thread replies are not exposed to bots yet
  if (message.parentMessageId) return;

  const guild = await getGuildContext();
  const [serialized] = await serializeMessages([message], {
    ...session.serializeOptions,
    guild
  });

  if (!serialized) return;

  const isDm = !('guild_id' in serialized);
  const intent = isDm
    ? GatewayIntent.DIRECT_MESSAGES
    : GatewayIntent.GUILD_MESSAGES;

  if (!hasIntent(session, intent)) return;

  const botId = serializeUser(session.bot).id;
  const canReadContent =
    isDm ||
    hasIntent(session, GatewayIntent.MESSAGE_CONTENT) ||
    serialized.author.id === botId ||
    serialized.mentions.some((user) => user.id === botId);

  session.dispatch(
    event,
    canReadContent
      ? serialized
      : { ...serialized, content: '', attachments: [], embeds: [] }
  );
};

const reactionEmoji = async (emoji: string, custom: boolean) => {
  if (!custom) return { id: null, name: shortcodeToEmoji(emoji) ?? emoji };

  const row = await db
    .select({ id: emojis.id, createdAt: emojis.createdAt })
    .from(emojis)
    .where(eq(emojis.name, emoji))
    .limit(1)
    .get();

  return {
    id: row ? encodeSnowflake(SnowflakeTag.EMOJI, row.id, row.createdAt) : null,
    name: emoji
  };
};

const userIdOf = (session: TGatewaySessionApi, userId: number) => {
  const user = session.known.members.get(userId);

  return user ? user.id : undefined;
};

const memberUpdate = async (
  session: TGatewaySessionApi,
  event: 'GUILD_MEMBER_ADD' | 'GUILD_MEMBER_UPDATE',
  user: Parameters<typeof serializeMember>[0]
) => {
  const member = serializeMember(user, await getGuildContext());

  session.known.members.set(user.id, member.user);

  if (hasIntent(session, GatewayIntent.GUILD_MEMBERS)) {
    session.dispatch(event, { ...member, guild_id: session.guildId });
  }

  if (event === 'GUILD_MEMBER_UPDATE' && user.id === session.bot.id) {
    session.dispatch('USER_UPDATE', member.user);
  }
};

// every event a member would receive becomes the discord dispatch for it. targeted events
// are already filtered to what the bot can see by the publishers, the user events are
// server wide in sandshark as they are in a single guild
const bindGatewayEvents = (session: TGatewaySessionApi): Unsubscribable[] => {
  const botId = session.bot.id;
  const guarded =
    <T>(handler: (payload: T) => Promise<void> | void) =>
    (payload: T) => {
      Promise.resolve(handler(payload)).catch((error) =>
        logger.error('Bot gateway dispatch failed: %s', error)
      );
    };

  const subscriptions = [
    pubsub.subscribeFor(botId, ServerEvents.NEW_MESSAGE).subscribe({
      next: guarded((message) =>
        dispatchMessage(session, 'MESSAGE_CREATE', message)
      )
    }),
    pubsub.subscribeFor(botId, ServerEvents.MESSAGE_UPDATE).subscribe({
      next: guarded((message) =>
        dispatchMessage(session, 'MESSAGE_UPDATE', message)
      )
    }),
    pubsub.subscribeFor(botId, ServerEvents.MESSAGE_DELETE).subscribe({
      next: guarded(
        async ({ messageId, channelId, createdAt, parentMessageId }) => {
          if (parentMessageId) return;

          const channel = await describeChannel(session, channelId);

          if (!channel) return;

          const intent = channel.guildId
            ? GatewayIntent.GUILD_MESSAGES
            : GatewayIntent.DIRECT_MESSAGES;

          if (!hasIntent(session, intent)) return;

          session.dispatch('MESSAGE_DELETE', {
            id: messageSnowflake({ id: messageId, createdAt }),
            channel_id: channel.id,
            ...withGuild(channel.guildId)
          });
        }
      )
    }),
    pubsub.subscribeFor(botId, ServerEvents.MESSAGE_TYPING).subscribe({
      next: guarded(async ({ channelId, userId, parentMessageId }) => {
        const user = userIdOf(session, userId);

        if (parentMessageId || userId === botId || !user) return;

        const channel = await describeChannel(session, channelId);

        if (!channel) return;

        const intent = channel.guildId
          ? GatewayIntent.GUILD_MESSAGE_TYPING
          : GatewayIntent.DIRECT_MESSAGE_TYPING;

        if (!hasIntent(session, intent)) return;

        session.dispatch('TYPING_START', {
          channel_id: channel.id,
          ...withGuild(channel.guildId),
          user_id: user,
          timestamp: Math.floor(Date.now() / 1000)
        });
      })
    }),
    pubsub.subscribeFor(botId, ServerEvents.MESSAGE_REACTION_CHANGE).subscribe({
      next: guarded(
        async ({ messageId, channelId, userId, emoji, custom, added }) => {
          const [channel, message] = await Promise.all([
            describeChannel(session, channelId),
            db
              .select({ id: messages.id, createdAt: messages.createdAt })
              .from(messages)
              .where(eq(messages.id, messageId))
              .limit(1)
              .get()
          ]);
          const user = userIdOf(session, userId);

          if (!channel || !message || !user) return;

          const intent = channel.guildId
            ? GatewayIntent.GUILD_MESSAGE_REACTIONS
            : GatewayIntent.DIRECT_MESSAGE_REACTIONS;

          if (!hasIntent(session, intent)) return;

          session.dispatch(
            added ? 'MESSAGE_REACTION_ADD' : 'MESSAGE_REACTION_REMOVE',
            {
              user_id: user,
              channel_id: channel.id,
              message_id: messageSnowflake(message),
              ...withGuild(channel.guildId),
              emoji: await reactionEmoji(emoji, custom),
              burst: false,
              type: 0
            }
          );
        }
      )
    }),
    ...(['CHANNEL_CREATE', 'CHANNEL_UPDATE'] as const).map((event) =>
      pubsub.subscribeFor(botId, ServerEvents[event]).subscribe({
        next: guarded(async (channel) => {
          if (channel.isDm) return;

          const allCategories = await db.select().from(categories);
          const payload = serializeGuildChannel(
            channel,
            session.guildId,
            new Map(allCategories.map((category) => [category.id, category]))
          );

          session.known.channels.set(channel.id, payload);

          if (hasIntent(session, GatewayIntent.GUILDS)) {
            session.dispatch(event, payload);
          }
        })
      })
    ),
    pubsub.subscribeFor(botId, ServerEvents.CHANNEL_DELETE).subscribe({
      next: guarded((channelId) => {
        const payload = session.known.channels.get(channelId);

        if (!payload) return;

        session.known.channels.delete(channelId);

        if (hasIntent(session, GatewayIntent.GUILDS)) {
          session.dispatch('CHANNEL_DELETE', payload);
        }
      })
    }),
    pubsub.subscribe(ServerEvents.USER_JOIN).subscribe({
      next: guarded((user) => {
        if (user.id === botId) return;

        if (hasIntent(session, GatewayIntent.GUILD_PRESENCES)) {
          session.dispatch(
            'PRESENCE_UPDATE',
            presenceOf(serializeUser(user).id, session.guildId, 'online')
          );
        }
      })
    }),
    pubsub.subscribe(ServerEvents.USER_LEAVE).subscribe({
      next: guarded((userId) => {
        const user = userIdOf(session, userId);

        if (userId === botId || !user) return;

        if (hasIntent(session, GatewayIntent.GUILD_PRESENCES)) {
          session.dispatch(
            'PRESENCE_UPDATE',
            presenceOf(user, session.guildId, 'offline')
          );
        }
      })
    }),
    pubsub.subscribe(ServerEvents.USER_CREATE).subscribe({
      next: guarded((user) => memberUpdate(session, 'GUILD_MEMBER_ADD', user))
    }),
    pubsub.subscribe(ServerEvents.USER_UPDATE).subscribe({
      next: guarded((user) =>
        memberUpdate(session, 'GUILD_MEMBER_UPDATE', user)
      )
    }),
    pubsub.subscribe(ServerEvents.USER_DELETE).subscribe({
      next: guarded(({ userId }) => {
        const user = session.known.members.get(userId);

        if (!user) return;

        session.known.members.delete(userId);

        if (hasIntent(session, GatewayIntent.GUILD_MEMBERS)) {
          session.dispatch('GUILD_MEMBER_REMOVE', {
            guild_id: session.guildId,
            user
          });
        }
      })
    })
  ];

  return subscriptions;
};

export { bindGatewayEvents, type TGatewaySessionApi };

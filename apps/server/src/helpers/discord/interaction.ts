import { BotCommandOptionType, BotComponentType } from '@sandshark/shared';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { getMessage } from '../../db/queries/messages';
import { getPublicUsers } from '../../db/queries/users';
import { botEphemeralMessages, categories, channels } from '../../db/schema';
import type { TBotInteractionEvent, TInvocationOption } from '../../types';
import { getBotInteractionById } from '../bot-interactions';
import {
  channelSnowflake,
  serializeDmChannel,
  serializeGuildChannel
} from './channel';
import { commandSnowflake } from './command';
import { serializeEphemeralMessage } from './ephemeral';
import { getGuildContext, roleSnowflake, serializeRoles } from './guild';
import { memberPermissionBits, serializeMember } from './member';
import { serializeMessages, type TMessageSerializeOptions } from './message';
import { encodeSnowflake, SnowflakeTag } from './snowflake';
import { serializeUser, userSnowflake } from './user';

const DiscordInteractionType = {
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3
} as const;

const DiscordInteractionContext = {
  GUILD: 0,
  BOT_DM: 1
} as const;

// discord's upload limit for a bot without boosts, which the libraries read from here
const ATTACHMENT_SIZE_LIMIT = 8 * 1024 * 1024;

const interactionSnowflake = (interaction: { id: number; createdAt: number }) =>
  encodeSnowflake(
    SnowflakeTag.INTERACTION,
    interaction.id,
    interaction.createdAt
  );

type TReferencedIds = {
  users: Set<number>;
  roles: Set<number>;
  channels: Set<number>;
};

const MENTIONABLE = /^(user|role):(\d+)$/;

const collectReferences = (
  options: TInvocationOption[],
  ids: TReferencedIds
) => {
  for (const option of options) {
    if (option.options) collectReferences(option.options, ids);

    if (option.type === BotCommandOptionType.USER) {
      ids.users.add(option.value as number);
    } else if (option.type === BotCommandOptionType.ROLE) {
      ids.roles.add(option.value as number);
    } else if (option.type === BotCommandOptionType.CHANNEL) {
      ids.channels.add(option.value as number);
    } else if (option.type === BotCommandOptionType.MENTIONABLE) {
      const [, kind, id] = MENTIONABLE.exec(String(option.value)) ?? [];

      (kind === 'user' ? ids.users : ids.roles).add(Number(id));
    }
  }
};

// everything an interaction mentions, the invoker and the bot included, loaded in one go
const loadInteractionContext = async (event: TBotInteractionEvent) => {
  // what the options name, which is all that goes into resolved
  const referenced: TReferencedIds = {
    users: new Set(),
    roles: new Set(),
    channels: new Set()
  };

  if (event.kind === 'command') {
    collectReferences(event.options, referenced);
  } else {
    collectEntityValues(event.values, referenced);
  }

  const [guild, publicUsers, channelRows, categoryRows] = await Promise.all([
    getGuildContext(),
    getPublicUsers(),
    db
      .select()
      .from(channels)
      .where(inArray(channels.id, [event.channelId, ...referenced.channels]))
      .all(),
    db.select().from(categories).all()
  ]);

  return {
    guild,
    usersById: new Map(publicUsers.map((user) => [user.id, user])),
    channelsById: new Map(channelRows.map((row) => [row.id, row])),
    categoriesById: new Map(categoryRows.map((row) => [row.id, row])),
    referenced
  };
};

type TInteractionContext = Awaited<ReturnType<typeof loadInteractionContext>>;

const ENTITY_VALUE = /^(user|role|channel):(\d+)$/;

// what a server filled select menu sent, "user:5" and the like. a string select's values
// match nothing here
const collectEntityValues = (values: string[], ids: TReferencedIds) => {
  for (const value of values) {
    const [, kind, id] = ENTITY_VALUE.exec(value) ?? [];

    if (kind === 'user') ids.users.add(Number(id));
    else if (kind === 'role') ids.roles.add(Number(id));
    else if (kind === 'channel') ids.channels.add(Number(id));
  }
};

const entityValueSnowflake = (value: string, context: TInteractionContext) => {
  const [, kind, id] = ENTITY_VALUE.exec(value) ?? [];

  if (kind === 'user') return userSnowflake(context.usersById.get(Number(id))!);

  if (kind === 'channel') {
    return channelSnowflake(context.channelsById.get(Number(id))!);
  }

  return roleSnowflake(
    context.guild.roles.find((role) => role.id === Number(id))!
  );
};

const serializeOptionValue = (
  option: TInvocationOption,
  context: TInteractionContext
) => {
  const { usersById, channelsById, guild } = context;
  const rolesById = new Map(guild.roles.map((role) => [role.id, role]));

  switch (option.type) {
    case BotCommandOptionType.USER:
      return userSnowflake(usersById.get(option.value as number)!);
    case BotCommandOptionType.CHANNEL:
      return channelSnowflake(channelsById.get(option.value as number)!);
    case BotCommandOptionType.ROLE:
      return roleSnowflake(rolesById.get(option.value as number)!);
    case BotCommandOptionType.MENTIONABLE: {
      const [, kind, id] = MENTIONABLE.exec(String(option.value)) ?? [];

      if (kind === 'user') return userSnowflake(usersById.get(Number(id))!);

      return roleSnowflake(rolesById.get(Number(id))!);
    }
    default:
      return option.value;
  }
};

const serializeOptions = (
  options: TInvocationOption[],
  context: TInteractionContext
): unknown[] =>
  options.map((option) => {
    if (option.options) {
      return {
        name: option.name,
        type: option.type,
        options: serializeOptions(option.options, context)
      };
    }

    return {
      name: option.name,
      type: option.type,
      value: serializeOptionValue(option, context)
    };
  });

// the users, members, roles and channels the options name, keyed by snowflake, the way
// the libraries turn an option's id back into an object
const serializeResolved = (
  context: TInteractionContext,
  invokerBits: bigint
) => {
  const { guild, usersById, channelsById, categoriesById, referenced } =
    context;
  const resolved: Record<string, Record<string, unknown>> = {};

  for (const userId of referenced.users) {
    const user = usersById.get(userId);

    if (!user) continue;

    const snowflake = userSnowflake(user);
    // resolved members leave the user out, it is listed under resolved users
    const member: Record<string, unknown> = serializeMember(user, guild);

    delete member.user;

    resolved.users = { ...resolved.users, [snowflake]: serializeUser(user) };
    resolved.members = {
      ...resolved.members,
      [snowflake]: {
        ...member,
        permissions: memberPermissionBits(user, guild).toString()
      }
    };
  }

  if (referenced.roles.size > 0) {
    const rolesBySnowflake = new Map(
      serializeRoles(guild).map((role) => [role.id, role])
    );

    for (const row of guild.roles) {
      if (!referenced.roles.has(row.id)) continue;

      const snowflake = roleSnowflake(row);

      resolved.roles = {
        ...resolved.roles,
        [snowflake]: rolesBySnowflake.get(snowflake)
      };
    }
  }

  for (const channelId of referenced.channels) {
    const channel = channelsById.get(channelId);

    if (!channel || channel.isDm) continue;

    const serialized = serializeGuildChannel(
      channel,
      guild.guildId,
      categoriesById
    );

    resolved.channels = {
      ...resolved.channels,
      [serialized.id]: { ...serialized, permissions: invokerBits.toString() }
    };
  }

  return resolved;
};

// a command's data names the command and its options, a component's names the custom id
// and carries the message the component is on
const buildInteractionData = async (
  event: TBotInteractionEvent,
  context: TInteractionContext,
  invokerBits: bigint,
  options: TMessageSerializeOptions
) => {
  if (event.kind === 'component') {
    const message = await serializeComponentMessage(event, options);

    return {
      type: DiscordInteractionType.MESSAGE_COMPONENT,
      data: {
        custom_id: event.customId,
        component_type: event.componentType,
        ...componentValues(event, context, invokerBits)
      },
      ...(message ? { message } : {})
    };
  }

  const resolved = serializeResolved(context, invokerBits);

  return {
    type: DiscordInteractionType.APPLICATION_COMMAND,
    data: {
      id: commandSnowflake(event.command),
      name: event.command.name,
      type: event.command.type,
      ...(event.command.guildScoped ? { guild_id: context.guild.guildId } : {}),
      ...(event.options.length > 0
        ? { options: serializeOptions(event.options, context) }
        : {}),
      ...(Object.keys(resolved).length > 0 ? { resolved } : {})
    }
  };
};

// a string select sends its values as they are. a server filled one sends snowflakes and
// describes them in resolved, the way a command's options are
const componentValues = (
  event: Extract<TBotInteractionEvent, { kind: 'component' }>,
  context: TInteractionContext,
  invokerBits: bigint
) => {
  if (event.componentType === BotComponentType.BUTTON) return {};

  if (event.componentType === BotComponentType.STRING_SELECT) {
    return { values: event.values };
  }

  return {
    values: event.values.map((value) => entityValueSnowflake(value, context)),
    resolved: serializeResolved(context, invokerBits)
  };
};

// the message a button or select menu was used on, as the bot sees it
const serializeComponentMessage = async (
  event: Extract<TBotInteractionEvent, { kind: 'component' }>,
  options: TMessageSerializeOptions
) => {
  if (event.messageId !== null) {
    const message = await getMessage(event.messageId);

    if (!message) return undefined;

    const [serialized] = await serializeMessages([message], options);

    return serialized;
  }

  if (event.ephemeralMessageId === null) return undefined;

  const row = db
    .select()
    .from(botEphemeralMessages)
    .where(eq(botEphemeralMessages.id, event.ephemeralMessageId))
    .limit(1)
    .get();
  const owner = row ? getBotInteractionById(row.interactionId) : undefined;

  return row && owner
    ? serializeEphemeralMessage(row, owner, options)
    : undefined;
};

// the INTERACTION_CREATE a bot's gateway session sends for a slash command or a button or
// select menu. in a dm there is no guild or member, only the user, as on discord
const buildInteractionPayload = async (
  event: TBotInteractionEvent,
  botId: number,
  serializeOptions: Omit<TMessageSerializeOptions, 'guild'>
) => {
  const context = await loadInteractionContext(event);
  const { guild, usersById, channelsById, categoriesById } = context;
  const invoker = usersById.get(event.userId);
  const botUser = usersById.get(botId);
  const channel = channelsById.get(event.channelId);

  if (!invoker || !botUser || !channel) return undefined;

  const applicationId = userSnowflake(botUser);
  const invokerBits = memberPermissionBits(invoker, guild);
  const interactionData = await buildInteractionData(
    event,
    context,
    invokerBits,
    { ...serializeOptions, guild }
  );

  const base = {
    id: interactionSnowflake({
      id: event.interactionId,
      createdAt: event.createdAt
    }),
    application_id: applicationId,
    ...interactionData,
    channel_id: channelSnowflake(channel),
    token: event.token,
    version: 1,
    app_permissions: memberPermissionBits(botUser, guild).toString(),
    locale: 'en-US',
    entitlements: [],
    attachment_size_limit: ATTACHMENT_SIZE_LIMIT
  };

  if (channel.isDm) {
    return {
      ...base,
      channel: serializeDmChannel(channel, invoker),
      user: serializeUser(invoker),
      authorizing_integration_owners: { '1': userSnowflake(invoker) },
      context: DiscordInteractionContext.BOT_DM
    };
  }

  return {
    ...base,
    guild_id: guild.guildId,
    guild: { id: guild.guildId, locale: 'en-US', features: [] },
    guild_locale: 'en-US',
    channel: {
      ...serializeGuildChannel(channel, guild.guildId, categoriesById),
      permissions: invokerBits.toString()
    },
    member: {
      ...serializeMember(invoker, guild),
      permissions: invokerBits.toString()
    },
    authorizing_integration_owners: { '0': guild.guildId },
    context: DiscordInteractionContext.GUILD
  };
};

export { buildInteractionPayload, interactionSnowflake };

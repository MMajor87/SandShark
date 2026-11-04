import {
  BotCommandOptionType,
  ChannelType,
  type TBotCommandOption,
  type TChannel
} from '@sandshark/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import { getChannelsForUser } from '../db/queries/channels';
import { roles, users } from '../db/schema';
import type { TInvocationOption } from '../types';
import { invariant } from '../utils/invariant';
import { DiscordChannelType } from './discord/channel';
import type { TBotCommandRow } from './discord/command';

type TInvocationValue = string | number | boolean;

type TInvocationInput = {
  // the subcommand group and subcommand chosen, outermost first
  subcommand: string[];
  values: Record<string, TInvocationValue>;
};

type TCollectedIds = {
  users: Set<number>;
  roles: Set<number>;
  channels: Map<number, number[] | undefined>;
};

const isSubcommandLevel = (options: TBotCommandOption[]) =>
  options.some(
    (option) =>
      option.type === BotCommandOptionType.SUB_COMMAND ||
      option.type === BotCommandOptionType.SUB_COMMAND_GROUP
  );

// follows the chosen subcommand path down to the options the member fills in
const selectLeaf = (command: TBotCommandRow, path: string[]) => {
  let options = command.options;
  const chain: TBotCommandOption[] = [];

  for (const name of path) {
    const next = options.find(
      (option) =>
        option.name === name &&
        (option.type === BotCommandOptionType.SUB_COMMAND ||
          option.type === BotCommandOptionType.SUB_COMMAND_GROUP)
    );

    invariant(next, {
      code: 'BAD_REQUEST',
      message: `This command has no "${name}" subcommand.`
    });

    chain.push(next);
    options = next.options ?? [];
  }

  invariant(!isSubcommandLevel(options), {
    code: 'BAD_REQUEST',
    message: 'Pick a subcommand to run.'
  });

  return { chain, leafOptions: options };
};

const asId = (value: TInvocationValue, label: string) => {
  invariant(typeof value === 'number' && Number.isInteger(value), {
    code: 'BAD_REQUEST',
    message: `Pick a ${label}.`
  });

  return value;
};

// checks one filled in value against its definition, as discord does before the bot ever
// sees it, and notes the users, roles and channels that still have to be looked up
const checkValue = (
  option: TBotCommandOption,
  value: TInvocationValue,
  ids: TCollectedIds
): TInvocationValue => {
  const { name } = option;

  if (option.choices) {
    invariant(
      option.choices.some((choice) => choice.value === value),
      { code: 'BAD_REQUEST', message: `Pick one of the choices for "${name}".` }
    );
  }

  switch (option.type) {
    case BotCommandOptionType.STRING:
      invariant(typeof value === 'string', {
        code: 'BAD_REQUEST',
        message: `"${name}" has to be text.`
      });

      invariant(
        value.length >= (option.minLength ?? 0) &&
          value.length <= (option.maxLength ?? 6_000),
        { code: 'BAD_REQUEST', message: `"${name}" is too short or too long.` }
      );

      return value;
    case BotCommandOptionType.INTEGER:
    case BotCommandOptionType.NUMBER: {
      const isInteger = option.type === BotCommandOptionType.INTEGER;

      invariant(
        typeof value === 'number' &&
          Number.isFinite(value) &&
          (!isInteger || Number.isInteger(value)),
        {
          code: 'BAD_REQUEST',
          message: `"${name}" has to be ${isInteger ? 'a whole number' : 'a number'}.`
        }
      );

      invariant(
        value >= (option.minValue ?? -Infinity) &&
          value <= (option.maxValue ?? Infinity),
        { code: 'BAD_REQUEST', message: `"${name}" is out of range.` }
      );

      return value;
    }
    case BotCommandOptionType.BOOLEAN:
      invariant(typeof value === 'boolean', {
        code: 'BAD_REQUEST',
        message: `"${name}" has to be yes or no.`
      });

      return value;
    case BotCommandOptionType.USER:
      ids.users.add(asId(value, 'member'));

      return value;
    case BotCommandOptionType.ROLE:
      ids.roles.add(asId(value, 'role'));

      return value;
    case BotCommandOptionType.CHANNEL:
      ids.channels.set(asId(value, 'channel'), option.channelTypes);

      return value;
    case BotCommandOptionType.MENTIONABLE: {
      // a mentionable is either kind, so the client says which
      const match =
        typeof value === 'string' ? /^(user|role):(\d+)$/.exec(value) : null;

      invariant(match, {
        code: 'BAD_REQUEST',
        message: `Pick a member or a role for "${name}".`
      });

      const id = Number(match[2]);

      (match[1] === 'user' ? ids.users : ids.roles).add(id);

      return value;
    }
    default:
      // attachments: bots cannot be handed a member's file yet
      invariant(false, {
        code: 'BAD_REQUEST',
        message: `SandShark can't fill in "${name}" for a bot yet.`
      });
  }
};

const discordTypeOf = (channel: TChannel): number => {
  if (channel.isDm) return DiscordChannelType.DM;

  if (channel.type === ChannelType.VOICE) return DiscordChannelType.GUILD_VOICE;

  return DiscordChannelType.GUILD_TEXT;
};

// one query per kind of object, however many options name them
const assertReferencesExist = async (ids: TCollectedIds, invokerId: number) => {
  const [userRows, roleRows, visibleChannels] = await Promise.all([
    ids.users.size
      ? db
          .select({ id: users.id })
          .from(users)
          .where(
            and(inArray(users.id, [...ids.users]), eq(users.banned, false))
          )
          .all()
      : [],
    ids.roles.size
      ? db
          .select({ id: roles.id })
          .from(roles)
          .where(inArray(roles.id, [...ids.roles]))
          .all()
      : [],
    ids.channels.size ? getChannelsForUser(invokerId) : []
  ]);

  invariant(userRows.length === ids.users.size, {
    code: 'BAD_REQUEST',
    message: 'That member could not be found.'
  });

  invariant(roleRows.length === ids.roles.size, {
    code: 'BAD_REQUEST',
    message: 'That role could not be found.'
  });

  const channelsById = new Map(visibleChannels.map((row) => [row.id, row]));

  for (const [channelId, allowedTypes] of ids.channels) {
    const channel = channelsById.get(channelId);

    // a channel the member cannot see reads as missing, so nothing about it leaks
    invariant(channel, {
      code: 'BAD_REQUEST',
      message: 'That channel could not be found.'
    });

    invariant(!allowedTypes || allowedTypes.includes(discordTypeOf(channel)), {
      code: 'BAD_REQUEST',
      message: 'That kind of channel is not allowed here.'
    });
  }
};

// turns what the member filled in into discord's nested option list, refusing anything
// discord would refuse. returns the full name the command was run under ("config set")
const resolveInvocation = async (
  command: TBotCommandRow,
  { subcommand, values }: TInvocationInput,
  invokerId: number
) => {
  const { chain, leafOptions } = selectLeaf(command, subcommand);
  const known = new Set(leafOptions.map(({ name }) => name));

  for (const name of Object.keys(values)) {
    invariant(known.has(name), {
      code: 'BAD_REQUEST',
      message: `This command has no "${name}" option.`
    });
  }

  const ids: TCollectedIds = {
    users: new Set(),
    roles: new Set(),
    channels: new Map()
  };
  const leaves: TInvocationOption[] = [];

  for (const option of leafOptions) {
    const value = values[option.name];

    if (value === undefined || value === '') {
      invariant(!option.required, {
        code: 'BAD_REQUEST',
        message: `Fill in "${option.name}".`
      });

      continue;
    }

    leaves.push({
      name: option.name,
      type: option.type,
      value: checkValue(option, value, ids)
    });
  }

  await assertReferencesExist(ids, invokerId);

  const options = chain.reduceRight<TInvocationOption[]>(
    (inner, level) => [{ name: level.name, type: level.type, options: inner }],
    leaves
  );

  return {
    options,
    commandName: [command.name, ...chain.map(({ name }) => name)].join(' ')
  };
};

// the options of a command a member is still filling in, for the bot to suggest values for
// the focused one. nothing is required yet and nothing is looked up: the focused value is
// sent as typed, the other text, number and yes or no values as far as they are filled in
const buildAutocompleteOptions = (
  command: TBotCommandRow,
  { subcommand, values }: TInvocationInput,
  focused: string
) => {
  const { chain, leafOptions } = selectLeaf(command, subcommand);
  const focusedOption = leafOptions.find((option) => option.name === focused);

  invariant(focusedOption?.autocomplete, {
    code: 'BAD_REQUEST',
    message: 'This option has no suggestions.'
  });

  const leaves: TInvocationOption[] = [];

  for (const option of leafOptions) {
    const value = values[option.name];

    if (option.name === focused) {
      leaves.push({
        name: option.name,
        type: option.type,
        value: String(value ?? ''),
        focused: true
      });
    } else if (value !== undefined && value !== '' && isPlainValue(option)) {
      leaves.push({ name: option.name, type: option.type, value });
    }
  }

  return chain.reduceRight<TInvocationOption[]>(
    (inner, level) => [{ name: level.name, type: level.type, options: inner }],
    leaves
  );
};

const isPlainValue = (option: TBotCommandOption) =>
  option.type === BotCommandOptionType.STRING ||
  option.type === BotCommandOptionType.INTEGER ||
  option.type === BotCommandOptionType.NUMBER ||
  option.type === BotCommandOptionType.BOOLEAN;

export {
  assertReferencesExist,
  buildAutocompleteOptions,
  resolveInvocation,
  type TCollectedIds,
  type TInvocationInput
};

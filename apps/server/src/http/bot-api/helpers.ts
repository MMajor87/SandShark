import {
  DELETED_USER_IDENTITY_AND_NAME,
  type TJoinedMessage
} from '@sandshark/shared';
import type http from 'http';
import { getBotCommandById } from '../../db/queries/bot-commands';
import { getChannelsForUser } from '../../db/queries/channels';
import { getPublicUsers } from '../../db/queries/users';
import {
  getGuildContext,
  type TGuildContext
} from '../../helpers/discord/guild';
import { serializeMessages } from '../../helpers/discord/message';
import {
  resolveChannelSnowflake,
  resolveCommandSnowflake,
  resolveMessageSnowflake
} from '../../helpers/discord/resolve';
import { userSnowflake } from '../../helpers/discord/user';
import { createMediaAccessToken } from '../../helpers/media-access-token';
import { getTextBody } from '../helpers';
import { DiscordApiError, DiscordErrorCode, notFound } from './errors';
import type { TBotRequest } from './types';

// every guild route names the guild, and there is only the one
const loadGuild = async (guildId: string | undefined) => {
  const guild = await getGuildContext();

  if (guildId !== guild.guildId) {
    throw notFound(DiscordErrorCode.UNKNOWN_GUILD, 'Guild');
  }

  return guild;
};

// the deleted user placeholder and banned accounts are not members in discord terms
const getGuildMembers = async () => {
  const users = await getPublicUsers();

  return users
    .filter(
      (user) => !user.banned && user.name !== DELETED_USER_IDENTITY_AND_NAME
    )
    .sort((a, b) => a.id - b.id);
};

// a channel the bot cannot see reads as unknown, never as forbidden, so a probe cannot
// tell a hidden channel from one that does not exist
const loadVisibleChannel = async (botId: number, snowflake: string) => {
  const channelId = await resolveChannelSnowflake(snowflake);
  const visibleChannels =
    channelId === undefined ? [] : await getChannelsForUser(botId);
  const channel = visibleChannels.find(({ id }) => id === channelId);

  if (!channel) {
    throw notFound(DiscordErrorCode.UNKNOWN_CHANNEL, 'Channel');
  }

  return channel;
};

const loadMessageId = async (channelId: number, snowflake: string) => {
  const messageId = await resolveMessageSnowflake(snowflake, channelId);

  if (messageId === undefined) {
    throw notFound(DiscordErrorCode.UNKNOWN_MESSAGE, 'Message');
  }

  return messageId;
};

const invalidFormBody = (message = 'Invalid Form Body') =>
  new DiscordApiError(400, DiscordErrorCode.INVALID_FORM_BODY, message);

// a json string, which is skipped as it is, or an integer too long for a javascript number
const STRING_OR_LONG_INTEGER = /"(?:[^"\\]|\\.)*"|-?\d{16,}/g;

// discord accepts snowflakes as strings or numbers and discord.py sends numbers, which
// JSON.parse would round to a different id, so long integers are quoted before parsing
const quoteLongIntegers = (text: string) =>
  text.replace(STRING_OR_LONG_INTEGER, (token) =>
    token.startsWith('"') ? token : `"${token}"`
  );

// multipart uploads are not supported yet, so anything but json is refused
const readJsonValue = async (req: http.IncomingMessage): Promise<unknown> => {
  const contentType = req.headers['content-type'] ?? '';

  if (!contentType.startsWith('application/json')) {
    throw invalidFormBody('Only application/json bodies are supported.');
  }

  try {
    const text = await getTextBody(req);

    return text ? JSON.parse(quoteLongIntegers(text)) : {};
  } catch {
    throw invalidFormBody();
  }
};

const readJsonBody = async (req: http.IncomingMessage) => {
  const body = await readJsonValue(req);

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalidFormBody();
  }

  return body as Record<string, unknown>;
};

// the bulk overwrite of a bot's commands sends a bare array
const readJsonArray = async (req: http.IncomingMessage) => {
  const body = await readJsonValue(req);

  if (!Array.isArray(body)) throw invalidFormBody();

  return body as unknown[];
};

// a bot is its own application, so the application in the path has to be the bot itself.
// a path naming a guild makes it the guild scoped list, which on a single guild server is a
// second list of the same commands
const loadCommandScope = async ({ bot, params }: TBotRequest) => {
  const applicationId = userSnowflake(bot);

  if (params.applicationId !== applicationId) {
    throw new DiscordApiError(
      403,
      DiscordErrorCode.MISSING_ACCESS,
      'Missing Access'
    );
  }

  const guildScoped = params.guildId !== undefined;
  const guild = guildScoped
    ? await loadGuild(params.guildId)
    : await getGuildContext();

  return {
    scope: { botId: bot.id, guildScoped },
    context: { applicationId, guildId: guild.guildId }
  };
};

const loadOwnCommand = async (
  { botId, guildScoped }: { botId: number; guildScoped: boolean },
  snowflake: string
) => {
  const commandId = await resolveCommandSnowflake(snowflake);
  const command =
    commandId === undefined
      ? undefined
      : await getBotCommandById(botId, guildScoped, commandId);

  if (!command) {
    throw notFound(
      DiscordErrorCode.UNKNOWN_APPLICATION_COMMAND,
      'application command'
    );
  }

  return command;
};

const messageSerializeOptions = (
  { bot, origin }: TBotRequest,
  guild: TGuildContext
) => ({
  guild,
  botId: bot.id,
  origin,
  mediaToken: createMediaAccessToken(bot.id, bot.tokenVersion)
});

const serializeForBot = (
  request: TBotRequest,
  guild: TGuildContext,
  page: TJoinedMessage[]
) => serializeMessages(page, messageSerializeOptions(request, guild));

export {
  getGuildMembers,
  invalidFormBody,
  loadCommandScope,
  loadGuild,
  loadMessageId,
  loadOwnCommand,
  loadVisibleChannel,
  messageSerializeOptions,
  readJsonArray,
  readJsonBody,
  serializeForBot
};

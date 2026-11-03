import {
  DELETED_USER_IDENTITY_AND_NAME,
  type TJoinedMessage
} from '@sandshark/shared';
import type http from 'http';
import { getChannelsForUser } from '../../db/queries/channels';
import { getPublicUsers } from '../../db/queries/users';
import {
  getGuildContext,
  type TGuildContext
} from '../../helpers/discord/guild';
import { serializeMessages } from '../../helpers/discord/message';
import {
  resolveChannelSnowflake,
  resolveMessageSnowflake
} from '../../helpers/discord/resolve';
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

// multipart uploads are not supported yet, so anything but a json object is refused
const readJsonBody = async (req: http.IncomingMessage) => {
  const contentType = req.headers['content-type'] ?? '';

  if (!contentType.startsWith('application/json')) {
    throw invalidFormBody('Only application/json bodies are supported.');
  }

  try {
    const text = await getTextBody(req);
    const body: unknown = text ? JSON.parse(quoteLongIntegers(text)) : {};

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw invalidFormBody();
    }

    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof DiscordApiError) throw error;

    throw invalidFormBody();
  }
};

const serializeForBot = (
  { bot, origin }: TBotRequest,
  guild: TGuildContext,
  page: TJoinedMessage[]
) =>
  serializeMessages(page, {
    guild,
    botId: bot.id,
    origin,
    mediaToken: createMediaAccessToken(bot.id, bot.tokenVersion)
  });

export {
  getGuildMembers,
  invalidFormBody,
  loadGuild,
  loadMessageId,
  loadVisibleChannel,
  readJsonBody,
  serializeForBot
};

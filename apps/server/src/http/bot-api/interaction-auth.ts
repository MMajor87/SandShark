import { getUserById } from '../../db/queries/users';
import {
  getBotInteractionByToken,
  isTokenAlive,
  isWithinResponseWindow
} from '../../helpers/bot-interactions';
import { interactionSnowflake } from '../../helpers/discord/interaction';
import { userSnowflake } from '../../helpers/discord/user';
import { alreadyAcknowledged, DiscordErrorCode, notFound } from './errors';

// the interaction endpoints carry no bot token: discord.js and discord.py call them
// without one, the token in the path is the credential. the callback has to come within
// the response window and once only, the webhook routes for as long as the token lives
// and only after that first answer
const authenticateInteraction = async (params: Record<string, string>) => {
  const isCallback = params.interactionId !== undefined;
  const unknown = isCallback
    ? notFound(DiscordErrorCode.UNKNOWN_INTERACTION, 'interaction')
    : notFound(DiscordErrorCode.UNKNOWN_WEBHOOK, 'Webhook');
  const interaction = await getBotInteractionByToken(params.token!);

  if (!interaction) throw unknown;

  if (isCallback) {
    if (interactionSnowflake(interaction) !== params.interactionId) {
      throw unknown;
    }

    if (interaction.responded) throw alreadyAcknowledged();

    if (!isWithinResponseWindow(interaction)) throw unknown;
  } else if (!interaction.responded || !isTokenAlive(interaction)) {
    throw unknown;
  }

  const bot = await getUserById(interaction.botId);

  if (!bot || !bot.isBot || bot.banned) throw unknown;

  if (!isCallback && params.applicationId !== userSnowflake(bot)) {
    throw unknown;
  }

  return { interaction, bot };
};

export { authenticateInteraction };

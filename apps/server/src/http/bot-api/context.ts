import {
  DEFAULT_LOCALE,
  type TBotActionRow,
  type TJoinedUser,
  type TMessageEmbed
} from '@sandshark/shared';
import { createPermissionChecks } from '../../helpers/create-permission-checks';
import { appRouter } from '../../routers';
import type { TConnectionInfo } from '../../types';
import { pubsub } from '../../utils/pubsub';
import type { Context, TBotInteractionContext } from '../../utils/trpc';
import {
  getUserStatus,
  getUserWs,
  throwValidationError
} from '../../utils/wss';

// a request context for the bot user, so a bot write goes through the very procedure a
// member's would: the same permission checks, sanitizing, plugin hooks, rate limits and
// realtime publishes. a bot has no socket of its own here, the gateway owns that
type TBotCallerExtras = {
  // the slash command interaction this write answers
  interaction?: TBotInteractionContext;
  // the embeds of the message this write sends or edits
  embeds?: TMessageEmbed[];
  // its buttons and select menus
  components?: TBotActionRow[];
};

const createBotCaller = (
  bot: TJoinedUser,
  info: TConnectionInfo | undefined,
  { interaction, embeds, components }: TBotCallerExtras = {}
) => {
  const ctx: Context = {
    pubsub,
    token: '',
    user: bot,
    authenticated: true,
    userId: bot.id,
    handshakeHash: '',
    currentVoiceChannelId: undefined,
    locale: DEFAULT_LOCALE,
    ...createPermissionChecks(bot.id),
    getOwnWs: () => undefined,
    getStatusById: getUserStatus,
    setWsUserId: () => {},
    getUserWs,
    getConnectionInfo: () => info,
    throwValidationError,
    saveUserIp: async () => {},
    botInteraction: interaction,
    botEmbeds: embeds,
    botComponents: components
  };

  return appRouter.createCaller(ctx);
};

type TBotCaller = ReturnType<typeof createBotCaller>;

export { createBotCaller, type TBotCaller };

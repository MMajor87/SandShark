import { serializeUser } from '../../../helpers/discord/user';
import type { TBotRouteHandler } from '../types';

const getCurrentUserRoute: TBotRouteHandler = async ({ bot }) => ({
  ...serializeUser(bot),
  verified: true,
  mfa_enabled: false,
  locale: 'en-US'
});

export { getCurrentUserRoute };

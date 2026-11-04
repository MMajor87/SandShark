import {
  describeRestCall,
  recordUnsupportedCall
} from '../../../helpers/bot-compat-report';
import type { TBotRouteHandler } from '../types';

// a list this server has nothing to fill with yet, which bots fetch while starting and
// would crash on if refused. it is answered empty, and still shows in the bot's report
const stubbedEmptyListRoute: TBotRouteHandler = async ({ bot, req, url }) => {
  recordUnsupportedCall(
    bot.id,
    describeRestCall(
      req.method ?? 'GET',
      url.pathname.replace(/^\/api\/v\d+/, '')
    ),
    true
  );

  return [];
};

export { stubbedEmptyListRoute };

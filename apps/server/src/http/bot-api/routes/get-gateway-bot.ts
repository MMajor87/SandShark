import { getGatewayUrl } from '../gateway';
import type { TBotRouteHandler } from '../types';

// the libraries connect to whatever url this returns, which is what lets a ported bot
// reach this server's gateway by changing nothing but its rest base url. a single
// server needs a single shard
const getGatewayBotRoute: TBotRouteHandler = async ({ req }) => ({
  url: getGatewayUrl(req),
  shards: 1,
  session_start_limit: {
    total: 1000,
    remaining: 1000,
    reset_after: 86_400_000,
    max_concurrency: 1
  }
});

export { getGatewayBotRoute };

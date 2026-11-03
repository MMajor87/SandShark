import type { TJoinedUser } from '@sandshark/shared';
import type http from 'http';
import type { TConnectionInfo } from '../../types';

type TBotRequest = {
  req: http.IncomingMessage;
  bot: TJoinedUser;
  params: Record<string, string>;
  url: URL;
  info: TConnectionInfo | undefined;
  // the address the bot reached this server on, for the absolute urls discord returns
  origin: string;
};

// returned by a handler that answers 204, the way discord answers deletes and toggles
const NO_CONTENT = Symbol('no content');

// a handler returns the json body of a 200, NO_CONTENT, or throws a DiscordApiError
type TBotRouteHandler = (request: TBotRequest) => Promise<unknown>;

export { NO_CONTENT, type TBotRequest, type TBotRouteHandler };

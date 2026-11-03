import type { TJoinedUser } from '@sandshark/shared';
import type { TConnectionInfo } from '../../types';

type TBotRequest = {
  bot: TJoinedUser;
  params: Record<string, string>;
  url: URL;
  info: TConnectionInfo | undefined;
};

// a handler returns the json body of a 200, or throws a DiscordApiError
type TBotRouteHandler = (request: TBotRequest) => Promise<unknown>;

export type { TBotRequest, TBotRouteHandler };

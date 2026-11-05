import type http from 'http';
import { config } from '../../config';
import { isLocalRequest } from '../../helpers/is-local-request';
import { sendJsonError } from '../helpers';

// the monitor has no login, so it is only served to this machine, and it answers like any
// unknown path otherwise so nothing beyond the machine learns it exists
const guardMonitor = (req: http.IncomingMessage, res: http.ServerResponse) => {
  if (config.server.monitor && isLocalRequest(req)) {
    // the server's cors setting can allow every origin, which must not reach these
    res.removeHeader('Access-Control-Allow-Origin');

    return true;
  }

  sendJsonError(res, 404, 'Not found');

  return false;
};

const sendMonitorJson = (res: http.ServerResponse, body: unknown) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
};

export { guardMonitor, sendMonitorJson };

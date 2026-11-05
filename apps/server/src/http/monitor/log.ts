import type http from 'http';
import { COMBINED_LOG_PATH } from '../../helpers/paths';
import { readLogTail } from '../../helpers/read-log-tail';
import { guardMonitor, sendMonitorJson } from './common';

const monitorLogRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  if (!guardMonitor(req, res)) return;

  sendMonitorJson(res, { lines: await readLogTail(COMBINED_LOG_PATH) });
};

export { monitorLogRouteHandler };

import type http from 'http';
import { getMonitorStatus } from '../../helpers/monitor-status';
import { guardMonitor, sendMonitorJson } from './common';

const monitorStatusRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  if (!guardMonitor(req, res)) return;

  sendMonitorJson(res, await getMonitorStatus());
};

export { monitorStatusRouteHandler };

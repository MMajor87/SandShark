import type http from 'http';
import { updater } from '../../helpers/updater';
import { SERVER_VERSION } from '../../utils/env';
import { guardMonitor, sendMonitorJson } from './common';

// asked once when the page opens rather than on every poll, since each check is a call to
// github, which limits how often an address may ask
const monitorUpdateRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  if (!guardMonitor(req, res)) return;

  try {
    const [latestVersion, hasUpdate] = await Promise.all([
      updater.getLatestVersion(),
      updater.hasUpdates()
    ]);

    sendMonitorJson(res, {
      currentVersion: SERVER_VERSION,
      latestVersion,
      hasUpdate
    });
  } catch {
    sendMonitorJson(res, {
      currentVersion: SERVER_VERSION,
      latestVersion: null,
      hasUpdate: false
    });
  }
};

export { monitorUpdateRouteHandler };

import type http from 'http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { getPublicOrigin } from '../../helpers';
import { BOT_GATEWAY_PATH, GatewayCloseCode } from './protocol';
import { closeBotGatewaySessions, GatewaySession } from './session';

const gatewayServer = new WebSocketServer({ noServer: true });

const getGatewayUrl = (req: http.IncomingMessage) =>
  `${getPublicOrigin(req).replace(/^http/, 'ws')}${BOT_GATEWAY_PATH}`;

// the libraries append their query to the url /gateway/bot returned, sometimes after a
// trailing slash
const isBotGatewayRequest = (req: http.IncomingMessage) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  return pathname === BOT_GATEWAY_PATH || pathname === `${BOT_GATEWAY_PATH}/`;
};

const handleBotGatewayUpgrade = (
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer
) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const version = url.searchParams.get('v');
  const encoding = url.searchParams.get('encoding');
  const compress = url.searchParams.get('compress');

  gatewayServer.handleUpgrade(req, socket, head, (ws) => {
    // only json is spoken, etf needs a binary codec the libraries only use when asked to
    if (version !== null && version !== '10') {
      ws.close(GatewayCloseCode.INVALID_API_VERSION, 'Invalid API version.');
      return;
    }

    if (encoding !== null && encoding !== 'json') {
      ws.close(
        GatewayCloseCode.DECODE_ERROR,
        'Only json encoding is supported.'
      );
      return;
    }

    new GatewaySession(ws, {
      compress: compress === 'zlib-stream',
      origin: getPublicOrigin(req),
      gatewayUrl: getGatewayUrl(req)
    });
  });
};

export {
  closeBotGatewaySessions,
  getGatewayUrl,
  handleBotGatewayUpgrade,
  isBotGatewayRequest
};

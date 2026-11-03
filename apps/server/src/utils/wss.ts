import {
  ActivityLogType,
  DEFAULT_LOCALE,
  DisconnectCode,
  getErrorMessage,
  ServerEvents,
  UserStatus,
  type TConnectionParams
} from '@sandshark/shared';
import { TRPCError } from '@trpc/server';
import {
  applyWSSHandler,
  type CreateWSSContextFnOptions
} from '@trpc/server/adapters/ws';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { getUserById, getUserByToken } from '../db/queries/users';
import { createPermissionChecks } from '../helpers/create-permission-checks';
import { getWsInfo } from '../helpers/get-ws-info';
import {
  handleBotGatewayUpgrade,
  isBotGatewayRequest
} from '../http/bot-api/gateway';
import { logger } from '../logger';
import { eventBus } from '../plugins/event-bus';
import { enqueueActivityLog } from '../queues/activity-log';
import { appRouter } from '../routers';
import { VoiceRuntime } from '../runtimes/voice';
import { invariant } from './invariant';
import { pubsub } from './pubsub';
import type { Context } from './trpc';

let wss: WebSocketServer | undefined;

const usersIpMap = new Map<number, string>();

const userSockets = new Map<number, Set<WebSocket>>();

const trackUserSocket = (userId: number, ws: WebSocket) => {
  const sockets = userSockets.get(userId) ?? new Set<WebSocket>();

  sockets.add(ws);
  userSockets.set(userId, sockets);
};

const untrackUserSocket = (userId: number, ws: WebSocket) => {
  const sockets = userSockets.get(userId);

  if (!sockets) return;

  sockets.delete(ws);

  if (sockets.size === 0) userSockets.delete(userId);
};

const clearUserSocketsForTests = () => {
  userSockets.clear();
  usersIpMap.clear();
};

const getUserIp = (userId: number): string | undefined => {
  return usersIpMap.get(userId);
};

const disconnectUser = (
  userId: number,
  code: DisconnectCode,
  reason?: string
) => {
  userSockets.get(userId)?.forEach((socket) => socket.close(code, reason));
};

const getOnlineUserIds = (): number[] => Array.from(userSockets.keys());

const getUserWs = (userId: number) => {
  if (!wss) return [];

  return Array.from(wss.clients).filter((client) => client.userId === userId);
};

const getUserStatus = (userId: number) =>
  userSockets.has(userId) ? UserStatus.ONLINE : UserStatus.OFFLINE;

// this mimics the zod validation error format
const throwValidationError = (field: string, message: string): never => {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: JSON.stringify([
      {
        code: 'custom',
        path: [field],
        message
      }
    ])
  });
};

const getUserWsCount = (userId: number): number =>
  userSockets.get(userId)?.size ?? 0;

const createContext = async ({
  info,
  req,
  res: ws
}: CreateWSSContextFnOptions): Promise<Context> => {
  const { token } = info.connectionParams as TConnectionParams;

  const decodedUser = await getUserByToken(token);

  invariant(decodedUser, {
    code: 'UNAUTHORIZED',
    message: 'Invalid authentication token'
  });

  const permissionChecks = createPermissionChecks(decodedUser.id);

  const getOwnWs = () => ws;

  const setWsUserId = (userId: number) => {
    if (!ws) return;

    ws.userId = userId;
    trackUserSocket(userId, ws);
  };

  const getConnectionInfo = () => getWsInfo(ws, req);

  const saveUserIp = async (userId: number, ip: string) => {
    usersIpMap.set(userId, ip);
  };

  return {
    pubsub,
    token,
    user: decodedUser,
    authenticated: false,
    userId: decodedUser.id,
    handshakeHash: '',
    currentVoiceChannelId: undefined,
    locale: DEFAULT_LOCALE,
    ...permissionChecks,
    getOwnWs,
    getStatusById: getUserStatus,
    setWsUserId,
    getUserWs,
    getConnectionInfo,
    throwValidationError,
    saveUserIp
  };
};

const handleSocketClose = async (ws: WebSocket) => {
  try {
    const userId = ws.userId;

    // ignore connections that never authenticated through joinServer
    if (!userId) {
      return;
    }

    untrackUserSocket(userId, ws);

    // only mark as offline when there are no other active sessions
    if (userSockets.has(userId)) {
      return;
    }

    const user = await getUserById(userId);

    if (!user) return;

    const voiceRuntime = VoiceRuntime.findRuntimeByUserId(user.id);

    if (voiceRuntime) {
      voiceRuntime.removeUser(user.id);

      pubsub.publish(ServerEvents.USER_LEAVE_VOICE, {
        channelId: voiceRuntime.id,
        userId: user.id
      });
    }

    usersIpMap.delete(user.id);
    pubsub.publish(ServerEvents.USER_LEAVE, user.id);

    eventBus.emit('user:left', {
      userId: user.id,
      username: user.name
    });

    logger.info('%s left the server', user.name);

    enqueueActivityLog({
      type: ActivityLogType.USER_LEFT,
      userId: user.id
    });
  } catch (error) {
    logger.error(
      `Error occurred while handling WebSocket close: ${getErrorMessage(error)}`
    );
  }
};

const createWsServer = async (server: http.Server) => {
  return new Promise<WebSocketServer>((resolve) => {
    wss = new WebSocketServer({ noServer: true });

    // discord bots connect to their own gateway on this port, everything else is the
    // trpc websocket the clients use
    server.on('upgrade', (req, socket, head) => {
      if (isBotGatewayRequest(req)) {
        handleBotGatewayUpgrade(req, socket, head);
        return;
      }

      wss!.handleUpgrade(req, socket, head, (ws) => {
        wss!.emit('connection', ws, req);
      });
    });

    wss.on('connection', (ws) => {
      try {
        ws.userId = undefined;

        ws.on('close', () => handleSocketClose(ws));

        ws.on('error', (err) => {
          logger.error('WebSocket client error:', err);
        });
      } catch (error) {
        logger.error(
          `Error occurred while handling WebSocket connection: ${getErrorMessage(error)}`
        );
      }
    });

    wss.on('close', () => {
      logger.debug('WebSocket server closed');
    });

    wss.on('error', (err) => {
      logger.error('WebSocket server error: %s', getErrorMessage(err));
    });

    applyWSSHandler({
      wss,
      router: appRouter,
      createContext,
      keepAlive: {
        enabled: true,
        pingMs: 30_000,
        pongWaitMs: 5_000
      }
    });

    resolve(wss);
  });
};

export {
  clearUserSocketsForTests,
  createContext,
  createWsServer,
  disconnectUser,
  getOnlineUserIds,
  getUserIp,
  getUserStatus,
  getUserWs,
  getUserWsCount,
  handleSocketClose,
  throwValidationError,
  trackUserSocket
};

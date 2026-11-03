import {
  ActivityLogType,
  getErrorMessage,
  ServerEvents,
  UserStatus,
  type TJoinedUser
} from '@sandshark/shared';
import type { Unsubscribable } from '@trpc/server/observable';
import { randomBytes } from 'node:crypto';
import type WebSocket from 'ws';
import { getPublicUserById } from '../../../db/queries/users';
import { getBotUserByAuthorization } from '../../../helpers/bot-tokens';
import { getGuildContext } from '../../../helpers/discord/guild';
import { createMediaAccessToken } from '../../../helpers/media-access-token';
import { logger } from '../../../logger';
import { eventBus } from '../../../plugins/event-bus';
import { enqueueActivityLog } from '../../../queues/activity-log';
import { pubsub } from '../../../utils/pubsub';
import { handleSocketClose, trackUserSocket } from '../../../utils/wss';
import { createZlibStream } from './compression';
import { bindGatewayEvents, type TGatewaySessionApi } from './events';
import { buildGuildCreate, buildReady, type TKnownObjects } from './payloads';
import {
  CLIENT_SEND_LIMIT,
  GatewayCloseCode,
  GatewayOpcode,
  HEARTBEAT_GRACE_MS,
  HEARTBEAT_INTERVAL_MS,
  IDENTIFY_TIMEOUT_MS,
  MAX_INTENTS,
  type TGatewayPayload
} from './protocol';

type TSessionOptions = {
  compress: boolean;
  origin: string;
  gatewayUrl: string;
};

// the open sessions per bot, so a token reset or a deletion can end them at once
const sessionsByBot = new Map<number, Set<GatewaySession>>();

class GatewaySession implements TGatewaySessionApi {
  bot!: TJoinedUser;
  guildId = '';
  intents = 0;
  known: TKnownObjects = { channels: new Map(), members: new Map() };
  serializeOptions = { botId: 0, origin: '', mediaToken: '' };

  private sequence = 0;
  private identified = false;
  private identifying = false;
  private subscriptions: Unsubscribable[] = [];
  private heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  private identifyTimer: ReturnType<typeof setTimeout> | undefined;
  private zlib: ReturnType<typeof createZlibStream> | undefined;
  private sendWindowStart = Date.now();
  private sendsInWindow = 0;

  constructor(
    private readonly ws: WebSocket,
    private readonly options: TSessionOptions
  ) {
    this.zlib = options.compress ? createZlibStream() : undefined;

    ws.on('message', (data) => this.onMessage(data.toString()));
    ws.on('close', () => this.onClose());
    ws.on('error', (error) =>
      logger.debug('Bot gateway socket error: %s', getErrorMessage(error))
    );

    this.send({
      op: GatewayOpcode.HELLO,
      d: { heartbeat_interval: HEARTBEAT_INTERVAL_MS }
    });
    this.identifyTimer = setTimeout(
      () =>
        this.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated.'),
      IDENTIFY_TIMEOUT_MS
    );
    this.armHeartbeat();
  }

  dispatch = (event: string, data: unknown) => {
    this.sequence += 1;
    this.send({
      op: GatewayOpcode.DISPATCH,
      t: event,
      s: this.sequence,
      d: data
    });
  };

  close = (code: number, reason: string) => {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.close(code, reason);
    }
  };

  private send(payload: TGatewayPayload) {
    if (this.ws.readyState !== this.ws.OPEN) return;

    const json = JSON.stringify({ s: null, t: null, ...payload });

    if (!this.zlib) {
      this.ws.send(json);
      return;
    }

    this.zlib
      .compress(json)
      .then((buffer) => {
        if (this.ws.readyState === this.ws.OPEN) this.ws.send(buffer);
      })
      .catch((error) => {
        logger.error(
          'Bot gateway compression failed: %s',
          getErrorMessage(error)
        );
        this.close(GatewayCloseCode.UNKNOWN_ERROR, 'Unknown error.');
      });
  }

  // a connection that stops heartbeating is dead, discord drops it the same way
  private armHeartbeat() {
    clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(
      () =>
        this.close(GatewayCloseCode.SESSION_TIMED_OUT, 'Session timed out.'),
      HEARTBEAT_GRACE_MS
    );
  }

  private overSendLimit() {
    const now = Date.now();

    if (now - this.sendWindowStart >= CLIENT_SEND_LIMIT.windowMs) {
      this.sendWindowStart = now;
      this.sendsInWindow = 0;
    }

    this.sendsInWindow += 1;

    return this.sendsInWindow > CLIENT_SEND_LIMIT.maxRequests;
  }

  private onMessage(raw: string) {
    if (this.overSendLimit()) {
      this.close(GatewayCloseCode.RATE_LIMITED, 'You are being rate limited.');
      return;
    }

    let payload: TGatewayPayload;

    try {
      payload = JSON.parse(raw);
    } catch {
      this.close(
        GatewayCloseCode.DECODE_ERROR,
        'Error while decoding payload.'
      );
      return;
    }

    if (typeof payload !== 'object' || payload === null) {
      this.close(
        GatewayCloseCode.DECODE_ERROR,
        'Error while decoding payload.'
      );
      return;
    }

    switch (payload.op) {
      case GatewayOpcode.HEARTBEAT:
        this.armHeartbeat();
        this.send({ op: GatewayOpcode.HEARTBEAT_ACK, d: null });
        return;
      case GatewayOpcode.IDENTIFY:
        this.identify(payload.d).catch((error) => {
          logger.error(
            'Bot gateway identify failed: %s',
            getErrorMessage(error)
          );
          this.close(GatewayCloseCode.UNKNOWN_ERROR, 'Unknown error.');
        });
        return;
      // sessions are not kept after a disconnect, so a resume is told to identify afresh
      case GatewayOpcode.RESUME:
        this.send({ op: GatewayOpcode.INVALID_SESSION, d: false });
        return;
      case GatewayOpcode.REQUEST_GUILD_MEMBERS:
        this.requestGuildMembers(payload.d).catch((error) =>
          logger.error(
            'Bot gateway member request failed: %s',
            getErrorMessage(error)
          )
        );
        return;
      // a bot's own presence and voice state have nowhere to go yet, so they are accepted
      // and dropped rather than closing the connection over them
      case GatewayOpcode.PRESENCE_UPDATE:
      case GatewayOpcode.VOICE_STATE_UPDATE:
        if (!this.identified) {
          this.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated.');
        }
        return;
      default:
        this.close(GatewayCloseCode.UNKNOWN_OPCODE, 'Unknown opcode.');
    }
  }

  private async identify(data: unknown) {
    if (this.identified || this.identifying) {
      this.close(
        GatewayCloseCode.ALREADY_AUTHENTICATED,
        'Already authenticated.'
      );
      return;
    }

    const { token, intents } = (data ?? {}) as {
      token?: unknown;
      intents?: unknown;
    };

    if (
      typeof intents !== 'number' ||
      !Number.isInteger(intents) ||
      intents < 0 ||
      intents > MAX_INTENTS
    ) {
      this.close(GatewayCloseCode.INVALID_INTENTS, 'Invalid intent(s).');
      return;
    }

    this.identifying = true;

    // libraries send the bare token, some keep the `Bot ` prefix
    const bare = typeof token === 'string' ? token.replace(/^Bot /, '') : '';
    const bot = await getBotUserByAuthorization(`Bot ${bare}`);

    if (!bot) {
      this.close(
        GatewayCloseCode.AUTHENTICATION_FAILED,
        'Authentication failed.'
      );
      return;
    }

    if (this.ws.readyState !== this.ws.OPEN) return;

    clearTimeout(this.identifyTimer);

    const guild = await getGuildContext();
    const { known, payload: guildCreate } = await buildGuildCreate(bot, guild);

    this.bot = bot;
    this.intents = intents;
    this.guildId = guild.guildId;
    this.known = known;
    this.serializeOptions = {
      botId: bot.id,
      origin: this.options.origin,
      mediaToken: createMediaAccessToken(bot.id, bot.tokenVersion)
    };
    this.identified = true;

    const sessions = sessionsByBot.get(bot.id) ?? new Set();

    sessions.add(this);
    sessionsByBot.set(bot.id, sessions);

    // the bot counts as online from here, so the publishers include it like any member and
    // the websocket server's close handling takes it offline again
    this.ws.userId = bot.id;
    trackUserSocket(bot.id, this.ws);
    this.subscriptions = bindGatewayEvents(this);

    this.dispatch(
      'READY',
      buildReady(
        bot,
        guild.guildId,
        randomBytes(16).toString('hex'),
        this.options.gatewayUrl
      )
    );
    this.dispatch('GUILD_CREATE', guildCreate);

    const publicUser = await getPublicUserById(bot.id);

    if (publicUser) {
      pubsub.publish(ServerEvents.USER_JOIN, {
        ...publicUser,
        status: UserStatus.ONLINE
      });
    }

    enqueueActivityLog({ type: ActivityLogType.USER_JOINED, userId: bot.id });
    eventBus.emit('user:joined', { userId: bot.id, username: bot.name });
  }

  // everyone is visible to everyone here, so a chunk is simply the members asked for
  private async requestGuildMembers(data: unknown) {
    if (!this.identified) {
      this.close(GatewayCloseCode.NOT_AUTHENTICATED, 'Not authenticated.');
      return;
    }

    const {
      query,
      limit,
      user_ids: userIds,
      nonce
    } = (data ?? {}) as {
      query?: unknown;
      limit?: unknown;
      user_ids?: unknown;
      nonce?: unknown;
    };
    const guild = await getGuildContext();
    const { payload } = await buildGuildCreate(this.bot, guild);
    let members = payload.members;

    if (Array.isArray(userIds)) {
      const wanted = new Set(userIds.map(String));

      members = members.filter((member) => wanted.has(member.user.id));
    } else if (typeof query === 'string' && query.length > 0) {
      const prefix = query.toLowerCase();

      members = members.filter((member) =>
        member.user.username.toLowerCase().startsWith(prefix)
      );
    }

    if (typeof limit === 'number' && limit > 0) {
      members = members.slice(0, limit);
    }

    this.dispatch('GUILD_MEMBERS_CHUNK', {
      guild_id: this.guildId,
      members,
      chunk_index: 0,
      chunk_count: 1,
      ...(typeof nonce === 'string' ? { nonce } : {})
    });
  }

  private onClose() {
    clearTimeout(this.heartbeatTimer);
    clearTimeout(this.identifyTimer);
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];

    if (this.zlib) this.zlib.close();

    if (!this.identified) return;

    const sessions = sessionsByBot.get(this.bot.id);

    if (sessions) {
      sessions.delete(this);

      if (sessions.size === 0) sessionsByBot.delete(this.bot.id);
    }

    handleSocketClose(this.ws);
  }
}

// ends every gateway connection a bot has, used when its token stops being valid
const closeBotGatewaySessions = (botId: number) => {
  const sessions = sessionsByBot.get(botId);

  if (!sessions) return;

  for (const session of sessions) {
    session.close(
      GatewayCloseCode.AUTHENTICATION_FAILED,
      'Authentication failed.'
    );
  }
};

export { closeBotGatewaySessions, GatewaySession };

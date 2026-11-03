import { Permission } from '@sandshark/shared';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Client, Events, GatewayIntentBits, type Message } from 'discord.js';
import { and, eq } from 'drizzle-orm';
import type http from 'http';
import { initTest, startRealtimeServer } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { messageReactions, messages, rolePermissions } from '../../db/schema';

// the seeded member role every new bot starts with
const MEMBER_ROLE_ID = 2;

let server: http.Server;
let host: string;

beforeAll(async () => {
  ({ server, host } = await startRealtimeServer());
});

afterAll(() => {
  server.close();
});

const waitFor = <T>(
  register: (resolve: (value: T) => void) => void,
  ms = 10_000
) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);

    register((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });

// the promise of #46: an unmodified discord.js bot, given only this server's rest base url
// and a bot token, logs in, reads the guild, answers a command and reacts
describe('discord.js compatibility', () => {
  test('a ping bot logs in, replies, reacts and reads history', async () => {
    const { caller } = await initTest(1);
    const { token, bot } = await caller.bots.create({ name: 'Ping Bot' });

    // members, and so new bots, cannot react by default
    await tdb.insert(rolePermissions).values({
      roleId: MEMBER_ROLE_ID,
      permission: Permission.REACT_TO_MESSAGES,
      createdAt: Date.now()
    });
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
      ],
      rest: { api: `http://${host}/api` }
    });

    const handled = waitFor<string>((resolve) => {
      client.on(Events.MessageCreate, async (message: Message) => {
        if (message.content !== '!ping') return;

        await message.reply('pong');
        await message.react('👍');

        const history = await message.channel.messages.fetch({ limit: 10 });

        if (message.channel.isSendable()) {
          await message.channel.send(`history:${history.size}`);
        }

        resolve(message.id);
      });
    });

    try {
      const ready = waitFor<Client<true>>((resolve) =>
        client.once(Events.ClientReady, resolve)
      );

      await client.login(token);

      const readyClient = await ready;

      expect(readyClient.user.bot).toBe(true);
      expect(readyClient.user.username).toBe('Ping Bot');
      expect(readyClient.guilds.cache.size).toBe(1);

      const guild = readyClient.guilds.cache.first()!;

      expect(guild.name).toBe('Test Server');
      expect(guild.roles.everyone.name).toBe('@everyone');
      expect(
        guild.channels.cache.some((channel) => channel.name === 'General')
      ).toBe(true);

      const pingId = await caller.messages.send({
        channelId: 1,
        content: '<p>!ping</p>',
        files: []
      });

      await handled;

      const botMessages = await tdb
        .select()
        .from(messages)
        .where(eq(messages.userId, bot.id));

      expect(botMessages.map((message) => message.content)).toEqual([
        '<p>pong</p>',
        // the seeded welcome message, the ping and the reply
        '<p>history:3</p>'
      ]);
      expect(botMessages[0]!.replyToMessageId).toBe(pingId);

      const reactions = await tdb
        .select()
        .from(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, pingId!),
            eq(messageReactions.userId, bot.id)
          )
        );

      expect(reactions.map((reaction) => reaction.emoji)).toEqual(['+1']);
    } finally {
      await client.destroy();
    }
  }, 30_000);
});

import { Permission } from '@sandshark/shared';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  type Message
} from 'discord.js';
import { and, asc, eq } from 'drizzle-orm';
import type http from 'http';
import { initTest, startRealtimeServer } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import {
  botCommands,
  messageReactions,
  messages,
  rolePermissions
} from '../../db/schema';

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

  // what a modern discord.js bot does at startup: register its slash commands, globally and
  // for one guild, with the builder, then manage them through the cached application
  test('a bot registers, fetches, edits and deletes its slash commands', async () => {
    const { caller } = await initTest(1);
    const { token, bot } = await caller.bots.create({ name: 'Command Bot' });
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
      rest: { api: `http://${host}/api` }
    });

    try {
      const ready = waitFor<Client<true>>((resolve) =>
        client.once(Events.ClientReady, resolve)
      );

      await client.login(token);

      const readyClient = await ready;
      const roll = new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a die')
        .addIntegerOption((option) =>
          option
            .setName('sides')
            .setDescription('How many sides')
            .setRequired(true)
            .setMinValue(2)
        );
      const ping = new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with pong');

      const global = await readyClient.application.commands.set([
        roll.toJSON(),
        ping.toJSON()
      ]);

      expect([...global.values()].map((command) => command.name)).toEqual([
        'roll',
        'ping'
      ]);
      expect(global.first()!.options[0]).toMatchObject({
        name: 'sides',
        required: true,
        minValue: 2
      });

      const guild = readyClient.guilds.cache.first()!;
      const guildCommands = await guild.commands.set([ping.toJSON()]);

      expect(guildCommands.first()!.guildId).toBe(guild.id);

      const fetched = await readyClient.application.commands.fetch();

      expect(fetched.size).toBe(2);

      const pingCommand = fetched.find((command) => command.name === 'ping')!;

      await pingCommand.edit({ description: 'Pong, edited' });
      await readyClient.application.commands.delete(
        fetched.find((command) => command.name === 'roll')!
      );

      const rows = await tdb
        .select()
        .from(botCommands)
        .where(eq(botCommands.botId, bot.id))
        .orderBy(asc(botCommands.id));

      expect(
        rows.map((row) => [row.name, row.description, row.guildScoped])
      ).toEqual([
        ['ping', 'Pong, edited', false],
        ['ping', 'Replies with pong', true]
      ]);
    } finally {
      await client.destroy();
    }
  }, 30_000);
});

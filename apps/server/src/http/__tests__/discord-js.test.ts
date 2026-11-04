import { Permission, ServerEvents } from '@sandshark/shared';
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
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
import { pubsub } from '../../utils/pubsub';

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

  // the promise of #58: an unmodified discord.js bot answers slash commands the usual ways,
  // and a member running them gets those answers
  test('a bot answers slash commands with replies, ephemeral replies and deferrals', async () => {
    const { caller } = await initTest(1);
    const { token, bot } = await caller.bots.create({ name: 'Slash Bot' });
    const published = spyOn(pubsub, 'publishFor');
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
      rest: { api: `http://${host}/api` }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
      // the usual button handler: answer by updating the message the button is on
      if (interaction.isButton()) {
        await interaction.update({
          content: `voted ${interaction.customId}`,
          components: []
        });

        return;
      }

      if (interaction.isModalSubmit()) {
        await interaction.reply(
          `thanks ${interaction.fields.getTextInputValue('name')}`
        );

        return;
      }

      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === 'echo') {
        await interaction.reply(interaction.options.getString('text', true));
      } else if (interaction.commandName === 'secret') {
        await interaction.reply({
          content: 'only you',
          flags: MessageFlags.Ephemeral
        });
      } else if (interaction.commandName === 'slow') {
        await interaction.deferReply();
        await interaction.editReply('done');
        await interaction.followUp('and one more');
      } else if (interaction.commandName === 'form') {
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId('feedback')
            .setTitle('Feedback')
            .addLabelComponents(
              new LabelBuilder()
                .setLabel('Name')
                .setTextInputComponent(
                  new TextInputBuilder()
                    .setCustomId('name')
                    .setStyle(TextInputStyle.Short)
                )
            )
        );
      } else if (interaction.commandName === 'vote') {
        await interaction.reply({
          content: 'Vote now',
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('up')
                .setLabel('Up')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId('down')
                .setLabel('Down')
                .setStyle(ButtonStyle.Danger)
            )
          ]
        });
      } else if (interaction.commandName === 'scores') {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('Scores')
              .setDescription('**Alice** leads')
              .setColor(0x00ff00)
              .addFields(
                { name: 'Alice', value: '10', inline: true },
                { name: 'Bob', value: '7', inline: true }
              )
              .setFooter({ text: 'Updated now' })
          ]
        });
      }
    });

    try {
      const ready = waitFor<Client<true>>((resolve) =>
        client.once(Events.ClientReady, resolve)
      );

      await client.login(token);

      const readyClient = await ready;

      await readyClient.application.commands.set([
        new SlashCommandBuilder()
          .setName('echo')
          .setDescription('Says it back')
          .addStringOption((option) =>
            option.setName('text').setDescription('What').setRequired(true)
          )
          .toJSON(),
        new SlashCommandBuilder()
          .setName('secret')
          .setDescription('Whispers')
          .toJSON(),
        new SlashCommandBuilder()
          .setName('slow')
          .setDescription('Takes a moment')
          .toJSON(),
        new SlashCommandBuilder()
          .setName('scores')
          .setDescription('Shows the scores')
          .toJSON(),
        new SlashCommandBuilder()
          .setName('vote')
          .setDescription('Asks for a vote')
          .toJSON(),
        new SlashCommandBuilder()
          .setName('form')
          .setDescription('Asks for feedback')
          .toJSON()
      ]);

      const commands = await tdb
        .select()
        .from(botCommands)
        .where(eq(botCommands.botId, bot.id));
      const commandId = (name: string) =>
        commands.find((command) => command.name === name)!.id;
      const botMessages = () =>
        tdb
          .select()
          .from(messages)
          .where(eq(messages.userId, bot.id))
          .orderBy(asc(messages.id));
      const waitForMessages = async (count: number) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const rows = await botMessages();

          if (rows.length >= count && rows.every((row) => !row.loading)) {
            return rows;
          }

          await Bun.sleep(50);
        }

        throw new Error('the bot did not answer');
      };

      await caller.bots.runCommand({
        commandId: commandId('echo'),
        channelId: 1,
        values: { text: 'hello there' }
      });

      const [echo] = await waitForMessages(1);

      expect(echo).toMatchObject({
        content: '<p>hello there</p>',
        interactionUserId: 1,
        interactionCommandName: 'echo'
      });

      await caller.bots.runCommand({
        commandId: commandId('slow'),
        channelId: 1
      });

      const answered = await waitForMessages(3);

      expect(answered.map((row) => [row.content, row.editedAt])).toEqual([
        ['<p>hello there</p>', null],
        ['<p>done</p>', null],
        ['<p>and one more</p>', null]
      ]);

      await caller.bots.runCommand({
        commandId: commandId('scores'),
        channelId: 1
      });

      const [, , , scores] = await waitForMessages(4);

      expect(scores).toMatchObject({
        content: '',
        interactionCommandName: 'scores',
        embeds: [
          {
            title: 'Scores',
            description: '<p><strong>Alice</strong> leads</p>',
            color: 0x00ff00,
            fields: [
              { name: 'Alice', value: '<p>10</p>', inline: true },
              { name: 'Bob', value: '<p>7</p>', inline: true }
            ],
            footer: { text: 'Updated now' }
          }
        ]
      });

      await caller.bots.runCommand({
        commandId: commandId('secret'),
        channelId: 1
      });

      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          published.mock.calls.some(
            ([, topic]) => topic === ServerEvents.BOT_EPHEMERAL_MESSAGE
          )
        ) {
          break;
        }

        await Bun.sleep(50);
      }

      const ephemeral = published.mock.calls.find(
        ([, topic]) => topic === ServerEvents.BOT_EPHEMERAL_MESSAGE
      );

      expect(ephemeral?.[0]).toBe(1);
      expect(ephemeral?.[2]).toMatchObject({ content: '<p>only you</p>' });
      expect(await botMessages()).toHaveLength(4);

      await caller.bots.runCommand({
        commandId: commandId('vote'),
        channelId: 1
      });

      const [, , , , vote] = await waitForMessages(5);

      expect(vote).toMatchObject({
        content: '<p>Vote now</p>',
        components: [
          {
            type: 1,
            components: [
              { type: 2, style: 3, label: 'Up', customId: 'up' },
              { type: 2, style: 4, label: 'Down', customId: 'down' }
            ]
          }
        ]
      });

      await caller.bots.pressComponent({ messageId: vote!.id, customId: 'up' });

      for (let attempt = 0; attempt < 100; attempt++) {
        const [row] = await tdb
          .select()
          .from(messages)
          .where(eq(messages.id, vote!.id));

        if (row?.content === '<p>voted up</p>') break;

        await Bun.sleep(50);
      }

      const [voted] = await tdb
        .select()
        .from(messages)
        .where(eq(messages.id, vote!.id));

      expect(voted).toMatchObject({
        content: '<p>voted up</p>',
        components: null
      });

      await caller.bots.runCommand({
        commandId: commandId('form'),
        channelId: 1
      });

      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          published.mock.calls.some(
            ([, topic]) => topic === ServerEvents.BOT_MODAL_OPEN
          )
        ) {
          break;
        }

        await Bun.sleep(50);
      }

      const opened = published.mock.calls.find(
        ([, topic]) => topic === ServerEvents.BOT_MODAL_OPEN
      )?.[2] as { interactionId: number; labelled: boolean };

      expect(opened).toMatchObject({ title: 'Feedback', labelled: true });

      await caller.bots.submitModal({
        interactionId: opened.interactionId,
        values: { name: 'Alice' }
      });

      const [, , , , , thanks] = await waitForMessages(6);

      expect(thanks).toMatchObject({
        content: '<p>thanks Alice</p>',
        interactionCommandName: 'form'
      });
    } finally {
      await client.destroy();
    }
  }, 30_000);
});

import { BotCommandOptionType, ServerEvents } from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import {
  botApiRequest,
  createTestBot,
  initTest
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { users } from '../../db/schema';
import { getGuildContext } from '../../helpers/discord/guild';
import { userSnowflake } from '../../helpers/discord/user';
import { pubsub } from '../../utils/pubsub';

// a bot with commands registered through the bot api, the way a real bot does it
const botWithCommands = async (
  name: string,
  global: unknown[],
  guild: unknown[] = []
) => {
  const { bot, token } = await createTestBot(name);
  const row = await tdb.select().from(users).where(eq(users.id, bot.id)).get();
  const applicationId = userSnowflake(row!);
  const { guildId } = await getGuildContext();

  await botApiRequest(`/applications/${applicationId}/commands`, token, {
    method: 'PUT',
    body: global
  });

  if (guild.length > 0) {
    await botApiRequest(
      `/applications/${applicationId}/guilds/${guildId}/commands`,
      token,
      { method: 'PUT', body: guild }
    );
  }

  return { bot, token, applicationId };
};

const option = (type: BotCommandOptionType, name: string, extra = {}) => ({
  type,
  name,
  description: name,
  ...extra
});

describe('the bot command menu', () => {
  test('lists slash commands with their bot, one entry per subcommand', async () => {
    const { bot } = await botWithCommands('Menu Bot', [
      {
        name: 'roll',
        description: 'Roll a die',
        options: [
          option(BotCommandOptionType.INTEGER, 'sides', { required: true })
        ]
      },
      {
        name: 'config',
        description: 'Configure',
        options: [
          option(BotCommandOptionType.SUB_COMMAND, 'show'),
          option(BotCommandOptionType.SUB_COMMAND_GROUP, 'colour', {
            options: [
              option(BotCommandOptionType.SUB_COMMAND, 'set', {
                options: [option(BotCommandOptionType.STRING, 'value')]
              })
            ]
          })
        ]
      },
      { type: 2, name: 'Wave' }
    ]);
    const { caller } = await initTest(1);

    const menu = await caller.bots.getCommands();

    expect(menu.map((entry) => [entry.name, entry.subcommand])).toEqual([
      ['roll', []],
      ['config show', ['show']],
      ['config colour set', ['colour', 'set']]
    ]);
    expect(menu[0]).toMatchObject({
      botId: bot.id,
      botName: 'Menu Bot',
      description: 'Roll a die',
      options: [
        { type: BotCommandOptionType.INTEGER, name: 'sides', required: true }
      ]
    });
    expect(menu[2]!.options.map(({ name }) => name)).toEqual(['value']);
    // both subcommands run the one command
    expect(menu[1]!.commandId).toBe(menu[2]!.commandId);
  });

  test("prefers a bot's guild copy of a command over its global one", async () => {
    await botWithCommands(
      'Dev Bot',
      [{ name: 'ping', description: 'Global ping' }],
      [{ name: 'ping', description: 'Guild ping' }]
    );
    const { caller } = await initTest(1);

    const menu = await caller.bots.getCommands();

    expect(menu.map((entry) => entry.description)).toEqual(['Guild ping']);
  });

  test('leaves out commands a member lacks the permissions for, and commands that need a file', async () => {
    await botWithCommands('Picky Bot', [
      { name: 'open', description: 'Anyone' },
      { name: 'admin', description: 'Admins', default_member_permissions: '8' },
      {
        name: 'upload',
        description: 'Needs a file',
        options: [
          option(BotCommandOptionType.ATTACHMENT, 'file', { required: true })
        ]
      }
    ]);

    const member = await initTest(2);
    const owner = await initTest(1);

    expect(
      (await member.caller.bots.getCommands()).map(({ name }) => name)
    ).toEqual(['open']);
    expect(
      (await owner.caller.bots.getCommands()).map(({ name }) => name)
    ).toEqual(['open', 'admin']);
  });

  test("leaves out a banned bot's commands", async () => {
    const { bot } = await botWithCommands('Banned Bot', [
      { name: 'ping', description: 'Ping' }
    ]);

    await tdb.update(users).set({ banned: true }).where(eq(users.id, bot.id));

    const { caller } = await initTest(1);

    expect(await caller.bots.getCommands()).toEqual([]);
  });

  test('is part of what a member gets on joining', async () => {
    await botWithCommands('Join Bot', [{ name: 'ping', description: 'Ping' }]);

    const { initialData } = await initTest(1);

    expect(initialData.botCommands.map(({ name }) => name)).toEqual(['ping']);
  });

  test('a change to a bot or its commands tells every member to fetch the menu again', async () => {
    const published = spyOn(pubsub, 'publish');
    const changes = () =>
      published.mock.calls.filter(
        ([topic]) => topic === ServerEvents.BOT_COMMANDS_CHANGE
      ).length;

    const { bot, token, applicationId } = await botWithCommands('Busy Bot', [
      { name: 'ping', description: 'Ping' }
    ]);

    expect(changes()).toBe(1);

    const created = await botApiRequest<{ id: string }>(
      `/applications/${applicationId}/commands`,
      token,
      { method: 'POST', body: { name: 'pong', description: 'Pong' } }
    );

    await botApiRequest(
      `/applications/${applicationId}/commands/${created.body.id}`,
      token,
      { method: 'PATCH', body: { description: 'Pong!' } }
    );
    await botApiRequest(
      `/applications/${applicationId}/commands/${created.body.id}`,
      token,
      { method: 'DELETE' }
    );

    expect(changes()).toBe(4);

    const { caller } = await initTest(1);

    await caller.bots.rename({ botId: bot.id, name: 'Renamed Bot' });
    await caller.bots.delete({ botId: bot.id });

    expect(changes()).toBe(6);
  });
});

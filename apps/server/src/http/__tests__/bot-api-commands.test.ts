import { BotCommandOptionType, BotCommandType } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import {
  botApiRequest,
  createTestBot,
  initTest
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { botCommands, users } from '../../db/schema';
import { getGuildContext } from '../../helpers/discord/guild';
import { userSnowflake } from '../../helpers/discord/user';

type TJson = Record<string, unknown>;

const setup = async () => {
  const { bot, token } = await createTestBot();
  const row = await tdb.select().from(users).where(eq(users.id, bot.id)).get();
  const applicationId = userSnowflake(row!);
  const { guildId } = await getGuildContext();

  return {
    bot,
    token,
    applicationId,
    guildId,
    global: `/applications/${applicationId}/commands`,
    guild: `/applications/${applicationId}/guilds/${guildId}/commands`
  };
};

const ping = { name: 'ping', description: 'Replies with pong' };

const storedRows = async (botId: number) =>
  tdb
    .select()
    .from(botCommands)
    .where(eq(botCommands.botId, botId))
    .orderBy(asc(botCommands.id))
    .all();

describe('bot api application commands', () => {
  test('a bulk overwrite stores the commands and answers with discord command objects', async () => {
    const { bot, token, applicationId, global } = await setup();

    const { status, body } = await botApiRequest<TJson[]>(global, token, {
      method: 'PUT',
      body: [
        ping,
        {
          name: 'roll',
          description: 'Roll a die',
          options: [
            {
              type: BotCommandOptionType.INTEGER,
              name: 'sides',
              description: 'How many sides',
              required: true,
              min_value: 2,
              max_value: 100
            }
          ],
          default_member_permissions: '8',
          name_localizations: { fr: 'lancer' }
        }
      ]
    });

    expect(status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[1]).toMatchObject({
      application_id: applicationId,
      type: BotCommandType.CHAT_INPUT,
      name: 'roll',
      description: 'Roll a die',
      default_member_permissions: '8',
      name_localizations: null,
      dm_permission: true,
      integration_types: [0],
      nsfw: false,
      options: [
        {
          type: BotCommandOptionType.INTEGER,
          name: 'sides',
          description: 'How many sides',
          required: true,
          min_value: 2,
          max_value: 100
        }
      ]
    });
    expect(body[1]!.guild_id).toBeUndefined();
    expect(body[0]!.id).toMatch(/^\d+$/);

    const rows = await storedRows(bot.id);

    expect(rows.map((row) => [row.name, row.guildScoped])).toEqual([
      ['ping', false],
      ['roll', false]
    ]);
    expect(rows[1]!.options).toEqual([
      {
        type: BotCommandOptionType.INTEGER,
        name: 'sides',
        description: 'How many sides',
        required: true,
        minValue: 2,
        maxValue: 100
      }
    ]);

    const listed = await botApiRequest<TJson[]>(global, token);

    expect(listed.body).toEqual(body);
  });

  test('a second bulk overwrite keeps the ids of commands it keeps and removes the rest', async () => {
    const { bot, token, global } = await setup();
    const first = await botApiRequest<TJson[]>(global, token, {
      method: 'PUT',
      body: [ping, { name: 'old', description: 'Going away' }]
    });

    const second = await botApiRequest<TJson[]>(global, token, {
      method: 'PUT',
      body: [
        { ...ping, description: 'Pong, but newer' },
        { name: 'new', description: 'Just arrived' }
      ]
    });

    expect(second.status).toBe(200);
    expect(second.body[0]!.id).toBe(first.body[0]!.id);
    expect(second.body[0]!.description).toBe('Pong, but newer');
    expect(second.body[1]!.id).not.toBe(first.body[1]!.id);

    const rows = await storedRows(bot.id);

    expect(rows.map((row) => row.name)).toEqual(['ping', 'new']);
  });

  test('an empty bulk overwrite clears the scope', async () => {
    const { bot, token, global } = await setup();

    await botApiRequest(global, token, { method: 'PUT', body: [ping] });

    const { status, body } = await botApiRequest<TJson[]>(global, token, {
      method: 'PUT',
      body: []
    });

    expect(status).toBe(200);
    expect(body).toEqual([]);
    expect(await storedRows(bot.id)).toEqual([]);
  });

  test('guild commands are a separate list that names the guild', async () => {
    const { bot, token, global, guild, guildId } = await setup();

    await botApiRequest(global, token, { method: 'PUT', body: [ping] });

    const { status, body } = await botApiRequest<TJson[]>(guild, token, {
      method: 'PUT',
      body: [ping, { name: 'test', description: 'Only here' }]
    });

    expect(status).toBe(200);
    expect(body.map((command) => command.guild_id)).toEqual([guildId, guildId]);
    expect(body[0]!.dm_permission).toBeUndefined();

    const globalList = await botApiRequest<TJson[]>(global, token);
    const guildList = await botApiRequest<TJson[]>(guild, token);

    expect(globalList.body.map((command) => command.name)).toEqual(['ping']);
    expect(guildList.body.map((command) => command.name)).toEqual([
      'ping',
      'test'
    ]);

    const rows = await storedRows(bot.id);

    expect(rows.filter((row) => row.guildScoped)).toHaveLength(2);
  });

  test('a guild that is not this server is unknown', async () => {
    const { token, applicationId } = await setup();

    const { status, body } = await botApiRequest(
      `/applications/${applicationId}/guilds/123456789012345678/commands`,
      token
    );

    expect(status).toBe(404);
    expect(body).toEqual({ message: 'Unknown Guild', code: 10004 });
  });

  test('another application is refused', async () => {
    const { token } = await setup();
    const other = await createTestBot('Other');
    const row = await tdb
      .select()
      .from(users)
      .where(eq(users.id, other.bot.id))
      .get();

    const { status, body } = await botApiRequest(
      `/applications/${userSnowflake(row!)}/commands`,
      token
    );

    expect(status).toBe(403);
    expect(body).toEqual({ message: 'Missing Access', code: 50001 });
  });

  test('creating a command stores it, and creating it again overwrites it in place', async () => {
    const { bot, token, global } = await setup();

    const created = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: ping
    });

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: 'ping', options: [] });

    const again = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: { ...ping, description: 'Pong again' }
    });

    expect(again.body.id).toBe(created.body.id);

    const rows = await storedRows(bot.id);

    expect(rows.map((row) => row.description)).toEqual(['Pong again']);
  });

  test('a command is read back by its id, and an unknown id is an unknown command', async () => {
    const { token, global } = await setup();
    const created = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: ping
    });

    const fetched = await botApiRequest<TJson>(
      `${global}/${created.body.id}`,
      token
    );

    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);

    const missing = await botApiRequest(`${global}/123456789012345678`, token);

    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      message: 'Unknown application command',
      code: 10063
    });
  });

  test('a command in one scope is unknown from the other scope and to other bots', async () => {
    const { token, global, guild } = await setup();
    const created = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: ping
    });

    const fromGuild = await botApiRequest(`${guild}/${created.body.id}`, token);

    expect(fromGuild.status).toBe(404);

    const other = await setup();
    const fromOther = await botApiRequest(
      `${other.global}/${created.body.id}`,
      other.token
    );

    expect(fromOther.status).toBe(404);
  });

  test('editing a command merges the change and keeps its id', async () => {
    const { bot, token, global } = await setup();
    const created = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: ping
    });

    await Bun.sleep(5);

    const edited = await botApiRequest<TJson>(
      `${global}/${created.body.id}`,
      token,
      { method: 'PATCH', body: { description: 'Edited', nsfw: true } }
    );

    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      id: created.body.id,
      name: 'ping',
      description: 'Edited',
      nsfw: true
    });
    expect(edited.body.version).not.toBe(created.body.version);

    const [row] = await storedRows(bot.id);

    expect(row).toMatchObject({ description: 'Edited', nsfw: true });
  });

  test('an edit cannot rename onto another command or change the type', async () => {
    const { token, global } = await setup();
    const { body } = await botApiRequest<TJson[]>(global, token, {
      method: 'PUT',
      body: [ping, { name: 'other', description: 'Taken name' }]
    });
    const path = `${global}/${body[0]!.id}`;

    const rename = await botApiRequest(path, token, {
      method: 'PATCH',
      body: { name: 'other' }
    });

    expect(rename.status).toBe(400);
    expect(rename.body).toEqual({
      message: 'Application command names must be unique',
      code: 50035
    });

    const retype = await botApiRequest(path, token, {
      method: 'PATCH',
      body: { type: BotCommandType.USER }
    });

    expect(retype.status).toBe(400);
  });

  test('deleting a command answers 204 and removes it', async () => {
    const { bot, token, global } = await setup();
    const created = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: ping
    });

    const deleted = await botApiRequest(`${global}/${created.body.id}`, token, {
      method: 'DELETE'
    });

    expect(deleted.status).toBe(204);
    expect(await storedRows(bot.id)).toEqual([]);

    const again = await botApiRequest(`${global}/${created.body.id}`, token, {
      method: 'DELETE'
    });

    expect(again.status).toBe(404);
  });

  test('subcommands, groups and choices round trip in discord form', async () => {
    const { token, global } = await setup();
    const options = [
      {
        type: BotCommandOptionType.SUB_COMMAND_GROUP,
        name: 'config',
        description: 'Configure things',
        options: [
          {
            type: BotCommandOptionType.SUB_COMMAND,
            name: 'set',
            description: 'Set a value',
            options: [
              {
                type: BotCommandOptionType.STRING,
                name: 'key',
                description: 'Which value',
                required: true,
                choices: [
                  { name: 'Colour', value: 'colour' },
                  { name: 'Size', value: 'size' }
                ]
              },
              {
                type: BotCommandOptionType.CHANNEL,
                name: 'where',
                description: 'A channel',
                channel_types: [0]
              }
            ]
          }
        ]
      },
      {
        type: BotCommandOptionType.SUB_COMMAND,
        name: 'show',
        description: 'Show the values'
      }
    ];

    const { status, body } = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: { name: 'settings', description: 'Settings', options }
    });

    expect(status).toBe(200);
    expect(body.options).toEqual(options);
  });

  test('user and message commands carry no description', async () => {
    const { token, global } = await setup();

    const valid = await botApiRequest<TJson>(global, token, {
      method: 'POST',
      body: { type: BotCommandType.USER, name: 'High Five' }
    });

    expect(valid.status).toBe(200);
    expect(valid.body).toMatchObject({
      type: BotCommandType.USER,
      name: 'High Five',
      description: ''
    });

    const invalid = await botApiRequest(global, token, {
      method: 'POST',
      body: { type: BotCommandType.MESSAGE, name: 'Quote', description: 'No' }
    });

    expect(invalid.status).toBe(400);
  });

  test.each([
    ['an uppercase name', { name: 'Ping', description: 'Pong' }],
    ['a name with spaces', { name: 'two words', description: 'Pong' }],
    ['a missing description', { name: 'ping' }],
    [
      'a description over 100 characters',
      { name: 'ping', description: 'x'.repeat(101) }
    ],
    [
      'a required option after an optional one',
      {
        ...ping,
        options: [
          { type: BotCommandOptionType.STRING, name: 'a', description: 'A' },
          {
            type: BotCommandOptionType.STRING,
            name: 'b',
            description: 'B',
            required: true
          }
        ]
      }
    ],
    [
      'subcommands mixed with plain options',
      {
        ...ping,
        options: [
          {
            type: BotCommandOptionType.SUB_COMMAND,
            name: 'a',
            description: 'A'
          },
          { type: BotCommandOptionType.STRING, name: 'b', description: 'B' }
        ]
      }
    ],
    [
      'choices on a boolean option',
      {
        ...ping,
        options: [
          {
            type: BotCommandOptionType.BOOLEAN,
            name: 'flag',
            description: 'A flag',
            choices: [{ name: 'Yes', value: 'yes' }]
          }
        ]
      }
    ],
    [
      'two options with the same name',
      {
        ...ping,
        options: [
          { type: BotCommandOptionType.STRING, name: 'a', description: 'A' },
          { type: BotCommandOptionType.STRING, name: 'a', description: 'A' }
        ]
      }
    ],
    [
      'more than 25 options',
      {
        ...ping,
        options: Array.from({ length: 26 }, (_, index) => ({
          type: BotCommandOptionType.STRING,
          name: `o${index}`,
          description: 'An option'
        }))
      }
    ]
  ])('refuses %s with invalid form body', async (_, command) => {
    const { bot, token, global } = await setup();

    const { status, body } = await botApiRequest(global, token, {
      method: 'POST',
      body: command
    });

    expect(status).toBe(400);
    expect((body as TJson).code).toBe(50035);
    expect(await storedRows(bot.id)).toEqual([]);
  });

  test('a bulk overwrite with an invalid or duplicated command writes nothing', async () => {
    const { bot, token, global } = await setup();

    await botApiRequest(global, token, { method: 'PUT', body: [ping] });

    const invalid = await botApiRequest(global, token, {
      method: 'PUT',
      body: [{ name: 'fine', description: 'Fine' }, { name: 'Bad' }]
    });

    expect(invalid.status).toBe(400);

    const duplicated = await botApiRequest(global, token, {
      method: 'PUT',
      body: [ping, ping]
    });

    expect(duplicated.status).toBe(400);
    expect(duplicated.body).toEqual({
      message: 'Application command names must be unique',
      code: 50035
    });

    const notAnArray = await botApiRequest(global, token, {
      method: 'PUT',
      body: ping
    });

    expect(notAnArray.status).toBe(400);
    expect((await storedRows(bot.id)).map((row) => row.name)).toEqual(['ping']);
  });

  test('discord limits the number of slash commands to 100', async () => {
    const { bot, token, global } = await setup();
    const hundred = Array.from({ length: 100 }, (_, index) => ({
      name: `command-${index}`,
      description: 'One of many'
    }));

    const tooMany = await botApiRequest(global, token, {
      method: 'PUT',
      body: [...hundred, ping]
    });

    expect(tooMany.status).toBe(400);
    expect(tooMany.body).toEqual({
      message: 'Maximum number of application commands reached (100)',
      code: 50035
    });

    const full = await botApiRequest(global, token, {
      method: 'PUT',
      body: hundred
    });

    expect(full.status).toBe(200);

    const oneMore = await botApiRequest(global, token, {
      method: 'POST',
      body: ping
    });

    expect(oneMore.status).toBe(400);

    // overwriting an existing command is not a new one, so it still fits
    const overwrite = await botApiRequest(global, token, {
      method: 'POST',
      body: { name: 'command-0', description: 'Rewritten' }
    });

    expect(overwrite.status).toBe(200);
    expect(await storedRows(bot.id)).toHaveLength(100);
  });

  test('deleting the bot deletes its commands', async () => {
    const { bot, token, global } = await setup();

    await botApiRequest(global, token, { method: 'PUT', body: [ping] });

    const { caller } = await initTest(1);

    await caller.bots.delete({ botId: bot.id });

    expect(await storedRows(bot.id)).toEqual([]);
  });
});

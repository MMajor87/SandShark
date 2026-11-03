import {
  BotCommandOptionType,
  BotCommandType,
  ServerEvents,
  sha256
} from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import {
  botApiRequest,
  createTestBot,
  initTest
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import {
  botCommands,
  botEphemeralMessages,
  botInteractions,
  messages,
  users
} from '../../db/schema';
import {
  cleanupBotInteractions,
  RESPONSE_WINDOW_MS,
  TOKEN_LIFETIME_MS
} from '../../helpers/bot-interactions';
import {
  buildInteractionPayload,
  interactionSnowflake
} from '../../helpers/discord/interaction';
import { userSnowflake } from '../../helpers/discord/user';
import type { TBotInteractionEvent } from '../../types';
import { pubsub } from '../../utils/pubsub';
import * as gateway from '../bot-api/gateway';

type TJson = Record<string, unknown>;

const GENERAL = 1;
const DM_CHANNEL = 3;
const RESTRICTED = 5;

const COMMANDS = [
  {
    name: 'roll',
    description: 'Roll a die',
    options: [
      {
        type: BotCommandOptionType.INTEGER,
        name: 'sides',
        description: 'Sides',
        required: true,
        min_value: 2,
        max_value: 6
      },
      {
        type: BotCommandOptionType.USER,
        name: 'for',
        description: 'Who it is for'
      },
      {
        type: BotCommandOptionType.CHANNEL,
        name: 'where',
        description: 'Where'
      },
      { type: BotCommandOptionType.ROLE, name: 'role', description: 'A role' }
    ]
  },
  {
    name: 'config',
    description: 'Configure',
    options: [
      {
        type: BotCommandOptionType.SUB_COMMAND,
        name: 'set',
        description: 'Set a value',
        options: [
          {
            type: BotCommandOptionType.STRING,
            name: 'key',
            description: 'Which',
            required: true,
            choices: [{ name: 'Colour', value: 'colour' }]
          }
        ]
      },
      {
        type: BotCommandOptionType.SUB_COMMAND,
        name: 'show',
        description: 'Show'
      }
    ]
  },
  {
    name: 'upload',
    description: 'Takes a file',
    options: [
      {
        type: BotCommandOptionType.ATTACHMENT,
        name: 'file',
        description: 'A file',
        required: true
      }
    ]
  },
  {
    name: 'admin',
    description: 'Admins only',
    default_member_permissions: '8'
  },
  { type: BotCommandType.USER, name: 'Wave' }
];

// a connected bot with the commands above, and everything it is sent captured
const setup = async () => {
  const { bot, token } = await createTestBot();
  const row = await tdb.select().from(users).where(eq(users.id, bot.id)).get();
  const applicationId = userSnowflake(row!);

  await botApiRequest(`/applications/${applicationId}/commands`, token, {
    method: 'PUT',
    body: COMMANDS
  });

  const rows = await tdb
    .select()
    .from(botCommands)
    .where(eq(botCommands.botId, bot.id))
    .orderBy(asc(botCommands.id));
  const commandId = (name: string) =>
    rows.find((command) => command.name === name)!.id;

  spyOn(gateway, 'isBotConnected').mockReturnValue(true);

  const published = spyOn(pubsub, 'publishFor');
  const sentTo = <T>(userId: number, topic: ServerEvents) =>
    published.mock.calls
      .filter(([target, event]) => target === userId && event === topic)
      .map(([, , payload]) => payload as T);

  const run = async (
    userId: number,
    input: {
      command: string;
      channelId?: number;
      subcommand?: string[];
      values?: Record<string, string | number | boolean>;
    }
  ) => {
    const { caller } = await initTest(userId);

    return caller.bots.runCommand({
      commandId: commandId(input.command),
      channelId: input.channelId ?? GENERAL,
      subcommand: input.subcommand,
      values: input.values
    });
  };

  // runs a command as the admin and returns what the bot's gateway would be handed
  const invoke = async (
    input: Parameters<typeof run>[1] = {
      command: 'roll',
      values: { sides: 6 }
    }
  ) => {
    await run(1, input);

    return sentTo<TBotInteractionEvent>(
      bot.id,
      ServerEvents.BOT_INTERACTION_CREATE
    ).at(-1)!;
  };

  const callback = (event: TBotInteractionEvent, body: unknown, query = '') =>
    botApiRequest(
      `/interactions/${interactionSnowflake({
        id: event.interactionId,
        createdAt: event.createdAt
      })}/${event.token}/callback${query}`,
      null,
      { method: 'POST', body }
    );

  const webhook = (
    event: TBotInteractionEvent,
    path: string,
    init: { method?: string; body?: unknown } = {}
  ) =>
    botApiRequest(
      `/webhooks/${applicationId}/${event.token}${path}`,
      null,
      init
    );

  return {
    bot,
    token,
    applicationId,
    commandId,
    sentTo,
    run,
    invoke,
    callback,
    webhook
  };
};

const botMessages = (botId: number) =>
  tdb
    .select()
    .from(messages)
    .where(eq(messages.userId, botId))
    .orderBy(asc(messages.id))
    .all();

describe('running a bot command', () => {
  test('hands the bot the interaction with its options nested under the subcommand', async () => {
    const { bot, sentTo, run } = await setup();

    const { interactionId } = await run(1, {
      command: 'config',
      subcommand: ['set'],
      values: { key: 'colour' }
    });

    const [event] = sentTo<TBotInteractionEvent>(
      bot.id,
      ServerEvents.BOT_INTERACTION_CREATE
    );

    expect(event).toMatchObject({
      interactionId,
      userId: 1,
      channelId: GENERAL,
      command: { name: 'config' },
      options: [
        {
          name: 'set',
          type: BotCommandOptionType.SUB_COMMAND,
          options: [
            { name: 'key', type: BotCommandOptionType.STRING, value: 'colour' }
          ]
        }
      ]
    });

    const [row] = await tdb
      .select()
      .from(botInteractions)
      .where(eq(botInteractions.id, interactionId));

    expect(row).toMatchObject({
      botId: bot.id,
      userId: 1,
      commandName: 'config set',
      responded: false
    });
    // only the hash of the token the bot is handed is kept
    expect(row!.tokenHash).toBe(await sha256(event!.token));
  });

  test('describes the interaction to the gateway as discord does, with the options resolved', async () => {
    const { bot, applicationId, invoke } = await setup();
    const event = await invoke({
      command: 'roll',
      values: { sides: 4, for: 2, where: GENERAL, role: 2 }
    });

    const payload = (await buildInteractionPayload(event, bot.id)) as TJson;

    expect(payload).toMatchObject({
      application_id: applicationId,
      type: 2,
      token: event.token,
      version: 1,
      context: 0,
      data: { name: 'roll', type: 1 }
    });
    expect((payload.member as TJson).permissions).toBeString();

    const data = payload.data as TJson;
    const options = data.options as TJson[];
    const resolved = data.resolved as Record<string, TJson>;

    expect(options.map((option) => option.name)).toEqual([
      'sides',
      'for',
      'where',
      'role'
    ]);
    expect(options[0]!.value).toBe(4);
    expect(Object.keys(resolved.users!)).toEqual([options[1]!.value as string]);
    expect(Object.keys(resolved.members!)).toEqual([
      options[1]!.value as string
    ]);
    expect(Object.keys(resolved.channels!)).toEqual([
      options[2]!.value as string
    ]);
    expect(Object.keys(resolved.roles!)).toEqual([options[3]!.value as string]);
  });

  test('refuses a command that does not exist, and a user command, as not found', async () => {
    const { commandId } = await setup();
    const { caller } = await initTest(1);

    await expect(
      caller.bots.runCommand({ commandId: 99_999, channelId: GENERAL })
    ).rejects.toThrow('Command not found.');
    await expect(
      caller.bots.runCommand({
        commandId: commandId('Wave'),
        channelId: GENERAL
      })
    ).rejects.toThrow('Command not found.');
  });

  test('refuses a channel the member cannot see', async () => {
    const { run } = await setup();

    await expect(
      run(2, { command: 'roll', channelId: RESTRICTED, values: { sides: 2 } })
    ).rejects.toThrow('Insufficient channel permissions');
  });

  test('refuses a channel the bot cannot see', async () => {
    const { run } = await setup();

    // user 3 is in this dm, the bot is not
    await expect(
      run(3, { command: 'roll', channelId: DM_CHANNEL, values: { sides: 2 } })
    ).rejects.toThrow("This bot can't see this channel.");
  });

  test('keeps a command behind its default member permissions', async () => {
    const { run } = await setup();

    await expect(run(2, { command: 'admin' })).rejects.toThrow(
      "You don't have permission to use this command."
    );
    expect(await run(1, { command: 'admin' })).toHaveProperty('interactionId');
  });

  test('refuses an offline bot', async () => {
    const { run } = await setup();

    spyOn(gateway, 'isBotConnected').mockReturnValue(false);

    await expect(
      run(1, { command: 'roll', values: { sides: 2 } })
    ).rejects.toThrow('This bot is offline right now.');
  });

  test.each([
    ['a missing required option', { values: {} }, 'Fill in "sides".'],
    [
      'an unknown option',
      { values: { sides: 2, colour: 'red' } },
      'This command has no "colour" option.'
    ],
    [
      'text for a number',
      { values: { sides: 'six' } },
      '"sides" has to be a whole number.'
    ],
    [
      'a fraction for an integer',
      { values: { sides: 2.5 } },
      '"sides" has to be a whole number.'
    ],
    [
      'a number out of range',
      { values: { sides: 7 } },
      '"sides" is out of range.'
    ],
    [
      'a member who does not exist',
      { values: { sides: 2, for: 999 } },
      'That member could not be found.'
    ],
    [
      'a role that does not exist',
      { values: { sides: 2, role: 999 } },
      'That role could not be found.'
    ],
    [
      'a channel the member cannot see',
      { values: { sides: 2, where: DM_CHANNEL } },
      'That channel could not be found.'
    ]
  ])('refuses %s', async (_, input, message) => {
    const { run } = await setup();

    await expect(
      run(2, { command: 'roll', ...(input as { values: TJson }) } as never)
    ).rejects.toThrow(message);
  });

  test('refuses a missing or unknown subcommand, and a choice it does not offer', async () => {
    const { run } = await setup();

    await expect(run(1, { command: 'config' })).rejects.toThrow(
      'Pick a subcommand to run.'
    );
    await expect(
      run(1, { command: 'config', subcommand: ['reset'] })
    ).rejects.toThrow('This command has no "reset" subcommand.');
    await expect(
      run(1, {
        command: 'config',
        subcommand: ['set'],
        values: { key: 'size' }
      })
    ).rejects.toThrow('Pick one of the choices for "key".');
  });

  test('refuses a command that needs a file, which a bot cannot be handed yet', async () => {
    const { run } = await setup();

    await expect(run(1, { command: 'upload' })).rejects.toThrow(
      'Fill in "file".'
    );
    await expect(
      run(1, { command: 'upload', values: { file: 'x' } })
    ).rejects.toThrow(`SandShark can't fill in "file" for a bot yet.`);
  });

  test('tells the member when the bot does not answer in time', async () => {
    const { sentTo, invoke } = await setup();
    const event = await invoke();

    await Bun.sleep(RESPONSE_WINDOW_MS + 200);

    expect(
      sentTo<TJson>(1, ServerEvents.BOT_INTERACTION_FAILED).filter(
        (failure) => failure.interactionId === event.interactionId
      )
    ).toEqual([
      {
        interactionId: event.interactionId,
        botId: expect.any(Number),
        channelId: GENERAL,
        commandName: 'roll'
      }
    ]);
  }, 10_000);
});

describe('answering an interaction', () => {
  test('a message answer is posted by the bot with who ran which command', async () => {
    const { bot, sentTo, invoke, callback } = await setup();
    const event = await invoke();

    const { status } = await callback(event, {
      type: 4,
      data: { content: 'rolled **4**' }
    });

    expect(status).toBe(204);

    const [message] = await botMessages(bot.id);

    expect(message).toMatchObject({
      content: '<p>rolled <strong>4</strong></p>',
      channelId: GENERAL,
      interactionId: event.interactionId,
      interactionUserId: 1,
      interactionCommandName: 'roll',
      loading: false
    });
    // the answer did not fail, so the member is not told it did
    expect(sentTo(1, ServerEvents.BOT_INTERACTION_FAILED)).toEqual([]);
  });

  // discord.js asks with "true" and discord.py with "1"
  test.each(['true', '1'])(
    'with_response=%s hands back the answer as a discord command message',
    async (flag) => {
      const { applicationId, invoke, callback } = await setup();
      const event = await invoke();

      const { status, body } = await callback(
        event,
        { type: 4, data: { content: 'hi' } },
        `?with_response=${flag}`
      );

      expect(status).toBe(200);

      const message = (body.resource as TJson).message as TJson;

      expect(message).toMatchObject({
        type: 20,
        content: 'hi',
        webhook_id: applicationId,
        interaction_metadata: { type: 2, name: 'roll' }
      });
      expect((body.interaction as TJson).response_message_id).toBe(message.id);
    }
  );

  test('an ephemeral answer goes to the member alone and posts nothing', async () => {
    const { bot, sentTo, invoke, callback } = await setup();
    const event = await invoke();

    const { status } = await callback(event, {
      type: 4,
      data: { content: 'just you', flags: 64 }
    });

    expect(status).toBe(204);
    expect(await botMessages(bot.id)).toEqual([]);
    expect(sentTo(1, ServerEvents.BOT_EPHEMERAL_MESSAGE)).toEqual([
      expect.objectContaining({
        interactionId: event.interactionId,
        botId: bot.id,
        channelId: GENERAL,
        commandName: 'roll',
        content: '<p>just you</p>',
        loading: false
      })
    ]);
  });

  test('a deferred answer thinks, and filling it in is not an edit', async () => {
    const { bot, invoke, callback, webhook } = await setup();
    const event = await invoke();

    expect((await callback(event, { type: 5 })).status).toBe(204);

    const [thinking] = await botMessages(bot.id);

    expect(thinking).toMatchObject({ content: '', loading: true });

    const original = await webhook(event, '/messages/@original');

    expect(original.body).toMatchObject({ content: '', flags: 128 });

    const filled = await webhook(event, '/messages/@original', {
      method: 'PATCH',
      body: { content: 'done' }
    });

    expect(filled.status).toBe(200);
    expect(filled.body).toMatchObject({ content: 'done', flags: 0 });

    const [message] = await botMessages(bot.id);

    expect(message).toMatchObject({
      content: '<p>done</p>',
      loading: false,
      editedAt: null
    });
  });

  test('a deferred ephemeral answer is filled in for the member alone', async () => {
    const { bot, sentTo, invoke, callback, webhook } = await setup();
    const event = await invoke();

    await callback(event, { type: 5, data: { flags: 64 } });

    const filled = await webhook(event, '/messages/@original', {
      method: 'PATCH',
      body: { content: 'private result' }
    });

    expect(filled.body).toMatchObject({ content: 'private result', flags: 64 });
    expect(await botMessages(bot.id)).toEqual([]);
    expect(
      sentTo<TJson>(1, ServerEvents.BOT_EPHEMERAL_MESSAGE).map((message) => [
        message.content,
        message.loading
      ])
    ).toEqual([
      ['', true],
      ['<p>private result</p>', false]
    ]);
  });

  test('a second answer is refused as already acknowledged', async () => {
    const { invoke, callback } = await setup();
    const event = await invoke();

    await callback(event, { type: 4, data: { content: 'one' } });

    const second = await callback(event, { type: 4, data: { content: 'two' } });

    expect(second.status).toBe(400);
    expect(second.body).toEqual({
      message: 'Interaction has already been acknowledged.',
      code: 40060
    });
  });

  test('an answer after the response window, or with a wrong token or id, is an unknown interaction', async () => {
    const { invoke, callback } = await setup();
    const event = await invoke();
    const unknown = { message: 'Unknown interaction', code: 10062 };

    const wrongToken = await callback(
      { ...event, token: 'not-the-token' },
      { type: 4, data: { content: 'x' } }
    );

    expect(wrongToken.status).toBe(404);
    expect(wrongToken.body).toEqual(unknown);

    const wrongId = await callback(
      { ...event, createdAt: event.createdAt - 1 },
      { type: 4, data: { content: 'x' } }
    );

    expect(wrongId.body).toEqual(unknown);

    await tdb
      .update(botInteractions)
      .set({ createdAt: Date.now() - RESPONSE_WINDOW_MS - 1 })
      .where(eq(botInteractions.id, event.interactionId));

    const late = await callback(
      { ...event, createdAt: Date.now() - RESPONSE_WINDOW_MS - 1 },
      { type: 4, data: { content: 'x' } }
    );

    expect(late.status).toBe(404);
  });

  test('refuses an empty answer and answer types sandshark does not have yet', async () => {
    const { invoke, callback } = await setup();
    const event = await invoke();

    const empty = await callback(event, { type: 4, data: { content: ' ' } });

    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: 'Cannot send an empty message',
      code: 50006
    });

    const modal = await callback(event, { type: 9, data: {} });

    expect(modal.status).toBe(400);
    expect((modal.body as TJson).code).toBe(50035);
  });
});

describe('the interaction webhook', () => {
  test('is unknown before the first answer, and to a different application', async () => {
    const { invoke, webhook, callback, applicationId } = await setup();
    const event = await invoke();
    const unknown = { message: 'Unknown Webhook', code: 10015 };

    const early = await webhook(event, '', {
      method: 'POST',
      body: { content: 'too soon' }
    });

    expect(early.status).toBe(404);
    expect(early.body).toEqual(unknown);

    await callback(event, { type: 4, data: { content: 'answer' } });

    const otherApplication = await botApiRequest(
      `/webhooks/${applicationId}1/${event.token}/messages/@original`,
      null
    );

    expect(otherApplication.body).toEqual(unknown);
  });

  test('follow ups are posted by the bot without the command header, public or private', async () => {
    const { bot, sentTo, invoke, callback, webhook } = await setup();
    const event = await invoke();

    await callback(event, { type: 4, data: { content: 'first' } });

    const followup = await webhook(event, '', {
      method: 'POST',
      body: { content: 'second' }
    });

    expect(followup.status).toBe(200);
    expect(followup.body).toMatchObject({ content: 'second', type: 0 });

    const rows = await botMessages(bot.id);

    expect(
      rows.map((row) => [row.content, row.interactionId, row.interactionUserId])
    ).toEqual([
      ['<p>first</p>', event.interactionId, 1],
      ['<p>second</p>', event.interactionId, null]
    ]);

    const fetched = await webhook(event, `/messages/${followup.body.id}`);

    expect(fetched.body).toEqual(followup.body);

    const privateFollowup = await webhook(event, '', {
      method: 'POST',
      body: { content: 'psst', flags: 64 }
    });

    expect(privateFollowup.body).toMatchObject({ content: 'psst', flags: 64 });
    expect(sentTo(1, ServerEvents.BOT_EPHEMERAL_MESSAGE)).toHaveLength(1);
  });

  test('after a deferred answer the first follow up fills in the thinking message', async () => {
    const { bot, invoke, callback, webhook } = await setup();
    const event = await invoke();

    await callback(event, { type: 5 });

    const first = await webhook(event, '', {
      method: 'POST',
      body: { content: 'done thinking' }
    });
    const second = await webhook(event, '', {
      method: 'POST',
      body: { content: 'one more thing' }
    });

    expect(first.body).toMatchObject({ content: 'done thinking', type: 20 });
    expect(second.body).toMatchObject({ content: 'one more thing', type: 0 });

    const rows = await botMessages(bot.id);

    expect(rows.map((row) => [row.content, row.loading])).toEqual([
      ['<p>done thinking</p>', false],
      ['<p>one more thing</p>', false]
    ]);
  });

  test('follow ups still work after the original answer is deleted', async () => {
    const { bot, invoke, callback, webhook } = await setup();
    const event = await invoke();

    await callback(event, { type: 4, data: { content: 'original' } });
    await webhook(event, '/messages/@original', { method: 'DELETE' });

    const followup = await webhook(event, '', {
      method: 'POST',
      body: { content: 'still here' }
    });

    expect(followup.status).toBe(200);
    expect((await botMessages(bot.id)).map((row) => row.content)).toEqual([
      '<p>still here</p>'
    ]);
  });

  test("reaches only this interaction's messages", async () => {
    const { bot, invoke, callback, webhook } = await setup();
    const first = await invoke();

    await callback(first, { type: 4, data: { content: 'first' } });

    const second = await invoke();

    await callback(second, { type: 4, data: { content: 'second' } });

    const firstOriginal = await webhook(first, '/messages/@original');
    const crossed = await webhook(second, `/messages/${firstOriginal.body.id}`);

    expect(crossed.status).toBe(404);
    expect(crossed.body).toEqual({ message: 'Unknown Message', code: 10008 });
    expect(await botMessages(bot.id)).toHaveLength(2);
  });

  test('deleting the original removes the message, or tells the member to drop the private one', async () => {
    const { bot, sentTo, invoke, callback, webhook } = await setup();
    const publicEvent = await invoke();

    await callback(publicEvent, { type: 4, data: { content: 'gone soon' } });

    const deleted = await webhook(publicEvent, '/messages/@original', {
      method: 'DELETE'
    });

    expect(deleted.status).toBe(204);
    expect(await botMessages(bot.id)).toEqual([]);

    const privateEvent = await invoke();

    await callback(privateEvent, {
      type: 4,
      data: { content: 'private', flags: 64 }
    });

    const [ephemeral] = sentTo<TJson>(1, ServerEvents.BOT_EPHEMERAL_MESSAGE);

    await webhook(privateEvent, '/messages/@original', { method: 'DELETE' });

    expect(sentTo(1, ServerEvents.BOT_EPHEMERAL_MESSAGE_DELETE)).toEqual([
      { id: ephemeral!.id, channelId: GENERAL }
    ]);
    expect(
      await tdb
        .select()
        .from(botEphemeralMessages)
        .where(
          eq(botEphemeralMessages.interactionId, privateEvent.interactionId)
        )
    ).toEqual([]);
  });

  test('is unknown once the token has expired', async () => {
    const { invoke, callback, webhook } = await setup();
    const event = await invoke();

    await callback(event, { type: 4, data: { content: 'answer' } });
    await tdb
      .update(botInteractions)
      .set({ createdAt: Date.now() - TOKEN_LIFETIME_MS - 1 })
      .where(eq(botInteractions.id, event.interactionId));

    const expired = await webhook(event, '/messages/@original');

    expect(expired.status).toBe(404);
    expect(expired.body).toEqual({ message: 'Unknown Webhook', code: 10015 });
  });

  test('cleanup removes expired interactions and keeps who ran the command on the answer', async () => {
    const { bot, invoke, callback } = await setup();
    const event = await invoke();

    await callback(event, { type: 4, data: { content: 'answer' } });
    await tdb
      .update(botInteractions)
      .set({ createdAt: Date.now() - TOKEN_LIFETIME_MS - 1 })
      .where(eq(botInteractions.id, event.interactionId));

    cleanupBotInteractions();

    expect(await tdb.select().from(botInteractions)).toEqual([]);

    const [message] = await botMessages(bot.id);

    expect(message).toMatchObject({
      interactionId: null,
      interactionUserId: 1,
      interactionCommandName: 'roll'
    });
  });
});

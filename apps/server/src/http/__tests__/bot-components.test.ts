import {
  BotButtonStyle,
  BotComponentType,
  ServerEvents
} from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import {
  botApiRequest,
  createTestBot,
  initTest
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { botInteractions, channels, messages, users } from '../../db/schema';
import { channelSnowflake } from '../../helpers/discord/channel';
import {
  buildInteractionPayload,
  interactionSnowflake
} from '../../helpers/discord/interaction';
import { messageSnowflake } from '../../helpers/discord/message';
import { userSnowflake } from '../../helpers/discord/user';
import type { TBotInteractionEvent } from '../../types';
import { pubsub } from '../../utils/pubsub';
import * as gateway from '../bot-api/gateway';

type TJson = Record<string, unknown>;

const GENERAL = 1;
const RESTRICTED = 5;

const button = (customId: string, extra: TJson = {}) => ({
  type: BotComponentType.BUTTON,
  style: BotButtonStyle.PRIMARY,
  label: customId,
  custom_id: customId,
  ...extra
});

const row = (...components: unknown[]) => ({
  type: BotComponentType.ACTION_ROW,
  components
});

const COMPONENTS = [
  row(
    button('yes'),
    button('no', { style: BotButtonStyle.DANGER }),
    button('off', { disabled: true }),
    {
      type: BotComponentType.BUTTON,
      style: BotButtonStyle.LINK,
      label: 'Docs',
      url: 'https://example.com'
    }
  ),
  row({
    type: BotComponentType.STRING_SELECT,
    custom_id: 'colour',
    placeholder: 'Pick colours',
    min_values: 1,
    max_values: 2,
    options: [
      { label: 'Red', value: 'red' },
      { label: 'Blue', value: 'blue', default: true },
      { label: 'Green', value: 'green' }
    ]
  })
];

const setup = async () => {
  const { bot, token } = await createTestBot();
  const botRow = await tdb
    .select()
    .from(users)
    .where(eq(users.id, bot.id))
    .get();
  const applicationId = userSnowflake(botRow!);
  const channelPath = async (channelId: number) => {
    const channel = await tdb
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .get();

    return `/channels/${channelSnowflake(channel!)}/messages`;
  };

  spyOn(gateway, 'isBotConnected').mockReturnValue(true);

  const published = spyOn(pubsub, 'publishFor');
  const sentTo = <T>(userId: number, topic: ServerEvents) =>
    published.mock.calls
      .filter(([target, event]) => target === userId && event === topic)
      .map(([, , payload]) => payload as T);

  // the bot posts a message with the buttons and select menu above
  const post = async (
    channelId = GENERAL,
    components: unknown = COMPONENTS
  ) => {
    const { body } = await botApiRequest<TJson>(
      await channelPath(channelId),
      token,
      { method: 'POST', body: { content: 'Choose', components } }
    );
    const rows = await tdb
      .select()
      .from(messages)
      .where(eq(messages.userId, bot.id))
      .orderBy(asc(messages.id))
      .all();

    return { body, message: rows.at(-1)! };
  };

  const press = async (
    userId: number,
    input: {
      messageId?: number;
      ephemeralMessageId?: number;
      customId: string;
      values?: string[];
    }
  ) => {
    const { caller } = await initTest(userId);

    return caller.bots.pressComponent(input);
  };

  const lastEvent = () =>
    sentTo<TBotInteractionEvent>(
      bot.id,
      ServerEvents.BOT_INTERACTION_CREATE
    ).at(-1)!;

  const callback = (event: TBotInteractionEvent, body: unknown, query = '') =>
    botApiRequest<TJson>(
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
    botApiRequest<TJson>(
      `/webhooks/${applicationId}/${event.token}${path}`,
      null,
      init
    );

  return {
    bot,
    token,
    applicationId,
    channelPath,
    sentTo,
    post,
    press,
    lastEvent,
    callback,
    webhook
  };
};

const messageRow = (id: number) =>
  tdb.select().from(messages).where(eq(messages.id, id)).get();

describe('bot message components', () => {
  test('are stored and handed back in discord form', async () => {
    const { post } = await setup();

    const { body, message } = await post();

    expect(message.components).toEqual([
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            label: 'yes',
            customId: 'yes',
            disabled: false
          },
          { type: 2, style: 4, label: 'no', customId: 'no', disabled: false },
          { type: 2, style: 1, label: 'off', customId: 'off', disabled: true },
          {
            type: 2,
            style: 5,
            label: 'Docs',
            url: 'https://example.com',
            disabled: false
          }
        ]
      },
      {
        type: 1,
        components: [
          {
            type: 3,
            customId: 'colour',
            placeholder: 'Pick colours',
            minValues: 1,
            maxValues: 2,
            disabled: false,
            options: [
              { label: 'Red', value: 'red', default: false },
              { label: 'Blue', value: 'blue', default: true },
              { label: 'Green', value: 'green', default: false }
            ]
          }
        ]
      }
    ]);
    expect((body.components as TJson[])[1]).toMatchObject({
      type: 1,
      components: [
        { type: 3, custom_id: 'colour', min_values: 1, max_values: 2 }
      ]
    });
  });

  test.each([
    [
      'a link button with a custom id',
      [row({ ...button('x'), style: 5, url: 'https://a.b' })]
    ],
    [
      'a button with no label or emoji',
      [row({ ...button('x'), label: undefined })]
    ],
    ['the same custom id twice', [row(button('x'), button('x'))]],
    [
      'six buttons in a row',
      [row(...['a', 'b', 'c', 'd', 'e', 'f'].map((id) => button(id)))]
    ],
    [
      'a select menu beside a button',
      [
        row(button('x'), {
          type: 3,
          custom_id: 'y',
          options: [{ label: 'a', value: 'a' }]
        })
      ]
    ],
    [
      'a select menu allowing more choices than it has',
      [
        row({
          type: 3,
          custom_id: 'y',
          max_values: 2,
          options: [{ label: 'a', value: 'a' }]
        })
      ]
    ],
    [
      'six rows',
      Array.from({ length: 6 }, (_, index) => row(button(`b${index}`)))
    ]
  ])('refuses %s', async (_, components) => {
    const { bot, token, channelPath } = await setup();

    const { status, body } = await botApiRequest<TJson>(
      await channelPath(GENERAL),
      token,
      { method: 'POST', body: { content: 'Choose', components } }
    );

    expect(status).toBe(400);
    expect(body.code).toBe(50035);
    expect(
      await tdb.select().from(messages).where(eq(messages.userId, bot.id))
    ).toEqual([]);
  });

  test('components alone are not a message', async () => {
    const { token, channelPath } = await setup();

    const { status, body } = await botApiRequest<TJson>(
      await channelPath(GENERAL),
      token,
      { method: 'POST', body: { components: [row(button('x'))] } }
    );

    expect(status).toBe(400);
    expect(body.code).toBe(50006);
  });
});

describe('pressing a component', () => {
  test('hands the bot a component interaction with the message it is on', async () => {
    const { bot, post, press, lastEvent } = await setup();
    const { message } = await post();

    const { interactionId } = await press(1, {
      messageId: message.id,
      customId: 'colour',
      values: ['red', 'blue']
    });

    const event = lastEvent();

    expect(event).toMatchObject({
      kind: 'component',
      interactionId,
      customId: 'colour',
      componentType: BotComponentType.STRING_SELECT,
      values: ['red', 'blue'],
      messageId: message.id,
      ephemeralMessageId: null
    });

    const [stored] = await tdb
      .select()
      .from(botInteractions)
      .where(eq(botInteractions.id, interactionId));

    expect(stored).toMatchObject({ commandName: '', messageId: message.id });

    const payload = (await buildInteractionPayload(event, bot.id, {
      botId: bot.id,
      origin: 'http://localhost',
      mediaToken: ''
    })) as TJson;

    expect(payload).toMatchObject({
      type: 3,
      data: {
        custom_id: 'colour',
        component_type: 3,
        values: ['red', 'blue']
      },
      message: { id: messageSnowflake(message), content: 'Choose' }
    });
  });

  test('refuses a message that is not a bot message, and one that does not exist', async () => {
    const { press } = await setup();
    const { caller } = await initTest(1);
    const memberMessageId = await caller.messages.send({
      channelId: GENERAL,
      content: '<p>hi</p>',
      files: []
    });

    await expect(
      press(1, { messageId: memberMessageId!, customId: 'yes' })
    ).rejects.toThrow('Message not found.');
    await expect(
      press(1, { messageId: 99_999, customId: 'yes' })
    ).rejects.toThrow('Message not found.');
  });

  test('refuses a channel the member cannot see', async () => {
    const { post, press } = await setup();
    const { message } = await post();

    // members cannot post in the restricted channel, so the bot's message is moved there
    await tdb
      .update(messages)
      .set({ channelId: RESTRICTED })
      .where(eq(messages.id, message.id));

    await expect(
      press(2, { messageId: message.id, customId: 'yes' })
    ).rejects.toThrow('Insufficient channel permissions');
  });

  test.each([
    [
      'a custom id the message does not have',
      { customId: 'maybe' },
      'That button is no longer there.'
    ],
    ['a link button', { customId: 'Docs' }, 'That button is no longer there.'],
    ['a disabled button', { customId: 'off' }, 'That button is disabled.'],
    [
      'a choice on a button',
      { customId: 'yes', values: ['red'] },
      'A button takes no choice.'
    ],
    [
      'an option the menu does not have',
      { customId: 'colour', values: ['pink'] },
      'That choice is not one of the options.'
    ],
    [
      'too many choices',
      { customId: 'colour', values: ['red', 'blue', 'green'] },
      'That choice is not one of the options.'
    ],
    [
      'no choice',
      { customId: 'colour', values: [] },
      'That choice is not one of the options.'
    ]
  ])('refuses %s', async (_, input, message) => {
    const { post, press } = await setup();
    const { message: posted } = await post();

    await expect(press(2, { messageId: posted.id, ...input })).rejects.toThrow(
      message
    );
  });

  test('refuses an offline bot', async () => {
    const { post, press } = await setup();
    const { message } = await post();

    spyOn(gateway, 'isBotConnected').mockReturnValue(false);

    await expect(
      press(1, { messageId: message.id, customId: 'yes' })
    ).rejects.toThrow('This bot is offline right now.');
  });
});

describe('answering a component', () => {
  test('an update answer edits the message the button is on', async () => {
    const { post, press, lastEvent, callback } = await setup();
    const { message } = await post();

    await press(1, { messageId: message.id, customId: 'yes' });

    const { status, body } = await callback(
      lastEvent(),
      { type: 7, data: { content: 'You chose yes', components: [] } },
      '?with_response=true'
    );

    expect(status).toBe(200);
    expect((body.resource as TJson).message).toMatchObject({
      id: messageSnowflake(message),
      content: 'You chose yes',
      components: []
    });

    const updated = await messageRow(message.id);

    expect(updated).toMatchObject({
      content: '<p>You chose yes</p>',
      components: null
    });
  });

  test('an update that names no components keeps them', async () => {
    const { post, press, lastEvent, callback } = await setup();
    const { message } = await post();

    await press(1, { messageId: message.id, customId: 'yes' });
    await callback(lastEvent(), {
      type: 7,
      data: { content: 'Still choosing' }
    });

    const updated = await messageRow(message.id);

    expect(updated!.components).toEqual(message.components);
  });

  test('a deferred update lets the bot edit the message later through @original', async () => {
    const { post, press, lastEvent, callback, webhook } = await setup();
    const { message } = await post();

    await press(1, { messageId: message.id, customId: 'no' });

    const event = lastEvent();
    const deferred = await callback(event, { type: 6 });

    expect(deferred.status).toBe(204);
    expect((await messageRow(message.id))!.content).toBe('<p>Choose</p>');

    const edited = await webhook(event, '/messages/@original', {
      method: 'PATCH',
      body: { content: 'Declined' }
    });

    expect(edited.status).toBe(200);
    expect((await messageRow(message.id))!.content).toBe('<p>Declined</p>');
  });

  test('a message answer posts a new message without a command header', async () => {
    const { bot, post, press, lastEvent, callback } = await setup();
    const { message } = await post();

    await press(1, { messageId: message.id, customId: 'yes' });

    const { body } = await callback(
      lastEvent(),
      { type: 4, data: { content: 'Thanks' } },
      '?with_response=true'
    );

    const replies = await tdb
      .select()
      .from(messages)
      .where(eq(messages.userId, bot.id))
      .orderBy(asc(messages.id))
      .all();

    expect(replies.at(-1)).toMatchObject({
      content: '<p>Thanks</p>',
      interactionUserId: 1,
      interactionCommandName: ''
    });
    expect((body.resource as TJson).message).toMatchObject({
      type: 0,
      interaction_metadata: { type: 3 }
    });
  });

  test('a slash command cannot be answered with an update', async () => {
    const { bot, token, applicationId, lastEvent, callback } = await setup();

    await botApiRequest(`/applications/${applicationId}/commands`, token, {
      method: 'PUT',
      body: [{ name: 'ping', description: 'Ping' }]
    });

    const { caller } = await initTest(1);
    const [command] = await caller.bots.getCommands();

    await caller.bots.runCommand({
      commandId: command!.commandId,
      channelId: GENERAL
    });

    const { status, body } = await callback(lastEvent(), {
      type: 7,
      data: { content: 'nope' }
    });

    expect(status).toBe(400);
    expect(body.message).toBe(
      'Only a button or select menu interaction can update its message.'
    );
    expect(
      (await tdb.select().from(messages).where(eq(messages.userId, bot.id)))
        .length
    ).toBe(0);
  });

  test('buttons on an ephemeral answer work for its member alone, and update it in place', async () => {
    const { bot, token, applicationId, sentTo, press, lastEvent, callback } =
      await setup();

    await botApiRequest(`/applications/${applicationId}/commands`, token, {
      method: 'PUT',
      body: [{ name: 'menu', description: 'Menu' }]
    });

    const { caller } = await initTest(1);
    const [command] = await caller.bots.getCommands();

    await caller.bots.runCommand({
      commandId: command!.commandId,
      channelId: GENERAL
    });
    await callback(lastEvent(), {
      type: 4,
      data: {
        content: 'Only you',
        flags: 64,
        components: [row(button('confirm'))]
      }
    });

    const [ephemeral] = sentTo<TJson>(1, ServerEvents.BOT_EPHEMERAL_MESSAGE);

    expect(ephemeral!.components).toHaveLength(1);

    await expect(
      press(2, {
        ephemeralMessageId: ephemeral!.id as number,
        customId: 'confirm'
      })
    ).rejects.toThrow('Message not found.');

    await press(1, {
      ephemeralMessageId: ephemeral!.id as number,
      customId: 'confirm'
    });

    const { status } = await callback(lastEvent(), {
      type: 7,
      data: { content: 'Confirmed', components: [] }
    });

    expect(status).toBe(204);

    const updates = sentTo<TJson>(1, ServerEvents.BOT_EPHEMERAL_MESSAGE);

    expect(updates.at(-1)).toMatchObject({
      id: ephemeral!.id,
      content: '<p>Confirmed</p>',
      components: null
    });
    expect(
      await tdb.select().from(messages).where(eq(messages.userId, bot.id))
    ).toEqual([]);
  });
});

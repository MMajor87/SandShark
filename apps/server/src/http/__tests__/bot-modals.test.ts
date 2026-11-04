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
import { TOKEN_LIFETIME_MS } from '../../helpers/bot-interactions';
import { channelSnowflake } from '../../helpers/discord/channel';
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

const textInput = (customId: string, extra: TJson = {}) => ({
  type: BotComponentType.TEXT_INPUT,
  custom_id: customId,
  style: 1,
  ...extra
});

// the newer shape, each input inside a label
const LABELLED_MODAL = {
  custom_id: 'feedback',
  title: 'Feedback',
  components: [
    {
      type: BotComponentType.LABEL,
      label: 'Name',
      description: 'What we call you',
      component: textInput('name', { max_length: 20 })
    },
    {
      type: BotComponentType.LABEL,
      label: 'Thoughts',
      component: textInput('thoughts', { style: 2, required: false })
    }
  ]
};

// the older shape, each input alone in an action row and carrying its own label
const ROW_MODAL = {
  custom_id: 'rename',
  title: 'Rename',
  components: [
    {
      type: BotComponentType.ACTION_ROW,
      components: [textInput('new-name', { label: 'New name', value: 'old' })]
    }
  ]
};

const setup = async () => {
  const { bot, token } = await createTestBot();
  const botRow = await tdb
    .select()
    .from(users)
    .where(eq(users.id, bot.id))
    .get();
  const applicationId = userSnowflake(botRow!);

  await botApiRequest(`/applications/${applicationId}/commands`, token, {
    method: 'PUT',
    body: [{ name: 'feedback', description: 'Give feedback' }]
  });

  spyOn(gateway, 'isBotConnected').mockReturnValue(true);

  const published = spyOn(pubsub, 'publishFor');
  const sentTo = <T>(userId: number, topic: ServerEvents) =>
    published.mock.calls
      .filter(([target, event]) => target === userId && event === topic)
      .map(([, , payload]) => payload as T);
  const lastEvent = () =>
    sentTo<TBotInteractionEvent>(
      bot.id,
      ServerEvents.BOT_INTERACTION_CREATE
    ).at(-1)!;

  const runCommand = async () => {
    const { caller } = await initTest(1);
    const [command] = await caller.bots.getCommands();

    await caller.bots.runCommand({
      commandId: command!.commandId,
      channelId: GENERAL
    });

    return lastEvent();
  };

  const callback = (event: TBotInteractionEvent, body: unknown) =>
    botApiRequest<TJson>(
      `/interactions/${interactionSnowflake({
        id: event.interactionId,
        createdAt: event.createdAt
      })}/${event.token}/callback`,
      null,
      { method: 'POST', body }
    );

  const submit = async (
    userId: number,
    interactionId: number,
    values: Record<string, string>
  ) => {
    const { caller } = await initTest(userId);

    return caller.bots.submitModal({ interactionId, values });
  };

  return {
    bot,
    token,
    sentTo,
    lastEvent,
    runCommand,
    callback,
    submit
  };
};

describe('bot modals', () => {
  test('a command answered with a modal opens it for the member alone', async () => {
    const { sentTo, runCommand, callback } = await setup();
    const event = await runCommand();

    const { status } = await callback(event, { type: 9, data: LABELLED_MODAL });

    expect(status).toBe(204);
    expect(sentTo(1, ServerEvents.BOT_MODAL_OPEN)).toEqual([
      {
        interactionId: event.interactionId,
        botId: expect.any(Number),
        channelId: GENERAL,
        customId: 'feedback',
        title: 'Feedback',
        labelled: true,
        inputs: [
          {
            customId: 'name',
            label: 'Name',
            description: 'What we call you',
            style: 1,
            required: true,
            maxLength: 20
          },
          { customId: 'thoughts', label: 'Thoughts', style: 2, required: false }
        ]
      }
    ]);

    const [row] = await tdb
      .select()
      .from(botInteractions)
      .where(eq(botInteractions.id, event.interactionId));

    expect(row).toMatchObject({
      responded: true,
      modal: { customId: 'feedback' }
    });
  });

  test.each([
    [
      'labels mixed with action rows',
      {
        ...LABELLED_MODAL,
        components: [LABELLED_MODAL.components[0], ROW_MODAL.components[0]]
      }
    ],
    [
      'an action row input without a label',
      {
        ...ROW_MODAL,
        components: [{ type: 1, components: [textInput('x')] }]
      }
    ],
    [
      'the same custom id twice',
      {
        ...ROW_MODAL,
        components: [ROW_MODAL.components[0], ROW_MODAL.components[0]]
      }
    ],
    ['a title over 45 characters', { ...ROW_MODAL, title: 'x'.repeat(46) }],
    [
      'a minimum over the maximum',
      {
        ...ROW_MODAL,
        components: [
          {
            type: 1,
            components: [
              textInput('x', { label: 'X', min_length: 5, max_length: 2 })
            ]
          }
        ]
      }
    ],
    [
      'six inputs',
      {
        ...ROW_MODAL,
        components: Array.from({ length: 6 }, (_, index) => ({
          type: 1,
          components: [textInput(`x${index}`, { label: 'X' })]
        }))
      }
    ]
  ])('refuses %s without using up the interaction', async (_, modal) => {
    const { runCommand, callback } = await setup();
    const event = await runCommand();

    const refused = await callback(event, { type: 9, data: modal });

    expect(refused.status).toBe(400);

    const retry = await callback(event, { type: 9, data: ROW_MODAL });

    expect(retry.status).toBe(204);
  });

  test('a submitted modal reaches the bot in the shape it was sent in', async () => {
    const { bot, runCommand, callback, submit, lastEvent } = await setup();
    const source = await runCommand();

    await callback(source, { type: 9, data: LABELLED_MODAL });
    await submit(1, source.interactionId, { name: 'Alice', thoughts: '' });

    const event = lastEvent();

    expect(event).toMatchObject({
      kind: 'modal',
      customId: 'feedback',
      labelled: true,
      values: [
        { customId: 'name', value: 'Alice' },
        { customId: 'thoughts', value: '' }
      ]
    });

    const payload = (await buildInteractionPayload(event, bot.id, {
      botId: bot.id,
      origin: 'http://localhost',
      mediaToken: ''
    })) as TJson;

    expect(payload).toMatchObject({
      type: 5,
      data: {
        custom_id: 'feedback',
        components: [
          {
            type: 18,
            component: { type: 4, custom_id: 'name', value: 'Alice' }
          },
          { type: 18, component: { type: 4, custom_id: 'thoughts', value: '' } }
        ]
      }
    });

    const [row] = await tdb
      .select()
      .from(botInteractions)
      .where(eq(botInteractions.id, event.interactionId));

    expect(row).toMatchObject({ type: 5, commandName: 'feedback' });
  });

  test('an action row modal comes back in action rows, and its answer names the command', async () => {
    const { bot, runCommand, callback, submit, lastEvent } = await setup();
    const source = await runCommand();

    await callback(source, { type: 9, data: ROW_MODAL });
    await submit(1, source.interactionId, { 'new-name': 'fresh' });

    const event = lastEvent();
    const payload = (await buildInteractionPayload(event, bot.id, {
      botId: bot.id,
      origin: 'http://localhost',
      mediaToken: ''
    })) as TJson;

    expect((payload.data as TJson).components).toEqual([
      {
        type: 1,
        components: [{ type: 4, custom_id: 'new-name', value: 'fresh' }]
      }
    ]);

    await callback(event, { type: 4, data: { content: 'Renamed' } });

    const [answer] = await tdb
      .select()
      .from(messages)
      .where(eq(messages.userId, bot.id));

    expect(answer).toMatchObject({
      content: '<p>Renamed</p>',
      interactionUserId: 1,
      interactionCommandName: 'feedback'
    });
  });

  test('a modal submit cannot be answered with another modal', async () => {
    const { runCommand, callback, submit, lastEvent } = await setup();
    const source = await runCommand();

    await callback(source, { type: 9, data: ROW_MODAL });
    await submit(1, source.interactionId, { 'new-name': 'x' });

    const { status, body } = await callback(lastEvent(), {
      type: 9,
      data: ROW_MODAL
    });

    expect(status).toBe(400);
    expect(body.message).toBe(
      'A modal submit cannot be answered with a modal.'
    );
  });

  test('a modal is submitted once, and only by its member', async () => {
    const { runCommand, callback, submit } = await setup();
    const source = await runCommand();

    await callback(source, { type: 9, data: ROW_MODAL });

    await expect(
      submit(2, source.interactionId, { 'new-name': 'x' })
    ).rejects.toThrow('This form is no longer open.');

    await submit(1, source.interactionId, { 'new-name': 'x' });

    await expect(
      submit(1, source.interactionId, { 'new-name': 'y' })
    ).rejects.toThrow('This form is no longer open.');
  });

  test.each([
    [
      'a field the form does not have',
      { name: 'A', colour: 'red' },
      'This form has no such field.'
    ],
    ['a required field left blank', { name: ' ' }, 'Fill in "Name".'],
    [
      'a value over its maximum',
      { name: 'x'.repeat(21) },
      '"Name" is too short or too long.'
    ]
  ])('refuses %s', async (_, values, message) => {
    const { runCommand, callback, submit } = await setup();
    const source = await runCommand();

    await callback(source, { type: 9, data: LABELLED_MODAL });

    await expect(submit(1, source.interactionId, values)).rejects.toThrow(
      message
    );
  });

  test('refuses a modal whose token has expired, and an offline bot', async () => {
    const { runCommand, callback, submit } = await setup();
    const expired = await runCommand();

    await callback(expired, { type: 9, data: ROW_MODAL });
    await tdb
      .update(botInteractions)
      .set({ createdAt: Date.now() - TOKEN_LIFETIME_MS - 1 })
      .where(eq(botInteractions.id, expired.interactionId));

    await expect(
      submit(1, expired.interactionId, { 'new-name': 'x' })
    ).rejects.toThrow('This form is no longer open.');

    const offline = await runCommand();

    await callback(offline, { type: 9, data: ROW_MODAL });
    spyOn(gateway, 'isBotConnected').mockReturnValue(false);

    await expect(
      submit(1, offline.interactionId, { 'new-name': 'x' })
    ).rejects.toThrow('This bot is offline right now.');
  });

  test('a modal opened from a button carries its message, so the answer can update it', async () => {
    const { bot, token, callback, submit, lastEvent } = await setup();
    const channel = await tdb
      .select()
      .from(channels)
      .where(eq(channels.id, GENERAL))
      .get();

    await botApiRequest(
      `/channels/${channelSnowflake(channel!)}/messages`,
      token,
      {
        method: 'POST',
        body: {
          content: 'Rename me',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: BotButtonStyle.PRIMARY,
                  label: 'Rename',
                  custom_id: 'rename'
                }
              ]
            }
          ]
        }
      }
    );

    const [message] = await tdb
      .select()
      .from(messages)
      .where(eq(messages.userId, bot.id))
      .orderBy(asc(messages.id));
    const { caller } = await initTest(1);

    await caller.bots.pressComponent({
      messageId: message!.id,
      customId: 'rename'
    });
    await callback(lastEvent(), { type: 9, data: ROW_MODAL });

    const pressed = lastEvent();

    await submit(1, pressed.interactionId, { 'new-name': 'Renamed' });

    const event = lastEvent();

    expect(event).toMatchObject({ kind: 'modal', messageId: message!.id });

    const { status } = await callback(event, {
      type: 7,
      data: { content: 'Renamed', components: [] }
    });

    expect(status).toBe(204);

    const updated = await tdb
      .select()
      .from(messages)
      .where(eq(messages.id, message!.id))
      .get();

    expect(updated).toMatchObject({
      content: '<p>Renamed</p>',
      components: null
    });
  });
});

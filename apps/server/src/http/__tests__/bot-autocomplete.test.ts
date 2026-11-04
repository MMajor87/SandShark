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

const setup = async () => {
  const { bot, token } = await createTestBot();
  const row = await tdb.select().from(users).where(eq(users.id, bot.id)).get();
  const applicationId = userSnowflake(row!);

  await botApiRequest(`/applications/${applicationId}/commands`, token, {
    method: 'PUT',
    body: [
      {
        name: 'city',
        description: 'Weather for a city',
        options: [
          {
            type: BotCommandOptionType.STRING,
            name: 'name',
            description: 'The city',
            required: true,
            autocomplete: true
          },
          {
            type: BotCommandOptionType.INTEGER,
            name: 'days',
            description: 'How many days'
          }
        ]
      }
    ]
  });

  spyOn(gateway, 'isBotConnected').mockReturnValue(true);

  const published = spyOn(pubsub, 'publishFor');
  const { caller } = await initTest(1);
  const [command] = await caller.bots.getCommands();

  // the member's request waits for the bot, so it is started and the bot answers meanwhile
  const ask = (focused: string, values: Record<string, string | number>) =>
    caller.bots.autocomplete({
      commandId: command!.commandId,
      channelId: GENERAL,
      values,
      focused
    });

  const nextEvent = async () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const call = published.mock.calls.find(
        ([target, topic]) =>
          target === bot.id && topic === ServerEvents.BOT_INTERACTION_CREATE
      );

      if (call) return call[2] as TBotInteractionEvent;

      await Bun.sleep(10);
    }

    throw new Error('the bot was never asked');
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

  return { bot, ask, nextEvent, callback };
};

describe('bot autocomplete', () => {
  test("hands the member the bot's suggestions for the option being typed", async () => {
    const { bot, ask, nextEvent, callback } = await setup();
    const asked = ask('name', { name: 'lis', days: 3 });
    const event = await nextEvent();

    expect(event).toMatchObject({
      kind: 'autocomplete',
      options: [
        { name: 'name', value: 'lis', focused: true },
        { name: 'days', value: 3 }
      ]
    });

    const payload = (await buildInteractionPayload(event, bot.id, {
      botId: bot.id,
      origin: 'http://localhost',
      mediaToken: ''
    })) as TJson;

    expect(payload).toMatchObject({
      type: 4,
      data: {
        name: 'city',
        options: [
          { name: 'name', type: 3, value: 'lis', focused: true },
          { name: 'days', type: 4, value: 3 }
        ]
      }
    });

    const { status } = await callback(event, {
      type: 8,
      data: {
        choices: [
          { name: 'Lisbon', value: 'lisbon' },
          { name: 'Lismore', value: 'lismore' }
        ]
      }
    });

    expect(status).toBe(204);
    expect(await asked).toEqual({
      choices: [
        { name: 'Lisbon', value: 'lisbon' },
        { name: 'Lismore', value: 'lismore' }
      ]
    });
  });

  test('offers nothing when the bot does not answer in time', async () => {
    const { ask } = await setup();

    expect(await ask('name', { name: 'x' })).toEqual({ choices: [] });
  }, 10_000);

  test('refuses an option the bot does not complete', async () => {
    const { ask } = await setup();

    await expect(ask('days', { days: 1 })).rejects.toThrow(
      'This option has no suggestions.'
    );
  });

  test('only suggestions answer an autocomplete, and only once', async () => {
    const { ask, nextEvent, callback } = await setup();
    const asked = ask('name', { name: 'a' });
    const event = await nextEvent();

    const message = await callback(event, { type: 4, data: { content: 'no' } });

    expect(message.status).toBe(400);

    await callback(event, { type: 8, data: { choices: [] } });

    const again = await callback(event, { type: 8, data: { choices: [] } });

    expect(again.status).toBe(400);
    expect(again.body.code).toBe(40060);
    expect(await asked).toEqual({ choices: [] });
  });

  test('suggestions do not answer a slash command', async () => {
    const { bot } = await setup();
    const { caller } = await initTest(1);
    const [command] = await caller.bots.getCommands();
    const published = spyOn(pubsub, 'publishFor');

    await caller.bots.runCommand({
      commandId: command!.commandId,
      channelId: GENERAL,
      values: { name: 'Lisbon' }
    });

    const event = published.mock.calls.find(
      ([target, topic]) =>
        target === bot.id && topic === ServerEvents.BOT_INTERACTION_CREATE
    )![2] as TBotInteractionEvent;
    const { status } = await botApiRequest(
      `/interactions/${interactionSnowflake({
        id: event.interactionId,
        createdAt: event.createdAt
      })}/${event.token}/callback`,
      null,
      { method: 'POST', body: { type: 8, data: { choices: [] } } }
    );

    expect(status).toBe(400);
  });
});

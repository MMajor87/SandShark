import { ServerEvents } from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import {
  botApiRequest,
  createTestBot,
  initTest
} from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { channels, messages, users } from '../../db/schema';
import { channelSnowflake } from '../../helpers/discord/channel';
import { interactionSnowflake } from '../../helpers/discord/interaction';
import { userSnowflake } from '../../helpers/discord/user';
import type { TBotInteractionEvent } from '../../types';
import { pubsub } from '../../utils/pubsub';
import * as gateway from '../bot-api/gateway';

type TJson = Record<string, unknown>;

const GENERAL = 1;

const setup = async () => {
  const { bot, token } = await createTestBot();
  const channel = await tdb
    .select()
    .from(channels)
    .where(eq(channels.id, GENERAL))
    .get();
  const user = await tdb.select().from(users).where(eq(users.id, 2)).get();

  return {
    bot,
    token,
    path: `/channels/${channelSnowflake(channel!)}/messages`,
    memberMention: `<@${userSnowflake(user!)}>`
  };
};

const scoreEmbed = (mention: string) => ({
  title: 'Scores',
  description: `**${mention}** is ahead`,
  url: 'https://example.com/scores',
  color: 0x00ff00,
  timestamp: '2026-11-03T12:00:00.000Z',
  footer: { text: 'Updated hourly', icon_url: 'https://example.com/f.png' },
  author: { name: 'Scoreboard', url: 'https://example.com' },
  fields: [
    { name: 'First', value: '*10* points', inline: true },
    { name: 'Second', value: '7 points' }
  ],
  image: { url: 'https://example.com/chart.png' },
  thumbnail: { url: 'https://example.com/thumb.png' }
});

const botMessages = (botId: number) =>
  tdb
    .select()
    .from(messages)
    .where(eq(messages.userId, botId))
    .orderBy(asc(messages.id))
    .all();

describe('bot api embeds', () => {
  test('a message with an embed stores it as html and hands it back in discord form', async () => {
    const { bot, token, path, memberMention } = await setup();
    const embed = scoreEmbed(memberMention);

    const { status, body } = await botApiRequest<TJson>(path, token, {
      method: 'POST',
      body: { content: 'latest', embeds: [embed] }
    });

    expect(status).toBe(200);

    const [row] = await botMessages(bot.id);

    expect(row!.content).toBe('<p>latest</p>');
    expect(row!.embeds).toEqual([
      {
        title: 'Scores',
        description: expect.stringContaining('<strong>'),
        url: 'https://example.com/scores',
        color: 0x00ff00,
        timestamp: '2026-11-03T12:00:00.000Z',
        footer: {
          text: 'Updated hourly',
          iconUrl: 'https://example.com/f.png'
        },
        author: { name: 'Scoreboard', url: 'https://example.com' },
        fields: [
          { name: 'First', value: '<p><em>10</em> points</p>', inline: true },
          { name: 'Second', value: '<p>7 points</p>', inline: false }
        ],
        image: { url: 'https://example.com/chart.png' },
        thumbnail: { url: 'https://example.com/thumb.png' }
      }
    ]);
    expect((body.embeds as TJson[])[0]).toMatchObject({
      type: 'rich',
      title: 'Scores',
      // the mention survives the round trip
      description: `**${memberMention}** is ahead`,
      fields: [
        { name: 'First', value: '*10* points', inline: true },
        { name: 'Second', value: '7 points', inline: false }
      ],
      footer: { text: 'Updated hourly', icon_url: 'https://example.com/f.png' }
    });
  });

  test('a message can be embeds alone', async () => {
    const { bot, token, path } = await setup();

    const { status, body } = await botApiRequest<TJson>(path, token, {
      method: 'POST',
      body: { embeds: [{ title: 'Just this' }] }
    });

    expect(status).toBe(200);
    expect(body.content).toBe('');

    const [row] = await botMessages(bot.id);

    expect(row).toMatchObject({
      content: '',
      embeds: [{ title: 'Just this' }]
    });
  });

  test('an edit changes only what it names', async () => {
    const { bot, token, path } = await setup();
    const created = await botApiRequest<TJson>(path, token, {
      method: 'POST',
      body: { content: 'text', embeds: [{ title: 'One' }] }
    });
    const messagePath = `${path}/${created.body.id}`;

    await botApiRequest(messagePath, token, {
      method: 'PATCH',
      body: { embeds: [{ title: 'Two' }] }
    });

    let [row] = await botMessages(bot.id);

    expect(row).toMatchObject({
      content: '<p>text</p>',
      embeds: [{ title: 'Two' }]
    });

    await botApiRequest(messagePath, token, {
      method: 'PATCH',
      body: { content: 'new text' }
    });

    [row] = await botMessages(bot.id);

    expect(row).toMatchObject({
      content: '<p>new text</p>',
      embeds: [{ title: 'Two' }]
    });

    await botApiRequest(messagePath, token, {
      method: 'PATCH',
      body: { embeds: [] }
    });

    [row] = await botMessages(bot.id);

    expect(row!.embeds).toBeNull();
  });

  test('removing the embeds of an embed only message would empty it, so it is refused', async () => {
    const { token, path } = await setup();
    const created = await botApiRequest<TJson>(path, token, {
      method: 'POST',
      body: { embeds: [{ title: 'Only' }] }
    });

    const { status } = await botApiRequest(
      `${path}/${created.body.id}`,
      token,
      {
        method: 'PATCH',
        body: { embeds: [] }
      }
    );

    expect(status).toBe(400);
  });

  test.each([
    ['a url that is not http', [{ title: 'x', url: 'javascript:alert(1)' }]],
    ['an image that is not http', [{ image: { url: 'attachment://a.png' } }]],
    ['an empty embed', [{}]],
    ['a colour out of range', [{ title: 'x', color: 0x1000000 }]],
    ['more than 10 embeds', Array.from({ length: 11 }, () => ({ title: 'x' }))],
    [
      'more than 25 fields',
      [
        {
          fields: Array.from({ length: 26 }, () => ({ name: 'n', value: 'v' }))
        }
      ]
    ],
    [
      'more than 6000 characters in all',
      Array.from({ length: 2 }, () => ({ description: 'x'.repeat(3_001) }))
    ]
  ])('refuses %s with invalid form body', async (_, embeds) => {
    const { bot, token, path } = await setup();

    const { status, body } = await botApiRequest<TJson>(path, token, {
      method: 'POST',
      body: { content: 'hi', embeds }
    });

    expect(status).toBe(400);
    expect(body.code).toBe(50035);
    expect(await botMessages(bot.id)).toEqual([]);
  });

  test('a member cannot send an embed', async () => {
    const { caller } = await initTest(1);

    const messageId = await caller.messages.send({
      channelId: GENERAL,
      content: '<p>hello</p>',
      files: [],
      // not part of the procedure's input, so it is dropped
      ...({ embeds: [{ title: 'Sneaky' }] } as object)
    });

    const row = await tdb
      .select()
      .from(messages)
      .where(eq(messages.id, messageId!))
      .get();

    expect(row!.embeds).toBeNull();
  });
});

describe('interaction answers with embeds', () => {
  const answer = async (data: TJson, type = 4) => {
    const { bot, token } = await createTestBot();
    const row = await tdb
      .select()
      .from(users)
      .where(eq(users.id, bot.id))
      .get();
    const applicationId = userSnowflake(row!);

    await botApiRequest(`/applications/${applicationId}/commands`, token, {
      method: 'PUT',
      body: [{ name: 'score', description: 'Score' }]
    });

    spyOn(gateway, 'isBotConnected').mockReturnValue(true);

    const published = spyOn(pubsub, 'publishFor');
    const { caller } = await initTest(1);
    const { commandId } = (await caller.bots.getCommands())[0]!;

    await caller.bots.runCommand({ commandId, channelId: GENERAL });

    const event = published.mock.calls.find(
      ([, topic]) => topic === ServerEvents.BOT_INTERACTION_CREATE
    )![2] as TBotInteractionEvent;
    const callback = await botApiRequest(
      `/interactions/${interactionSnowflake({
        id: event.interactionId,
        createdAt: event.createdAt
      })}/${event.token}/callback`,
      null,
      { method: 'POST', body: { type, data } }
    );

    return { bot, event, applicationId, published, callback };
  };

  test('a public answer can be an embed alone', async () => {
    const { bot, callback } = await answer({
      embeds: [{ title: 'Score: 10' }]
    });

    expect(callback.status).toBe(204);

    const [row] = await botMessages(bot.id);

    expect(row).toMatchObject({
      content: '',
      embeds: [{ title: 'Score: 10' }],
      interactionCommandName: 'score'
    });
  });

  test('an ephemeral answer carries its embeds to the member', async () => {
    const { published, callback } = await answer({
      flags: 64,
      embeds: [{ title: 'Private score' }]
    });

    expect(callback.status).toBe(204);

    const ephemeral = published.mock.calls.find(
      ([, topic]) => topic === ServerEvents.BOT_EPHEMERAL_MESSAGE
    );

    expect(ephemeral?.[2]).toMatchObject({
      content: '',
      embeds: [{ title: 'Private score' }]
    });
  });

  test('a deferred answer can be filled in with embeds alone', async () => {
    const { bot, event, applicationId } = await answer({}, 5);

    const filled = await botApiRequest<TJson>(
      `/webhooks/${applicationId}/${event.token}/messages/@original`,
      null,
      { method: 'PATCH', body: { embeds: [{ title: 'Done' }] } }
    );

    expect(filled.status).toBe(200);
    expect((filled.body.embeds as TJson[])[0]).toMatchObject({ title: 'Done' });

    const [row] = await botMessages(bot.id);

    expect(row).toMatchObject({ loading: false, embeds: [{ title: 'Done' }] });
  });

  test('an answer refused for its embeds does not use up the interaction', async () => {
    const { event, callback } = await answer({ embeds: [{}] });

    expect(callback.status).toBe(400);

    const retry = await botApiRequest(
      `/interactions/${interactionSnowflake({
        id: event.interactionId,
        createdAt: event.createdAt
      })}/${event.token}/callback`,
      null,
      { method: 'POST', body: { type: 4, data: { embeds: [{ title: 'Ok' }] } } }
    );

    expect(retry.status).toBe(204);
  });
});

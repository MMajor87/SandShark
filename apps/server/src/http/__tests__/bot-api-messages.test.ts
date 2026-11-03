import { Permission } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import {
  botApiRequest,
  createTestBot,
  initTest,
  uploadFile
} from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import {
  channels,
  messageReactions,
  messages,
  rolePermissions,
  settings,
  users
} from '../../db/schema';
import { channelSnowflake } from '../../helpers/discord/channel';
import { messageSnowflake } from '../../helpers/discord/message';
import { encodeSnowflake, SnowflakeTag } from '../../helpers/discord/snowflake';
import { userSnowflake } from '../../helpers/discord/user';

type TJson = Record<string, unknown>;

// the seeded member role every new bot starts with
const MEMBER_ROLE_ID = 2;

const channelId = async (id: number) =>
  channelSnowflake(
    (await tdb.select().from(channels).where(eq(channels.id, id)).get())!
  );

const getMessageRow = async (id: number) =>
  tdb.select().from(messages).where(eq(messages.id, id)).get();

const messageIdOf = async (snowflake: string) => {
  const rows = await tdb.select().from(messages);

  return rows.find((row) => messageSnowflake(row) === snowflake)!.id;
};

const grantMemberRole = (permission: Permission) =>
  tdb.insert(rolePermissions).values({
    roleId: MEMBER_ROLE_ID,
    permission,
    createdAt: Date.now()
  });

const revokeMemberRole = (permission: Permission) =>
  tdb
    .delete(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, MEMBER_ROLE_ID),
        eq(rolePermissions.permission, permission)
      )
    );

const send = async (token: string, content: string, extra: TJson = {}) =>
  botApiRequest(`/channels/${await channelId(1)}/messages`, token, {
    method: 'POST',
    body: { content, ...extra }
  });

describe('bot api messages', () => {
  describe('create', () => {
    test('stores the markdown as the html a member would send and answers a discord message', async () => {
      const { bot, token } = await createTestBot();
      const userTwo = (await tdb
        .select()
        .from(users)
        .where(eq(users.id, 2))
        .get())!;
      const { status, body } = await send(
        token,
        `**hi** <@${userSnowflake(userTwo)}>`
      );

      expect(status).toBe(200);

      const row = await getMessageRow(await messageIdOf(body.id as string));

      expect(row).toMatchObject({ userId: bot.id, channelId: 1 });
      expect(row!.content).toBe(
        '<p><strong>hi</strong> <span data-type="mention" data-user-id="2" class="mention">@Test User</span></p>'
      );
      expect(body).toMatchObject({
        type: 0,
        channel_id: await channelId(1),
        content: `**hi** <@${userSnowflake(userTwo)}>`,
        tts: false,
        pinned: false
      });
      expect((body.author as TJson).bot).toBe(true);
      expect((body.mentions as TJson[]).map((user) => user.id)).toEqual([
        userSnowflake(userTwo)
      ]);
    });

    test('a message reference becomes a reply', async () => {
      const { token } = await createTestBot();
      const first = await send(token, 'first');
      const reply = await send(token, 'second', {
        message_reference: { message_id: first.body.id }
      });

      expect(reply.body.type).toBe(19);
      expect((reply.body.message_reference as TJson).message_id).toBe(
        first.body.id
      );

      const row = await getMessageRow(
        await messageIdOf(reply.body.id as string)
      );

      expect(row!.replyToMessageId).toBe(
        await messageIdOf(first.body.id as string)
      );
    });

    // discord.py sends snowflakes as json numbers, beyond what a javascript number holds
    test('a reply target sent as a raw json number keeps every digit', async () => {
      const { token } = await createTestBot();
      const first = await send(token, 'first');
      const response = await fetch(
        `${testsBaseUrl}/api/v10/channels/${await channelId(1)}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json'
          },
          body: `{"content":"second","message_reference":{"message_id":${first.body.id}}}`
        }
      );
      const reply = (await response.json()) as TJson;

      expect(response.status).toBe(200);
      expect((reply.message_reference as TJson).message_id).toBe(first.body.id);
    });

    test('refuses an empty message, a bad body and an unknown reply target', async () => {
      const { token } = await createTestBot();

      expect(await send(token, '   ')).toMatchObject({
        status: 400,
        body: { code: 50006 }
      });
      expect(
        await botApiRequest(`/channels/${await channelId(1)}/messages`, token, {
          method: 'POST',
          body: { content: 'x'.repeat(2001) }
        })
      ).toMatchObject({ status: 400, body: { code: 50035 } });

      const notJson = await fetch(
        `${testsBaseUrl}/api/v10/channels/${await channelId(1)}/messages`,
        {
          method: 'POST',
          headers: { Authorization: `Bot ${token}` },
          body: 'content=hi'
        }
      );

      expect(notJson.status).toBe(400);
      expect(
        await send(token, 'reply', {
          message_reference: {
            message_id: encodeSnowflake(SnowflakeTag.MESSAGE, 999, Date.now())
          }
        })
      ).toMatchObject({ status: 404, body: { code: 10008 } });
    });

    test('a hidden channel or a foreign dm is unknown, nothing is stored', async () => {
      const { token } = await createTestBot();
      const before = (await tdb.select().from(messages)).length;

      for (const id of [3, 4]) {
        const result = await botApiRequest(
          `/channels/${await channelId(id)}/messages`,
          token,
          { method: 'POST', body: { content: 'hello' } }
        );

        expect(result).toEqual({
          status: 404,
          body: { message: 'Unknown Channel', code: 10003 }
        });
      }

      expect(await tdb.select().from(messages)).toHaveLength(before);
    });

    test('the send procedure decides permissions, as it does for members', async () => {
      const { token } = await createTestBot();

      await revokeMemberRole(Permission.SEND_MESSAGES);

      expect(await send(token, 'hello')).toEqual({
        status: 403,
        body: { message: 'Missing Permissions', code: 50013 }
      });
    });
  });

  describe('read', () => {
    test('pages history newest first with before, after and around', async () => {
      const { token } = await createTestBot();
      const sent: string[] = [];

      for (const text of ['one', 'two', 'three', 'four']) {
        sent.push((await send(token, text)).body.id as string);
      }

      const path = `/channels/${await channelId(1)}/messages`;
      const contents = (body: TJson) =>
        (body as unknown as TJson[]).map((message) => message.content);

      expect(
        contents((await botApiRequest(`${path}?limit=2`, token)).body)
      ).toEqual(['four', 'three']);
      expect(
        contents(
          (await botApiRequest(`${path}?limit=2&before=${sent[2]}`, token)).body
        )
      ).toEqual(['two', 'one']);
      expect(
        contents(
          (await botApiRequest(`${path}?limit=2&after=${sent[0]}`, token)).body
        )
      ).toEqual(['three', 'two']);
      expect(
        contents(
          (await botApiRequest(`${path}?limit=3&around=${sent[1]}`, token)).body
        )
      ).toEqual(['three', 'two', 'one']);
    });

    test('rejects conflicting or invalid paging', async () => {
      const { token } = await createTestBot();
      const path = `/channels/${await channelId(1)}/messages`;

      for (const query of [
        'limit=0',
        'limit=101',
        'before=abc',
        'before=1&after=2'
      ]) {
        expect((await botApiRequest(`${path}?${query}`, token)).status).toBe(
          400
        );
      }
    });

    test('a single message by id, unknown when it is in another channel', async () => {
      const { token } = await createTestBot();
      const { body } = await send(token, 'find me');
      const found = await botApiRequest(
        `/channels/${await channelId(1)}/messages/${body.id}`,
        token
      );

      expect(found.body.content).toBe('find me');

      const elsewhere = await botApiRequest(
        `/channels/${await channelId(5)}/messages/${body.id}`,
        token
      );

      expect(elsewhere).toEqual({
        status: 404,
        body: { message: 'Unknown Message', code: 10008 }
      });
    });

    test('attachments carry an absolute url the bot can download', async () => {
      const { token } = await createTestBot();
      const { caller, mockedToken } = await initTest(1);
      const upload = await uploadFile(
        new File(['hello'], 'note.txt', { type: 'text/plain' }),
        mockedToken
      );
      const temp = (await upload.json()) as { id: string };

      await caller.messages.send({
        channelId: 1,
        content: '<p>file</p>',
        files: [temp.id]
      });

      const { body } = await botApiRequest(
        `/channels/${await channelId(1)}/messages?limit=1`,
        token
      );
      const [message] = body as unknown as TJson[];
      const [attachment] = message!.attachments as TJson[];

      expect(attachment).toMatchObject({ filename: 'note.txt', size: 5 });
      expect(attachment!.content_type as string).toStartWith('text/plain');
      expect(attachment!.url as string).toStartWith(`${testsBaseUrl}/public/`);

      const download = await fetch(attachment!.url as string);

      expect(download.status).toBe(200);
      expect(await download.text()).toBe('hello');
    });
  });

  describe('edit and delete', () => {
    test('the bot edits and deletes its own message', async () => {
      const { token } = await createTestBot();
      const { body } = await send(token, 'draft');
      const path = `/channels/${await channelId(1)}/messages/${body.id}`;
      const id = await messageIdOf(body.id as string);
      const edited = await botApiRequest(path, token, {
        method: 'PATCH',
        body: { content: '*final*' }
      });

      expect(edited.body.content).toBe('*final*');
      expect(edited.body.edited_timestamp).not.toBeNull();
      expect((await getMessageRow(id))!.content).toBe('<p><em>final</em></p>');

      expect(
        (await botApiRequest(path, token, { method: 'DELETE' })).status
      ).toBe(204);
      expect(await getMessageRow(id)).toBeUndefined();
    });

    test('cannot edit or delete a message someone else wrote', async () => {
      const { token } = await createTestBot();
      const [seeded] = await tdb
        .select()
        .from(messages)
        .where(eq(messages.channelId, 1));
      const path = `/channels/${await channelId(1)}/messages/${messageSnowflake(seeded!)}`;

      expect(
        (
          await botApiRequest(path, token, {
            method: 'PATCH',
            body: { content: 'x' }
          })
        ).status
      ).toBe(403);
      expect(
        (await botApiRequest(path, token, { method: 'DELETE' })).status
      ).toBe(403);
      expect(await getMessageRow(seeded!.id)).toBeDefined();
    });
  });

  describe('reactions', () => {
    const reactionRows = (messageId: number) =>
      tdb
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.messageId, messageId));

    test('put and delete name the state they want, so repeating them changes nothing', async () => {
      const { bot, token } = await createTestBot();
      const { body } = await send(token, 'react to me');
      const id = await messageIdOf(body.id as string);
      const path = `/channels/${await channelId(1)}/messages/${body.id}/reactions/${encodeURIComponent('👍')}/@me`;

      await grantMemberRole(Permission.REACT_TO_MESSAGES);

      for (let i = 0; i < 2; i++) {
        expect(
          (await botApiRequest(path, token, { method: 'PUT' })).status
        ).toBe(204);
      }

      // stored as the shortcode a member's client uses for the same emoji
      expect(
        (await reactionRows(id)).map((row) => [row.userId, row.emoji])
      ).toEqual([[bot.id, '+1']]);

      const read = await botApiRequest(
        `/channels/${await channelId(1)}/messages/${body.id}`,
        token
      );

      expect(read.body.reactions).toEqual([
        {
          count: 1,
          count_details: { burst: 0, normal: 1 },
          me: true,
          me_burst: false,
          burst_colors: [],
          emoji: { id: null, name: '👍' }
        }
      ]);

      for (let i = 0; i < 2; i++) {
        expect(
          (await botApiRequest(path, token, { method: 'DELETE' })).status
        ).toBe(204);
      }

      expect(await reactionRows(id)).toHaveLength(0);
    });

    test('a member reaction and a bot reaction with the same emoji are one reaction', async () => {
      const { bot, token } = await createTestBot();
      const { body } = await send(token, 'shared reaction');
      const id = await messageIdOf(body.id as string);
      const path = `/channels/${await channelId(1)}/messages/${body.id}`;
      const { caller } = await initTest(1);

      await grantMemberRole(Permission.REACT_TO_MESSAGES);
      await caller.messages.toggleReaction({ messageId: id, emoji: '+1' });

      const before = await botApiRequest(path, token);

      expect(before.body.reactions).toMatchObject([
        { count: 1, me: false, emoji: { id: null, name: '👍' } }
      ]);

      await botApiRequest(
        `${path}/reactions/${encodeURIComponent('👍')}/@me`,
        token,
        {
          method: 'PUT'
        }
      );
      // an older reaction stored as the raw character joins the same group
      await tdb.insert(messageReactions).values({
        messageId: id,
        userId: 2,
        emoji: '👍',
        createdAt: Date.now()
      });

      const after = await botApiRequest(path, token);

      expect(after.body.reactions).toMatchObject([
        { count: 3, me: true, emoji: { id: null, name: '👍' } }
      ]);
      expect(
        (await reactionRows(id)).filter((row) => row.userId === bot.id)
      ).toHaveLength(1);
    });

    test('reacting needs the react permission', async () => {
      const { token } = await createTestBot();
      const { body } = await send(token, 'no reactions');

      expect(
        (
          await botApiRequest(
            `/channels/${await channelId(1)}/messages/${body.id}/reactions/${encodeURIComponent('👍')}/@me`,
            token,
            { method: 'PUT' }
          )
        ).status
      ).toBe(403);
    });

    test('an unknown custom emoji is refused', async () => {
      const { token } = await createTestBot();
      const { body } = await send(token, 'custom');

      await grantMemberRole(Permission.REACT_TO_MESSAGES);

      expect(
        await botApiRequest(
          `/channels/${await channelId(1)}/messages/${body.id}/reactions/nope:123/@me`,
          token,
          { method: 'PUT' }
        )
      ).toEqual({
        status: 400,
        body: { message: 'Unknown Emoji', code: 10014 }
      });
    });
  });

  describe('typing', () => {
    test('signals typing in a visible channel and nowhere else', async () => {
      const { token } = await createTestBot();

      expect(
        (
          await botApiRequest(`/channels/${await channelId(1)}/typing`, token, {
            method: 'POST'
          })
        ).status
      ).toBe(204);
      expect(
        (
          await botApiRequest(`/channels/${await channelId(4)}/typing`, token, {
            method: 'POST'
          })
        ).status
      ).toBe(404);
    });
  });

  describe('dms', () => {
    const userTwoSnowflake = async () =>
      userSnowflake(
        (await tdb.select().from(users).where(eq(users.id, 2)).get())!
      );

    test('opens a dm with a member', async () => {
      const { token } = await createTestBot();
      const { status, body } = await botApiRequest(
        '/users/@me/channels',
        token,
        {
          method: 'POST',
          body: { recipient_id: await userTwoSnowflake() }
        }
      );

      expect(status).toBe(200);
      expect(body.type).toBe(1);
      expect((body.recipients as TJson[])[0]!.username).toBe('Test User');

      const message = await botApiRequest(
        `/channels/${body.id}/messages`,
        token,
        {
          method: 'POST',
          body: { content: 'hello there' }
        }
      );

      expect(message.status).toBe(200);
      expect(message.body).not.toHaveProperty('guild_id');
    });

    test('follows the server direct messages setting', async () => {
      const { token } = await createTestBot();

      await tdb.update(settings).set({ directMessagesEnabled: false });

      expect(
        (
          await botApiRequest('/users/@me/channels', token, {
            method: 'POST',
            body: { recipient_id: await userTwoSnowflake() }
          })
        ).status
      ).toBe(403);
    });

    test('an unknown recipient is an unknown user', async () => {
      const { token } = await createTestBot();

      expect(
        await botApiRequest('/users/@me/channels', token, {
          method: 'POST',
          body: {
            recipient_id: encodeSnowflake(SnowflakeTag.USER, 999, Date.now())
          }
        })
      ).toEqual({
        status: 404,
        body: { message: 'Unknown User', code: 10013 }
      });
    });
  });
});

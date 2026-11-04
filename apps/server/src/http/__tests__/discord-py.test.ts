import { Permission, ServerEvents } from '@sandshark/shared';
import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { and, asc, eq } from 'drizzle-orm';
import type http from 'http';
import path from 'node:path';
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

const PYTHON = process.env.SANDSHARK_PYTHON ?? 'python3';
const BOT_SCRIPT = path.join(import.meta.dir, 'fixtures', 'discord_py_bot.py');

// discord.py is a python package, so this needs a python with it installed. ci installs
// it and sets REQUIRE_DISCORD_PY, which turns a missing install into a failure instead
// of a skip; a contributor without python still gets a green run
const hasDiscordPy = () => {
  try {
    return Bun.spawnSync([PYTHON, '-I', '-c', 'import discord']).exitCode === 0;
  } catch {
    return false;
  }
};

const available = hasDiscordPy();

if (!available && process.env.REQUIRE_DISCORD_PY) {
  throw new Error(
    `discord.py is required but "${PYTHON} -c 'import discord'" failed`
  );
}

let server: http.Server;
let host: string;

beforeAll(async () => {
  ({ server, host } = await startRealtimeServer());
});

afterAll(() => {
  server.close();
});

const readLines = (stream: ReadableStream<Uint8Array>) => {
  const lines: string[] = [];
  const waiters: { prefix: string; resolve: (line: string) => void }[] = [];
  const decoder = new TextDecoder();
  let buffer = '';

  (async () => {
    for await (const chunk of stream) {
      buffer += decoder.decode(chunk);

      const parts = buffer.split('\n');

      buffer = parts.pop() ?? '';

      for (const line of parts) {
        lines.push(line.trim());

        for (const waiter of [...waiters]) {
          if (line.startsWith(waiter.prefix)) {
            waiters.splice(waiters.indexOf(waiter), 1);
            waiter.resolve(line.trim());
          }
        }
      }
    }
  })().catch(() => {});

  const waitForLine = (prefix: string, ms = 15_000) =>
    new Promise<string>((resolve, reject) => {
      const existing = lines.find((line) => line.startsWith(prefix));

      if (existing) {
        resolve(existing);
        return;
      }

      const timer = setTimeout(
        () =>
          reject(new Error(`no "${prefix}" line, got: ${lines.join(' | ')}`)),
        ms
      );

      waiters.push({
        prefix,
        resolve: (line) => {
          clearTimeout(timer);
          resolve(line);
        }
      });
    });

  return { waitForLine, all: () => [...lines, buffer].join('\n') };
};

// the promise of #46 for python: an unmodified discord.py bot, given only this server's
// rest base url and a bot token, logs in, reads the guild, answers a command and reacts
describe('discord.py compatibility', () => {
  test.skipIf(!available)(
    'a ping bot logs in, replies, reacts and reads history',
    async () => {
      const { caller } = await initTest(1);
      const { token, bot } = await caller.bots.create({ name: 'Py Bot' });
      const published = spyOn(pubsub, 'publishFor');

      // members, and so new bots, cannot react by default
      await tdb.insert(rolePermissions).values({
        roleId: MEMBER_ROLE_ID,
        permission: Permission.REACT_TO_MESSAGES,
        createdAt: Date.now()
      });

      const child = Bun.spawn([PYTHON, '-I', BOT_SCRIPT, host, token], {
        stdout: 'pipe',
        stderr: 'pipe'
      });
      const stdout = readLines(child.stdout);
      const stderr = readLines(child.stderr);

      try {
        const ready = await stdout.waitForLine('READY').catch((error) => {
          // the bot's own traceback says more than the timeout does
          throw new Error(`${error.message}\n${stderr.all()}`);
        });

        expect(ready).toBe('READY Py Bot 1 General,Restricted Text');
        expect(await stdout.waitForLine('SYNCED')).toBe('SYNCED roll,slow 2');

        const commands = await tdb
          .select()
          .from(botCommands)
          .where(eq(botCommands.botId, bot.id))
          .orderBy(asc(botCommands.id));

        expect(
          commands.map((command) => [command.name, command.guildScoped])
        ).toEqual([
          ['roll', false],
          ['slow', false],
          ['roll', true],
          ['slow', true]
        ]);
        expect(commands[0]!.options).toEqual([
          {
            type: 4,
            name: 'sides',
            // discord.py's placeholder for an option with no description
            description: '…',
            required: true,
            minValue: 2,
            maxValue: 100
          }
        ]);

        const commandId = (name: string) =>
          commands.find((command) => command.name === name)!.id;
        const answers = () =>
          tdb
            .select()
            .from(messages)
            .where(eq(messages.userId, bot.id))
            .orderBy(asc(messages.id));
        const waitForAnswers = async (count: number) => {
          for (let attempt = 0; attempt < 100; attempt++) {
            const rows = await answers();

            if (rows.length >= count && rows.every((row) => !row.loading)) {
              return rows;
            }

            await Bun.sleep(50);
          }

          throw new Error(`the bot did not answer\n${stderr.all()}`);
        };

        await caller.bots.runCommand({
          commandId: commandId('roll'),
          channelId: 1,
          values: { sides: 4 }
        });
        await caller.bots.runCommand({
          commandId: commandId('slow'),
          channelId: 1
        });

        const commandAnswers = await waitForAnswers(2);

        expect(
          commandAnswers.map((row) => [
            row.content,
            row.interactionCommandName,
            row.editedAt
          ])
        ).toEqual([
          ['<p>4</p>', 'roll', null],
          ['<p>done</p>', 'slow', null]
        ]);
        expect(commandAnswers[0]!.embeds).toEqual([
          {
            title: 'Roll',
            description: '<p><strong>4</strong></p>',
            color: 0x3498db,
            fields: [{ name: 'Sides', value: '<p>4</p>', inline: true }]
          }
        ]);

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
        expect(ephemeral?.[2]).toMatchObject({
          content: '<p>and one more</p>'
        });

        const pingId = await caller.messages.send({
          channelId: 1,
          content: '<p>!ping</p>',
          files: []
        });

        await stdout.waitForLine('DONE').catch((error) => {
          throw new Error(`${error.message}\n${stderr.all()}`);
        });
        await child.exited;

        const botMessages = await answers();

        expect(botMessages.map((message) => message.content)).toEqual([
          '<p>4</p>',
          '<p>done</p>',
          '<p>pong</p>',
          // the seeded welcome message, the two command answers, the ping and the reply
          '<p>history:5</p>'
        ]);
        expect(botMessages[2]!.replyToMessageId).toBe(pingId);

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
        child.kill();
      }
    },
    40_000
  );
});

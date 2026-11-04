import {
  BotCommandOptionType,
  type TBotCommandOption,
  type TCommandArg
} from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import {
  isBotCommand,
  serializeBotCommandText,
  serializePluginCommandText,
  toBotCommandInvocation
} from '../helpers';

const args: TCommandArg[] = [
  { name: 'when', type: 'string' },
  { name: 'what', type: 'string' },
  { name: 'times', type: 'number' }
];

describe('serializePluginCommandText', () => {
  test('should send every filled argument in order', () => {
    expect(
      serializePluginCommandText('remind', args, {
        when: 'tomorrow',
        what: 'call mom',
        times: '2'
      })
    ).toBe('/remind tomorrow "call mom" 2');
  });

  // the server matches arguments by position, so a blank one has to hold its place
  test('should keep the position of a blank argument before a filled one', () => {
    expect(
      serializePluginCommandText('remind', args, { what: 'call mom' })
    ).toBe('/remind "" "call mom"');
  });

  test('should drop blank arguments at the end', () => {
    expect(serializePluginCommandText('remind', args, { when: 'now' })).toBe(
      '/remind now'
    );
  });

  test('should send a command with nothing filled as its name alone', () => {
    expect(serializePluginCommandText('remind', args, {})).toBe('/remind');
  });

  test('should send a boolean as true or false', () => {
    expect(
      serializePluginCommandText('toggle', [{ name: 'on', type: 'boolean' }], {
        on: 'true'
      })
    ).toBe('/toggle true');
  });
});

const botOptions: TBotCommandOption[] = [
  { type: BotCommandOptionType.STRING, name: 'text', description: 'Text' },
  { type: BotCommandOptionType.INTEGER, name: 'count', description: 'Count' },
  { type: BotCommandOptionType.BOOLEAN, name: 'loud', description: 'Loud' },
  { type: BotCommandOptionType.USER, name: 'who', description: 'Who' },
  { type: BotCommandOptionType.MENTIONABLE, name: 'ping', description: 'Ping' }
];

const botAttrs = (values: Record<string, string>) => ({
  commandId: '7',
  subcommand: JSON.stringify(['set']),
  options: JSON.stringify(botOptions),
  values: JSON.stringify(values)
});

describe('toBotCommandInvocation', () => {
  test('should turn each value into the type its option takes', () => {
    expect(
      toBotCommandInvocation(
        botAttrs({
          text: 'hello',
          count: '3',
          loud: 'false',
          who: '2',
          ping: 'role:4'
        })
      )
    ).toEqual({
      commandId: 7,
      subcommand: ['set'],
      values: { text: 'hello', count: 3, loud: false, who: 2, ping: 'role:4' }
    });
  });

  // a blank optional option is not given at all, rather than given as an empty string
  test('should leave out options left blank', () => {
    expect(
      toBotCommandInvocation(botAttrs({ text: '', count: '1' })).values
    ).toEqual({ count: 1 });
  });

  test('should ignore values for options the command does not have', () => {
    expect(toBotCommandInvocation(botAttrs({ stray: 'x' })).values).toEqual({});
  });

  test('should fall back to no subcommand and no values on damaged attributes', () => {
    expect(
      toBotCommandInvocation({
        commandId: '7',
        subcommand: 'not json',
        options: null,
        values: '{'
      })
    ).toEqual({ commandId: 7, subcommand: [], values: {} });
  });
});

describe('isBotCommand', () => {
  test('should tell a bot command from a plugin command', () => {
    expect(
      isBotCommand({
        commandId: 1,
        botId: 9,
        botName: 'Bot',
        name: 'ping',
        description: 'Ping',
        subcommand: [],
        options: []
      })
    ).toBe(true);
    expect(
      isBotCommand({ pluginId: 'p', pluginName: 'Plugin', name: 'ping' })
    ).toBe(false);
  });
});

describe('serializeBotCommandText', () => {
  test('should show the filled values after the command', () => {
    expect(
      serializeBotCommandText('config set', botOptions, {
        text: 'two words',
        count: '2'
      })
    ).toBe('/config set "two words" 2');
  });
});

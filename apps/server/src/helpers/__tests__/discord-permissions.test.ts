import { Permission } from '@sandshark/shared';
import { describe, expect, test } from 'bun:test';
import {
  DiscordPermission,
  toDiscordPermissions
} from '../discord/permissions';

const has = (bits: string, bit: bigint) => (BigInt(bits) & bit) === bit;

describe('discord permissions', () => {
  test('maps each sandshark permission onto its discord bits', () => {
    const bits = toDiscordPermissions([
      Permission.SEND_MESSAGES,
      Permission.REACT_TO_MESSAGES,
      Permission.MANAGE_USERS
    ]);

    expect(has(bits, DiscordPermission.SEND_MESSAGES)).toBe(true);
    expect(has(bits, DiscordPermission.ADD_REACTIONS)).toBe(true);
    expect(has(bits, DiscordPermission.KICK_MEMBERS)).toBe(true);
    expect(has(bits, DiscordPermission.BAN_MEMBERS)).toBe(true);
    expect(has(bits, DiscordPermission.MANAGE_MESSAGES)).toBe(false);
    expect(has(bits, DiscordPermission.ADMINISTRATOR)).toBe(false);
  });

  test('a role on its own grants no viewing, @everyone does', () => {
    expect(toDiscordPermissions([])).toBe('0');

    const everyone = toDiscordPermissions([], { isEveryone: true });

    expect(has(everyone, DiscordPermission.VIEW_CHANNEL)).toBe(true);
    expect(has(everyone, DiscordPermission.READ_MESSAGE_HISTORY)).toBe(true);
  });

  test('the owner role is an administrator with every mapped bit', () => {
    const bits = toDiscordPermissions([], { isOwner: true });

    expect(has(bits, DiscordPermission.ADMINISTRATOR)).toBe(true);
    expect(has(bits, DiscordPermission.MANAGE_ROLES)).toBe(true);
    expect(has(bits, DiscordPermission.SEND_MESSAGES)).toBe(true);
  });

  test('permissions without a discord equivalent set nothing', () => {
    expect(
      toDiscordPermissions([
        Permission.MANAGE_PLUGINS,
        Permission.MANAGE_STORAGE,
        Permission.MANAGE_BOTS
      ])
    ).toBe('0');
  });
});

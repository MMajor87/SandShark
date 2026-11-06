import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  buildInviteDeepLink,
  buildInviteLink,
  clearPendingInvite,
  getPendingInvite,
  isLoopbackServer,
  parseInviteLink,
  setPendingInvite
} from '../invite-links';

describe('invite links', () => {
  test('builds the web link from the server origin', () => {
    expect(buildInviteLink('https://chat.example.com', 'abc123')).toBe(
      'https://chat.example.com/?invite=abc123'
    );
    expect(buildInviteLink('http://192.168.1.20:4991/', 'abc123')).toBe(
      'http://192.168.1.20:4991/?invite=abc123'
    );
  });

  test('reads back the web link it builds', () => {
    expect(
      parseInviteLink(buildInviteLink('http://192.168.1.20:4991', 'Team_2-x'))
    ).toEqual({ serverUrl: 'http://192.168.1.20:4991', code: 'Team_2-x' });
  });

  // the app link carries the whole origin, so a server without tls is not reached over https
  test('builds an app link that keeps the server scheme and port', () => {
    const link = buildInviteDeepLink('http://192.168.1.20:4991', 'abc123');

    expect(link).toBe(
      'sandshark://invite/http%3A%2F%2F192.168.1.20%3A4991/abc123'
    );
    expect(parseInviteLink(link)).toEqual({
      serverUrl: 'http://192.168.1.20:4991',
      code: 'abc123'
    });
  });

  test('reads an invite link pasted with surrounding space', () => {
    expect(
      parseInviteLink('  https://chat.example.com?invite=abc123 ')
    ).toEqual({
      serverUrl: 'https://chat.example.com',
      code: 'abc123'
    });
  });

  test('is not an invite link for a plain server address', () => {
    expect(parseInviteLink('https://chat.example.com')).toBeUndefined();
    expect(parseInviteLink('chat.example.com')).toBeUndefined();
    expect(
      parseInviteLink('sandshark://server/chat.example.com')
    ).toBeUndefined();
  });

  test('refuses a code the server could never have made', () => {
    expect(
      parseInviteLink('https://chat.example.com/?invite=a%20b')
    ).toBeUndefined();
    expect(
      parseInviteLink('https://chat.example.com/?invite=')
    ).toBeUndefined();
    expect(
      parseInviteLink('sandshark://invite/https%3A%2F%2Fchat.example.com/a%2Fb')
    ).toBeUndefined();
  });

  test('refuses links with credentials, a path, a hash or another scheme', () => {
    expect(
      parseInviteLink('https://user:pass@chat.example.com/?invite=abc')
    ).toBeUndefined();
    expect(
      parseInviteLink('https://chat.example.com/other/?invite=abc')
    ).toBeUndefined();
    expect(
      parseInviteLink('https://chat.example.com/?invite=abc#x')
    ).toBeUndefined();
    expect(
      parseInviteLink('sandshark://invite/javascript%3Aalert(1)/abc')
    ).toBeUndefined();
    expect(
      parseInviteLink(
        'sandshark://invite/https%3A%2F%2Fchat.example.com/abc/extra'
      )
    ).toBeUndefined();
  });

  test('knows a localhost address reaches nobody else', () => {
    expect(isLoopbackServer('http://localhost:4991')).toBe(true);
    expect(isLoopbackServer('http://127.0.0.1:4991')).toBe(true);
    expect(isLoopbackServer('http://[::1]:4991')).toBe(true);
    expect(isLoopbackServer('http://192.168.1.20:4991')).toBe(false);
    expect(isLoopbackServer('https://chat.example.com')).toBe(false);
  });
});

describe('pending invite', () => {
  // the client tests have no browser storage, so these give the session storage helpers one,
  // and take it away again for the files that run after
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    'sessionStorage'
  );

  beforeEach(() => {
    const values = new Map<string, string>();

    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      }
    });
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, 'sessionStorage', original);
    } else {
      Reflect.deleteProperty(globalThis, 'sessionStorage');
    }
  });

  test('is kept for the server it belongs to', () => {
    setPendingInvite('http://192.168.1.20:4991/', 'abc123');

    expect(getPendingInvite('http://192.168.1.20:4991')).toBe('abc123');
  });

  test('is not offered to another server', () => {
    setPendingInvite('https://chat.example.com', 'abc123');

    expect(getPendingInvite('https://other.example.com')).toBeUndefined();
    expect(getPendingInvite('http://chat.example.com')).toBeUndefined();
  });

  test('is gone once cleared', () => {
    setPendingInvite('https://chat.example.com', 'abc123');
    clearPendingInvite();

    expect(getPendingInvite('https://chat.example.com')).toBeUndefined();
  });
});

import { describe, expect, test } from 'bun:test';
import type http from 'http';
import { isLocalRequest } from '../is-local-request';

const request = (
  remoteAddress: string | undefined,
  headers: http.IncomingHttpHeaders = { host: 'localhost:4991' }
) =>
  ({ socket: { remoteAddress }, headers }) as unknown as http.IncomingMessage;

describe('isLocalRequest', () => {
  test('accepts loopback over ipv4, ipv6 and ipv4 mapped ipv6', () => {
    expect(isLocalRequest(request('127.0.0.1'))).toBe(true);
    expect(isLocalRequest(request('::ffff:127.0.0.1'))).toBe(true);
    expect(isLocalRequest(request('::1', { host: '[::1]:4991' }))).toBe(true);
    expect(isLocalRequest(request('127.0.0.1', { host: '127.0.0.1' }))).toBe(
      true
    );
  });

  test('accepts the page asking its own origin', () => {
    expect(
      isLocalRequest(
        request('127.0.0.1', {
          host: 'localhost:4991',
          origin: 'http://localhost:4991',
          'sec-fetch-site': 'same-origin'
        })
      )
    ).toBe(true);
  });

  test('rejects other machines', () => {
    expect(isLocalRequest(request('192.168.1.20'))).toBe(false);
    expect(isLocalRequest(request('203.0.113.9'))).toBe(false);
    expect(isLocalRequest(request(undefined))).toBe(false);
  });

  test('rejects a request a local reverse proxy forwarded', () => {
    for (const name of ['x-forwarded-for', 'forwarded', 'x-real-ip']) {
      expect(
        isLocalRequest(
          request('127.0.0.1', {
            host: 'localhost:4991',
            [name]: '203.0.113.9'
          })
        )
      ).toBe(false);
    }
  });

  test('rejects a host name that only resolves to this machine', () => {
    expect(
      isLocalRequest(request('127.0.0.1', { host: 'attacker.example:4991' }))
    ).toBe(false);
    expect(isLocalRequest(request('127.0.0.1', {}))).toBe(false);
  });

  test('rejects a page from another site', () => {
    expect(
      isLocalRequest(
        request('127.0.0.1', {
          host: 'localhost:4991',
          origin: 'https://attacker.example'
        })
      )
    ).toBe(false);
    expect(
      isLocalRequest(
        request('127.0.0.1', {
          host: 'localhost:4991',
          'sec-fetch-site': 'cross-site'
        })
      )
    ).toBe(false);
  });
});

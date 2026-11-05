import { HostedBotStatus } from '@sandshark/shared';
import { describe, expect, spyOn, test } from 'bun:test';
import fs from 'fs/promises';
import { initTest } from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { config } from '../../config';
import { hostedBots } from '../../db/schema';
import type { TMonitorStatus } from '../../helpers/monitor-status';
import { COMBINED_LOG_PATH, LOGS_PATH } from '../../helpers/paths';
import { updater } from '../../helpers/updater';
import { VoiceRuntime } from '../../runtimes/voice';
import { SERVER_VERSION } from '../../utils/env';
import { trackUserSocket } from '../../utils/wss';

const get = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${testsBaseUrl}${path}`, { headers });

const MONITOR_PATHS = [
  '/monitor',
  '/monitor/status',
  '/monitor/log',
  '/monitor/update'
];

describe('/monitor', () => {
  test('serves the page to this machine with a strict content policy', async () => {
    const response = await get('/monitor');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8'
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'none'"
    );
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(await response.text()).toContain('<title>SandShark Server</title>');
  });

  test('reports online users, voice channels and hosted bots', async () => {
    const { caller } = await initTest();
    const { bot } = await caller.bots.create({ name: 'Monitored' });

    await tdb
      .insert(hostedBots)
      .values({ botId: bot.id, createdAt: Date.now() });

    const socket = { userId: 1 } as unknown as Parameters<
      typeof trackUserSocket
    >[1];
    const voice = new VoiceRuntime(2);

    trackUserSocket(1, socket);
    voice.addUser(1, { micMuted: false, soundMuted: false });

    try {
      const response = await get('/monitor/status');
      const status = (await response.json()) as TMonitorStatus;

      expect(response.status).toBe(200);
      expect(status).toMatchObject({
        version: SERVER_VERSION,
        onlineUsers: [{ id: 1, name: 'Test Owner' }],
        voiceChannels: [{ id: 2, name: 'Voice', userCount: 1 }],
        hostedBots: [
          { id: bot.id, name: 'Monitored', status: HostedBotStatus.STOPPED }
        ]
      });
      expect(status.memoryBytes).toBeGreaterThan(0);
      expect(status.startedAt).toBeLessThanOrEqual(Date.now());
    } finally {
      voice.removeUser(1);
      await voice.destroy();
    }
  });

  test('reports an idle server', async () => {
    const response = await get('/monitor/status');

    expect(await response.json()).toMatchObject({
      onlineUsers: [],
      voiceChannels: [],
      hostedBots: []
    });
  });

  test('serves the end of the server log', async () => {
    let previous: string | null = null;

    try {
      previous = await fs.readFile(COMBINED_LOG_PATH, 'utf8');
    } catch {
      // the logger is replaced in tests, so the file usually does not exist
    }

    await fs.mkdir(LOGS_PATH, { recursive: true });
    await fs.writeFile(COMBINED_LOG_PATH, 'first line\nsecond line\n');

    try {
      const response = await get('/monitor/log');

      expect(await response.json()).toEqual({
        lines: ['first line', 'second line']
      });
    } finally {
      if (previous === null) {
        await fs.rm(COMBINED_LOG_PATH, { force: true });
      } else {
        await fs.writeFile(COMBINED_LOG_PATH, previous);
      }
    }
  });

  test('reports a waiting update', async () => {
    spyOn(updater, 'getLatestVersion').mockResolvedValue('99.0.0');
    spyOn(updater, 'hasUpdates').mockResolvedValue(true);

    const response = await get('/monitor/update');

    expect(await response.json()).toEqual({
      currentVersion: SERVER_VERSION,
      latestVersion: '99.0.0',
      hasUpdate: true
    });
  });

  test('reports an update check that failed', async () => {
    spyOn(updater, 'getLatestVersion').mockRejectedValue(new Error('offline'));
    spyOn(updater, 'hasUpdates').mockResolvedValue(false);

    const response = await get('/monitor/update');

    expect(await response.json()).toEqual({
      currentVersion: SERVER_VERSION,
      latestVersion: null,
      hasUpdate: false
    });
  });

  test('is not found through a reverse proxy', async () => {
    for (const path of MONITOR_PATHS) {
      const response = await get(path, { 'X-Forwarded-For': '203.0.113.9' });

      expect(response.status).toBe(404);
    }
  });

  test('is not found from a page on another site', async () => {
    for (const path of MONITOR_PATHS) {
      const response = await get(path, { Origin: 'https://attacker.example' });

      expect(response.status).toBe(404);
    }
  });

  test('is not found when turned off', async () => {
    const { monitor } = config.server;

    config.server.monitor = false;

    try {
      for (const path of MONITOR_PATHS) {
        const response = await get(path);

        expect(response.status).toBe(404);
      }
    } finally {
      config.server.monitor = monitor;
    }
  });
});

/// <reference lib="dom" />
import { chromium, type Page } from '@playwright/test';
import { TestId } from '@sharkord/shared';
import { expect, loginAs, test } from './fixtures';

const voiceChannel = (page: Page) =>
  page
    .getByTestId(TestId.CHANNEL_ITEM)
    .filter({ has: page.getByText('Voice', { exact: true }) });

const voiceParticipant = (page: Page, name: string) =>
  voiceChannel(page)
    .locator('xpath=following-sibling::div')
    .getByText(name, { exact: true });

const joinVoice = async (page: Page) => {
  await voiceChannel(page).dblclick({ force: true });
  await expect(
    page.getByText('Voice connected', { exact: true })
  ).toBeVisible();
};

const audioBytesReceived = (page: Page) =>
  page.evaluate(async () => {
    let bytes = 0;

    const connections =
      (window as Window & { __voiceTestConnections?: RTCPeerConnection[] })
        .__voiceTestConnections ?? [];

    for (const connection of connections) {
      if (connection.connectionState !== 'connected') continue;

      (await connection.getStats()).forEach((stat) => {
        if (stat.type === 'inbound-rtp' && stat.kind === 'audio')
          bytes += stat.bytesReceived;
      });
    }

    return bytes;
  });

test('a dropped voice socket clears membership and explicit rejoin restores media', async () => {
  test.setTimeout(90_000);
  const browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required'
    ]
  });

  try {
    const ownerContext = await browser.newContext({
      permissions: ['microphone', 'camera']
    });
    const memberContext = await browser.newContext({
      permissions: ['microphone', 'camera']
    });

    for (const context of [ownerContext, memberContext]) {
      await context.addInitScript(() => {
        const testWindow = window as Window & {
          __voiceTestConnections?: RTCPeerConnection[];
          __voiceTestSocket?: WebSocket;
        };
        testWindow.__voiceTestConnections = [];
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = new Proxy(OriginalWebSocket, {
          construct(target, args) {
            const socket = Reflect.construct(target, args) as WebSocket;
            testWindow.__voiceTestSocket = socket;
            return socket;
          }
        });
        const Original = window.RTCPeerConnection;

        window.RTCPeerConnection = new Proxy(Original, {
          construct(target, args) {
            const connection = new target(...args);
            testWindow.__voiceTestConnections?.push(connection);
            return connection;
          }
        });
        navigator.mediaDevices.getDisplayMedia = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas context unavailable');
          setInterval(() => {
            context.fillStyle = `hsl(${Date.now() % 360} 80% 50%)`;
            context.fillRect(0, 0, canvas.width, canvas.height);
          }, 50);
          return canvas.captureStream(20);
        };
      });
    }

    const owner = await ownerContext.newPage();
    const member = await memberContext.newPage();
    await loginAs(owner, 'testowner', 'password123');
    await loginAs(member, 'testuser', 'password123');
    await joinVoice(owner);
    await joinVoice(member);
    await expect(voiceParticipant(member, 'Test Owner')).toBeVisible();

    await expect.poll(() => audioBytesReceived(owner)).toBeGreaterThan(1_000);
    await expect.poll(() => audioBytesReceived(member)).toBeGreaterThan(1_000);

    await owner.getByTitle('Turn on camera').click();
    await expect(owner.getByTitle('Turn off camera')).toBeVisible();
    await owner.getByTitle('Start screen share').click();
    await expect(owner.getByTitle('Stop screen share')).toBeVisible();

    await owner.getByRole('button', { name: 'Mute', exact: true }).click();
    await owner.getByRole('button', { name: 'Deafen', exact: true }).click();
    await expect(
      owner.getByRole('button', { name: 'Undeafen', exact: true })
    ).toBeVisible();
    await expect(
      voiceParticipant(member, 'Test Owner')
        .locator('..')
        .locator('svg.text-red-500')
    ).toHaveCount(2);

    await owner.evaluate(() => {
      (
        window as Window & { __voiceTestSocket?: WebSocket }
      ).__voiceTestSocket?.close(3001, 'Network interrupted');
    });
    await expect(owner.locator('[inert]')).toHaveCount(1);
    await expect(
      owner.getByText('Voice connected', { exact: true })
    ).toHaveCount(0);
    await expect(voiceParticipant(member, 'Test Owner')).toHaveCount(0);
    await owner.waitForTimeout(1_500);
    await expect(voiceParticipant(member, 'Test Owner')).toHaveCount(0);
    const beforeRejoinBytes = await audioBytesReceived(member);

    await expect(owner.locator('[inert]')).toHaveCount(0);
    await expect(owner.getByTestId(TestId.SERVER_VIEW)).toBeVisible();
    await expect(
      owner.getByText('Voice connected', { exact: true })
    ).toHaveCount(0);
    await expect(voiceParticipant(member, 'Test Owner')).toHaveCount(0);

    await joinVoice(owner);
    await expect(voiceParticipant(member, 'Test Owner')).toBeVisible();
    await expect(
      owner.getByRole('button', { name: 'Unmute', exact: true })
    ).toBeVisible();
    await expect(
      owner.getByRole('button', { name: 'Undeafen', exact: true })
    ).toBeVisible();
    await expect(owner.getByTitle('Turn on camera')).toBeVisible();
    await expect(owner.getByTitle('Start screen share')).toBeVisible();
    await expect
      .poll(() =>
        owner.evaluate(() => {
          const connections =
            (
              window as Window & {
                __voiceTestConnections?: RTCPeerConnection[];
              }
            ).__voiceTestConnections ?? [];
          return connections
            .filter((connection) => connection.connectionState === 'connected')
            .flatMap((connection) => connection.getSenders())
            .filter(
              (sender) =>
                sender.track?.kind === 'video' &&
                sender.track.readyState === 'live'
            ).length;
        })
      )
      .toBe(0);
    await owner.getByRole('button', { name: 'Undeafen', exact: true }).click();
    await owner.getByRole('button', { name: 'Unmute', exact: true }).click();
    await expect
      .poll(() => audioBytesReceived(member))
      .toBeGreaterThan(beforeRejoinBytes + 1_000);
  } finally {
    await browser.close();
  }
});

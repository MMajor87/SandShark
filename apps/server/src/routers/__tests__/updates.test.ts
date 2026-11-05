import { describe, expect, spyOn, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';
import { SERVER_VERSION } from '../../utils/env';

// the test process is neither a production build nor in docker, so canUpdate is false and
// updateServer returns without installing. the docker install itself is covered in
// helpers/__tests__/docker-update.test.ts, and the restart it triggers exits the process, which
// the harness cannot survive

const offline = () =>
  spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(null, { status: 503 })
  );

describe('updates', () => {
  test('reports the running version and where it runs', async () => {
    const { caller } = await initTest();

    offline();

    expect(await caller.others.getUpdate()).toEqual({
      canUpdate: false,
      isDocker: false,
      latestVersion: '0.0.0',
      hasUpdate: false,
      currentVersion: SERVER_VERSION
    });
  });

  test('needs the manage updates permission to check', async () => {
    const { caller } = await initTest(2);

    offline();

    await expect(caller.others.getUpdate()).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('needs the manage updates permission to update', async () => {
    const { caller } = await initTest(2);
    const fetchSpy = offline();

    await expect(caller.others.updateServer()).rejects.toThrow(
      'Insufficient permissions'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('does not try to update a server that cannot update itself', async () => {
    const { caller } = await initTest();
    const fetchSpy = offline();

    await caller.others.updateServer();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

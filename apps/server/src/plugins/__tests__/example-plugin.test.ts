import { DEFAULT_LOCALE, type TInvokerContext } from '@sandshark/shared';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import { pluginManager } from '..';
import { tdb } from '../../__tests__/setup';
import { pluginData, settings } from '../../db/schema';
import { PLUGINS_PATH } from '../../helpers/paths';

// the starter plugin that docs/plugins.md walks through. it is plain javascript nothing else
// in the repo runs, so this loads it through the real plugin manager and calls what it
// registers: when the sdk moves under it, this fails instead of the guide quietly going stale

const PLUGIN_ID = 'hello-sandshark';
const EXAMPLE_PATH = path.resolve(
  import.meta.dir,
  '../../../../../examples/plugins',
  PLUGIN_ID
);
const INSTALLED_PATH = path.join(PLUGINS_PATH, PLUGIN_ID);

const invoker: TInvokerContext = {
  userId: 1,
  source: 'chat',
  currentVoiceChannelId: undefined,
  locale: DEFAULT_LOCALE
};

beforeEach(async () => {
  await fs.cp(EXAMPLE_PATH, INSTALLED_PATH, { recursive: true });
  await tdb.update(settings).set({ enablePlugins: true });
  await tdb.insert(pluginData).values({ pluginId: PLUGIN_ID, enabled: true });
  await pluginManager.load(PLUGIN_ID);
});

// the plugins folder is shared by every test file in the run
afterEach(async () => {
  await pluginManager.unload(PLUGIN_ID);
  await fs.rm(INSTALLED_PATH, { recursive: true, force: true });
});

describe('the hello-sandshark example plugin', () => {
  test('loads with a valid manifest and both entry files', async () => {
    const info = await pluginManager.getPluginInfo(PLUGIN_ID);

    expect(info).toMatchObject({
      id: PLUGIN_ID,
      name: 'Hello SandShark',
      version: '1.0.0',
      enabled: true
    });
    expect(info.loadError).toBeUndefined();
    expect(
      pluginManager
        .getLogs(PLUGIN_ID)
        .some(({ message }) => message.includes('Hello SandShark loaded'))
    ).toBe(true);
  });

  test('/hello greets the user who ran it with the default greeting', async () => {
    expect(
      await pluginManager.executeCommand(PLUGIN_ID, 'hello', invoker, {})
    ).toBe('Hello, Test Owner!');
  });

  test('/hello greets the name it was given', async () => {
    expect(
      await pluginManager.executeCommand(PLUGIN_ID, 'hello', invoker, {
        name: 'Ada'
      })
    ).toBe('Hello, Ada!');
  });

  test('the wave action keeps its count in plugin storage', async () => {
    expect(
      await pluginManager.executeAction(PLUGIN_ID, 'wave', invoker, undefined)
    ).toEqual({ waves: 1 });
    expect(
      await pluginManager.executeAction(PLUGIN_ID, 'wave', invoker, undefined)
    ).toEqual({ waves: 2 });
  });
});

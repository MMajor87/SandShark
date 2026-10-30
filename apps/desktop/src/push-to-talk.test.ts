import { expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { TPushToTalkConfig } from './desktop-api.js';
import { createPushToTalk } from './push-to-talk.js';

const config: TPushToTalkConfig = {
  input: { type: 'keyboard', keyCode: 42 },
  modifiers: { control: false, shift: false, alt: false, meta: false }
};
const key = {
  keycode: 42,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false
};

test('PTT handles duplicate presses, rebind, release and repeated disposal without duplicate listeners', () => {
  const hook = Object.assign(new EventEmitter(), {
    start: mock(() => {}),
    stop: mock(() => {})
  });
  const states: boolean[] = [];
  const ptt = createPushToTalk(
    hook as unknown as Parameters<typeof createPushToTalk>[0],
    (active) => states.push(active),
    'win32'
  );
  ptt.setPushToTalk(config);
  ptt.setPushToTalk(config);
  expect(hook.listenerCount('keydown')).toBe(1);
  hook.emit('keydown', { ...key, ctrlKey: true });
  expect(states).toEqual([]);
  hook.emit('keydown', key);
  hook.emit('keydown', key);
  ptt.setPushToTalk({ ...config, input: { type: 'mouse', button: 4 } });
  hook.emit('mousedown', { ...key, button: 4 });
  hook.emit('mouseup', { ...key, button: 4 });
  expect(states).toEqual([true, false, true, false]);
  hook.emit('mousedown', { ...key, button: 4 });
  ptt.dispose();
  ptt.dispose();
  expect(states.slice(-2)).toEqual([true, false]);
  expect(hook.eventNames()).toEqual([]);
  expect(hook.stop).toHaveBeenCalledTimes(1);
});

test('failed native startup removes listeners and permits retry', () => {
  let fail = true;
  const hook = Object.assign(new EventEmitter(), {
    start: () => {
      if (fail) throw new Error('unavailable');
    },
    stop: mock(() => {})
  });
  const ptt = createPushToTalk(
    hook as unknown as Parameters<typeof createPushToTalk>[0],
    () => {},
    'win32'
  );
  expect(ptt.setPushToTalk(config).registered).toBe(false);
  expect(hook.eventNames()).toEqual([]);
  fail = false;
  expect(ptt.setPushToTalk(config).registered).toBe(true);
  ptt.dispose();
});

test('focus loss releases a held key and the next press still works', () => {
  const hook = Object.assign(new EventEmitter(), {
    start: mock(() => {}),
    stop: mock(() => {})
  });
  const states: boolean[] = [];
  const ptt = createPushToTalk(
    hook as unknown as Parameters<typeof createPushToTalk>[0],
    (active) => states.push(active),
    'win32'
  );

  ptt.setPushToTalk(config);
  hook.emit('keydown', key);
  ptt.releaseHeld();
  ptt.releaseHeld();
  hook.emit('keydown', key);
  hook.emit('keyup', key);

  expect(states).toEqual([true, false, true, false]);
  ptt.dispose();
});

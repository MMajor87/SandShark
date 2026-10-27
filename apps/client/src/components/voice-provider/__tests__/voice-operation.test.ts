import { expect, test } from 'bun:test';
import { createVoiceOperationOwner } from '../voice-operation';

test('late microphone or transport acquisition after leave releases its resource without publishing it', async () => {
  const owner = createVoiceOperationOwner();
  const operation = owner.begin();
  let resolve!: (value: { stop: () => void }) => void;
  let stopped = 0;
  let published = false;
  const pending = operation
    .wait(
      new Promise<{ stop: () => void }>((done) => {
        resolve = done;
      }),
      (resource) => resource.stop()
    )
    .then(() => {
      published = true;
    });
  owner.cancel();
  resolve({
    stop: () => {
      stopped += 1;
    }
  });
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
  expect(published).toBe(false);
  expect(stopped).toBe(1);
});

test('server/session replacement invalidates pending work before a React cleanup runs', async () => {
  let connected = true;
  const owner = createVoiceOperationOwner();
  const operation = owner.begin(() => connected);
  let closed = 0;
  const pending = operation.wait(
    Promise.resolve({
      close: () => {
        closed += 1;
      }
    }),
    (resource) => resource.close()
  );
  connected = false;
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
  expect(closed).toBe(1);
});

test('partial startup and repeated cancellation release resources once in reverse ownership order', () => {
  const owner = createVoiceOperationOwner();
  const first = owner.begin();
  const released: string[] = [];
  first.own('stream', (value) => {
    released.push(value);
  });
  first.own('context', (value) => {
    released.push(value);
  });
  first.own('producer', (value) => {
    released.push(value);
  });
  const replacement = owner.begin();
  first.dispose();
  owner.cancel();
  owner.cancel();
  expect(released).toEqual(['producer', 'context', 'stream']);
  expect(first.isCurrent()).toBe(false);
  expect(replacement.isCurrent()).toBe(false);
});

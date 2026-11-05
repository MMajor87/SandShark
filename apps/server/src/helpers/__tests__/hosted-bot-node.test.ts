import { describe, expect, spyOn, test } from 'bun:test';
import { findNode } from '../hosted-bot-node';

describe('findNode', () => {
  // what `bun run` puts on the path as node when no node is installed
  test('does not take bun for node', async () => {
    spyOn(Bun, 'which').mockReturnValue(process.execPath);

    expect(await findNode()).toBeUndefined();
  });

  test('finds nothing when no node is on the path', async () => {
    spyOn(Bun, 'which').mockReturnValue(null);

    expect(await findNode()).toBeUndefined();
  });
});

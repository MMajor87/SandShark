import { describe, expect, test } from 'bun:test';
import { getXEmbedHeight } from '../helpers';

// the message x's embed frame posts to its parent, taken from its embed.ondemand.Tweet bundle
const resize = (height: unknown) => ({
  'twttr.embed': {
    jsonrpc: '2.0',
    method: 'twttr.private.resize',
    id: 'embed-0',
    params: [{ width: 550, height, data: { tweet_id: '20' } }]
  }
});

describe('getXEmbedHeight', () => {
  test('reads the height of a resize message, rounded up', () => {
    expect(getXEmbedHeight(resize(312))).toBe(312);
    expect(getXEmbedHeight(resize(312.2))).toBe(313);
  });

  test('ignores the other messages the embed sends', () => {
    expect(
      getXEmbedHeight({
        'twttr.embed': {
          method: 'twttr.private.rendered',
          params: [{ data: { tweet_id: '20' } }]
        }
      })
    ).toBeUndefined();
  });

  test('ignores messages that are not from an x embed', () => {
    expect(getXEmbedHeight(undefined)).toBeUndefined();
    expect(getXEmbedHeight('twttr.private.resize')).toBeUndefined();
    expect(getXEmbedHeight({ type: 'resize', height: 300 })).toBeUndefined();
    expect(getXEmbedHeight({ 'twttr.embed': 'resize' })).toBeUndefined();
    expect(
      getXEmbedHeight({ 'twttr.embed': { method: 'twttr.private.resize' } })
    ).toBeUndefined();
  });

  test('ignores a height that is not a positive number', () => {
    expect(getXEmbedHeight(resize('300'))).toBeUndefined();
    expect(getXEmbedHeight(resize(0))).toBeUndefined();
    expect(getXEmbedHeight(resize(-40))).toBeUndefined();
    expect(getXEmbedHeight(resize(Number.NaN))).toBeUndefined();
    expect(getXEmbedHeight(resize(Number.POSITIVE_INFINITY))).toBeUndefined();
  });

  test('caps a height no post could have', () => {
    expect(getXEmbedHeight(resize(50_000))).toBe(2000);
  });
});

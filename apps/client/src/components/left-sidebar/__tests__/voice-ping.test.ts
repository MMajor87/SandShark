import { describe, expect, test } from 'bun:test';
import {
  FAIR_PING_MS,
  GOOD_PING_MS,
  getPingQuality,
  getVoicePing
} from '../helpers';

describe('getVoicePing', () => {
  test('takes the first transport that has measured a round trip, rounded', () => {
    expect(getVoicePing(41.6, 50)).toBe(42);
    expect(getVoicePing(0, 37.2)).toBe(37);
    expect(getVoicePing(undefined, 12)).toBe(12);
  });

  // webrtc reports 0 until the first measurement, which must not show as a perfect ping
  test('has no ping before anything was measured', () => {
    expect(getVoicePing(0, 0)).toBeUndefined();
    expect(getVoicePing(null, undefined)).toBeUndefined();
    expect(getVoicePing()).toBeUndefined();
  });
});

describe('getPingQuality', () => {
  test('grades the round trip by how it feels', () => {
    expect(getPingQuality(20)).toBe('good');
    expect(getPingQuality(GOOD_PING_MS - 1)).toBe('good');
    expect(getPingQuality(GOOD_PING_MS)).toBe('fair');
    expect(getPingQuality(FAIR_PING_MS - 1)).toBe('fair');
    expect(getPingQuality(FAIR_PING_MS)).toBe('poor');
    expect(getPingQuality(900)).toBe('poor');
  });
});

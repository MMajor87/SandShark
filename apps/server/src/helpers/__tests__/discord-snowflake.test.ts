import { describe, expect, test } from 'bun:test';
import {
  decodeSnowflake,
  encodeSnowflake,
  resolveSnowflakeId,
  SnowflakeTag
} from '../discord/snowflake';

const CREATED_AT = Date.UTC(2026, 10, 2, 18, 0, 0);

describe('discord snowflakes', () => {
  test('round trip the tag, the id and the creation time the libraries read', () => {
    const snowflake = encodeSnowflake(SnowflakeTag.MESSAGE, 1234, CREATED_AT);
    const decoded = decodeSnowflake(snowflake);

    expect(decoded).toEqual({
      tag: SnowflakeTag.MESSAGE,
      idBits: 1234,
      timestamp: CREATED_AT
    });
    // discord.js derives createdTimestamp exactly like this
    expect(Number((BigInt(snowflake) >> 22n) + 1_420_070_400_000n)).toBe(
      CREATED_AT
    );
  });

  test('the same id in two tables gives two different snowflakes', () => {
    expect(encodeSnowflake(SnowflakeTag.CHANNEL, 1, CREATED_AT)).not.toBe(
      encodeSnowflake(SnowflakeTag.CATEGORY, 1, CREATED_AT)
    );
  });

  test('rows older than the discord epoch clamp to it', () => {
    expect(decodeSnowflake(encodeSnowflake(SnowflakeTag.USER, 5, 1))).toEqual({
      tag: SnowflakeTag.USER,
      idBits: 5,
      timestamp: 1_420_070_400_000
    });
  });

  test('rejects anything that is not a 64 bit decimal', () => {
    for (const value of ['', 'abc', '-1', '1.5', '18446744073709551616']) {
      expect(decodeSnowflake(value)).toBeUndefined();
    }
  });

  describe('resolve', () => {
    const lookup = async (id: number) => (id === 42 ? CREATED_AT : undefined);

    test('resolves a snowflake built from the row', async () => {
      const snowflake = encodeSnowflake(SnowflakeTag.USER, 42, CREATED_AT);

      expect(
        await resolveSnowflakeId(snowflake, SnowflakeTag.USER, lookup)
      ).toBe(42);
    });

    test('refuses the wrong tag, a forged timestamp, id 0 and a missing row', async () => {
      for (const snowflake of [
        encodeSnowflake(SnowflakeTag.ROLE, 42, CREATED_AT),
        encodeSnowflake(SnowflakeTag.USER, 42, CREATED_AT + 1),
        encodeSnowflake(SnowflakeTag.USER, 0, CREATED_AT),
        encodeSnowflake(SnowflakeTag.USER, 43, CREATED_AT),
        'not a snowflake'
      ]) {
        expect(
          await resolveSnowflakeId(snowflake, SnowflakeTag.USER, lookup)
        ).toBeUndefined();
      }
    });
  });
});

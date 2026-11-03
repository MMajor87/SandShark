// discord ids are snowflakes: milliseconds since the discord epoch in the top 42 bits and
// 22 free bits below. the libraries read creation time out of the top bits, so they are
// filled from the row's createdAt. the low bits hold a 4 bit tag naming the table and the
// low 18 bits of the row id, because discord ids are unique across every kind of object
// while sandshark ids only are within one table
const DISCORD_EPOCH = 1_420_070_400_000n;
const ID_BITS = 18n;
const ID_MASK = (1n << ID_BITS) - 1n;
const TAG_MASK = 0xfn;

enum SnowflakeTag {
  GUILD = 1,
  USER = 2,
  CHANNEL = 3,
  CATEGORY = 4,
  ROLE = 5,
  MESSAGE = 6,
  EMOJI = 7,
  ATTACHMENT = 8,
  COMMAND = 9,
  INTERACTION = 10,
  EPHEMERAL_MESSAGE = 11
}

type TDecodedSnowflake = {
  tag: SnowflakeTag;
  // the low 18 bits of the row id, which is the whole id below 262144
  idBits: number;
  timestamp: number;
};

// rows older than the discord epoch, which only test fixtures have, clamp to it
const encodeSnowflake = (tag: SnowflakeTag, id: number, createdAt: number) => {
  const since = BigInt(Math.max(0, Math.floor(createdAt))) - DISCORD_EPOCH;
  const timestamp = since > 0n ? since : 0n;

  return (
    (timestamp << 22n) |
    (BigInt(tag) << ID_BITS) |
    (BigInt(id) & ID_MASK)
  ).toString();
};

const decodeSnowflake = (value: string): TDecodedSnowflake | undefined => {
  if (!/^\d{1,20}$/.test(value)) return undefined;

  const snowflake = BigInt(value);

  if (snowflake >= 1n << 64n) return undefined;

  return {
    tag: Number((snowflake >> ID_BITS) & TAG_MASK) as SnowflakeTag,
    idBits: Number(snowflake & ID_MASK),
    timestamp: Number((snowflake >> 22n) + DISCORD_EPOCH)
  };
};

// resolves a snowflake to the row id it was built from. rows whose id still fits in the
// 18 bits are matched by primary key and confirmed by re-encoding, so a snowflake with a
// forged timestamp or the wrong tag never resolves to someone else's row
const resolveSnowflakeId = async (
  value: string,
  tag: SnowflakeTag,
  getCreatedAt: (id: number) => Promise<number | undefined>
) => {
  const decoded = decodeSnowflake(value);

  if (!decoded || decoded.tag !== tag || decoded.idBits === 0) return undefined;

  const createdAt = await getCreatedAt(decoded.idBits);

  if (createdAt === undefined) return undefined;

  return encodeSnowflake(tag, decoded.idBits, createdAt) === value
    ? decoded.idBits
    : undefined;
};

export {
  SnowflakeTag,
  decodeSnowflake,
  encodeSnowflake,
  resolveSnowflakeId,
  type TDecodedSnowflake
};

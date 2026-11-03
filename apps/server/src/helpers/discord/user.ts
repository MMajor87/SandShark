import type { TJoinedPublicUser } from '@sandshark/shared';
import { encodeSnowflake, SnowflakeTag } from './snowflake';

type TDiscordUserSource = Pick<
  TJoinedPublicUser,
  'id' | 'name' | 'createdAt' | 'isBot' | 'profileColor'
>;

const userSnowflake = (user: Pick<TJoinedPublicUser, 'id' | 'createdAt'>) =>
  encodeSnowflake(SnowflakeTag.USER, user.id, user.createdAt);

const hexToColor = (hex: string) =>
  Number.parseInt(hex.replace('#', ''), 16) || 0;

// avatars are left out: the libraries build cdn.discordapp.com urls from the hash, which
// would point at the wrong host
const serializeUser = (user: TDiscordUserSource) => ({
  id: userSnowflake(user),
  username: user.name,
  global_name: user.name,
  discriminator: '0',
  avatar: null,
  banner: null,
  accent_color: hexToColor(user.profileColor) || null,
  bot: user.isBot,
  system: false,
  public_flags: 0,
  flags: 0
});

export { hexToColor, serializeUser, userSnowflake, type TDiscordUserSource };

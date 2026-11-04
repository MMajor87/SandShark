import { ChannelType, type TChannel } from '@sandshark/shared';

// discord's channel type number, which a bot uses to restrict which channels it accepts
export const discordChannelType = (channel: TChannel) =>
  channel.type === ChannelType.VOICE ? 2 : 0;

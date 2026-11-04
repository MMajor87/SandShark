import type { IRootState } from '@/features/store';
import { createCachedSelector } from 're-reselect';

export const botCommandsSelector = (state: IRootState) =>
  state.server.botCommands;

const botEphemeralMessagesSelector = (state: IRootState) =>
  state.server.botEphemeralMessages;

export const botEphemeralMessagesByChannelIdSelector = createCachedSelector(
  [
    botEphemeralMessagesSelector,
    (_: IRootState, channelId: number) => channelId
  ],
  (messages, channelId) =>
    messages.filter((message) => message.channelId === channelId)
)((_, channelId) => channelId);

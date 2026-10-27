import { currentVoiceChannelIdSelector } from '@/features/server/channels/selectors';
import { connectedSelector } from '@/features/server/selectors';
import { store } from '@/features/store';
import { getTRPCClient } from '@/lib/trpc';

export const captureVoiceSession = () => {
  const client = getTRPCClient();
  const channelId = currentVoiceChannelIdSelector(store.getState());
  return {
    client,
    channelId,
    isCurrent: () => {
      const state = store.getState();
      const currentChannelId = currentVoiceChannelIdSelector(state);
      if (
        !channelId ||
        currentChannelId !== channelId ||
        !connectedSelector(state)
      )
        return false;
      try {
        return getTRPCClient() === client;
      } catch {
        return false;
      }
    }
  };
};

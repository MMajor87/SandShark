import type { IRootState } from '@/features/store';
import { useSelector } from 'react-redux';
import {
  botCommandsSelector,
  botEphemeralMessagesByChannelIdSelector
} from './selectors';

export const useBotCommands = () => useSelector(botCommandsSelector);

export const useBotEphemeralMessages = (channelId: number) =>
  useSelector((state: IRootState) =>
    botEphemeralMessagesByChannelIdSelector(state, channelId)
  );

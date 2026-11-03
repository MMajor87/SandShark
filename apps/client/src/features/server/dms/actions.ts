import { setSelectedDmChannelId } from '@/features/app/actions';
import { store } from '@/features/store';
import { i18n } from '@/i18n';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  type TDirectMessageConversation
} from '@sandshark/shared';
import { toast } from 'sonner';
import { setDmsOpen } from '../actions';
import { serverSliceActions } from '../slice';

export const upsertDirectMessage = (
  conversation: TDirectMessageConversation
) => {
  store.dispatch(serverSliceActions.upsertDirectMessage(conversation));
};

export const setDirectMessageActivity = (
  channelId: number,
  lastMessageAt: number
) => {
  store.dispatch(
    serverSliceActions.setDirectMessageActivity({ channelId, lastMessageAt })
  );
};

// shared by the user popover, the user context menu and the dm list search
export const openDirectMessage = async (userId: number) => {
  try {
    const trpc = getTRPCClient();
    const result = await trpc.dms.open.mutate({ userId });

    setDmsOpen(true);
    setSelectedDmChannelId(result.channelId);
  } catch (error) {
    toast.error(getTrpcError(error, i18n.t('couldNotOpenDM')));
  }
};

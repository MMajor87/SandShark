import { store } from '@/features/store';
import { i18n } from '@/i18n';
import { getTRPCClient } from '@/lib/trpc';
import type {
  TBotCommandInfo,
  TBotEphemeralMessage,
  TBotInteractionFailed
} from '@sandshark/shared';
import { toast } from 'sonner';
import { serverSliceActions } from '../slice';

export const setBotCommands = (commands: TBotCommandInfo[]) =>
  store.dispatch(serverSliceActions.setBotCommands(commands));

// a bot changed its commands, and the menu is per member, so it is asked for again
export const fetchBotCommands = async () => {
  try {
    const trpc = getTRPCClient();
    const commands = await trpc.bots.getCommands.query();

    setBotCommands(commands);
  } catch (error) {
    // the menu keeps the commands it had, running a stale one is refused by the server
    console.error('Failed to load bot commands:', error);
  }
};

export const showBotEphemeralMessage = (message: TBotEphemeralMessage) =>
  store.dispatch(serverSliceActions.upsertBotEphemeralMessage(message));

export const removeBotEphemeralMessage = (messageId: number) =>
  store.dispatch(serverSliceActions.removeBotEphemeralMessage(messageId));

export const showBotInteractionFailed = ({
  commandName
}: TBotInteractionFailed) => {
  toast.error(i18n.t('common:botDidNotRespond', { command: commandName }));
};

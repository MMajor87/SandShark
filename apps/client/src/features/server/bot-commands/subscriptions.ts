import { logDebug } from '@/helpers/browser-logger';
import { getTRPCClient } from '@/lib/trpc';
import { handleSubscriptionError } from '../subscription-error';
import {
  fetchBotCommands,
  removeBotEphemeralMessage,
  showBotEphemeralMessage,
  showBotInteractionFailed,
  showBotModal
} from './actions';

const subscribeToBotCommands = () => {
  const trpc = getTRPCClient();

  const onCommandsChangeSub = trpc.bots.onCommandsChange.subscribe(undefined, {
    onData: ({ botId }) => {
      logDebug('[EVENTS] bots.onCommandsChange', { botId });
      fetchBotCommands();
    },
    onError: handleSubscriptionError('onCommandsChange')
  });

  const onEphemeralMessageSub = trpc.bots.onEphemeralMessage.subscribe(
    undefined,
    {
      onData: (message) => {
        logDebug('[EVENTS] bots.onEphemeralMessage', { id: message.id });
        showBotEphemeralMessage(message);
      },
      onError: handleSubscriptionError('onEphemeralMessage')
    }
  );

  const onEphemeralMessageDeleteSub =
    trpc.bots.onEphemeralMessageDelete.subscribe(undefined, {
      onData: ({ id }) => {
        logDebug('[EVENTS] bots.onEphemeralMessageDelete', { id });
        removeBotEphemeralMessage(id);
      },
      onError: handleSubscriptionError('onEphemeralMessageDelete')
    });

  const onInteractionFailedSub = trpc.bots.onInteractionFailed.subscribe(
    undefined,
    {
      onData: (failure) => {
        logDebug('[EVENTS] bots.onInteractionFailed', failure);
        showBotInteractionFailed(failure);
      },
      onError: handleSubscriptionError('onInteractionFailed')
    }
  );

  const onModalOpenSub = trpc.bots.onModalOpen.subscribe(undefined, {
    onData: (modal) => {
      logDebug('[EVENTS] bots.onModalOpen', {
        interactionId: modal.interactionId
      });
      showBotModal(modal);
    },
    onError: handleSubscriptionError('onModalOpen')
  });

  return () => {
    onCommandsChangeSub.unsubscribe();
    onModalOpenSub.unsubscribe();
    onEphemeralMessageSub.unsubscribe();
    onEphemeralMessageDeleteSub.unsubscribe();
    onInteractionFailedSub.unsubscribe();
  };
};

export { subscribeToBotCommands };

import {
  browserNotificationsForDmsSelector,
  browserNotificationsForMentionsSelector,
  browserNotificationsForRepliesSelector,
  browserNotificationsSelector,
  threadSidebarDataSelector
} from '@/features/app/selectors';
import { store } from '@/features/store';
import { getFileUrl } from '@/helpers/get-file-url';
import { isChannelNotificationsMuted } from '@/helpers/muted-notification-channels';
import { getActiveServerProfileId } from '@/helpers/server-connection';
import { isDesktopClient } from '@/platform/environment';
import {
  getPlainTextFromHtml,
  hasMention,
  TYPING_MS,
  type TJoinedMessage
} from '@sharkord/shared';
import { markChannelAsRead } from '../actions';
import {
  channelByIdSelector,
  isChannelTextVisibleByIdSelector
} from '../channels/selectors';
import { pluginMetadataByIdSelector } from '../plugins/selectors';
import { serverNameSelector } from '../selectors';
import { serverSliceActions } from '../slice';
import { playSound } from '../sounds/actions';
import { SoundType } from '../types';
import { ownUserIdSelector, userByIdSelector } from '../users/selectors';
import { threadMessagesMapSelector } from './selectors';

const sendMessageNotification = (
  message: TJoinedMessage,
  channelId: number,
  isDm = false
) => {
  const state = store.getState();

  const user = userByIdSelector(state, message.userId);
  const plugin = pluginMetadataByIdSelector(state, message.pluginId);
  const channel = channelByIdSelector(state, channelId);
  const isPluginMessage = !!message.pluginId;

  if (!user || !channel) {
    return;
  }

  const authorName = isPluginMessage && plugin ? plugin.name : user.name;
  const textContent = getPlainTextFromHtml(message.content ?? '').trim();
  const serverName = serverNameSelector(state) ?? 'SandShark';

  const title = isDm
    ? `${serverName} - ${authorName} (DM)`
    : `${serverName} - ${authorName} in #${channel.name ?? 'unknown'}`;

  const body = textContent.slice(0, 2_000) || 'Sent an attachment';
  const icon = user?.avatar ? getFileUrl(user.avatar) : undefined;

  const target = {
    profileId: getActiveServerProfileId(),
    channelId,
    messageId: message.parentMessageId ?? message.id,
    isDm
  };

  if (isDesktopClient() && window.sandSharkDesktop) {
    void window.sandSharkDesktop.showNotification({ title, body, target });
    return;
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  new Notification(title, { body, icon });
};

const typingTimeouts: { [key: string]: NodeJS.Timeout } = {};

const getTypingKey = (channelId: number, userId: number) =>
  `${channelId}-${userId}`;

export const addMessages = (
  channelId: number,
  messages: TJoinedMessage[],
  opts: { prepend?: boolean } = {},
  isSubscriptionMessage = false
) => {
  const rootMessages = messages.filter((m) => !m.parentMessageId);
  const threadReplies = messages.filter((m) => !!m.parentMessageId);

  if (rootMessages.length > 0) {
    store.dispatch(
      serverSliceActions.addMessages({
        channelId,
        messages: rootMessages,
        opts
      })
    );
  }

  const repliesByParent = new Map<number, TJoinedMessage[]>();

  for (const reply of threadReplies) {
    const parentId = reply.parentMessageId!;

    if (!repliesByParent.has(parentId)) {
      repliesByParent.set(parentId, []);
    }

    repliesByParent.get(parentId)!.push(reply);
  }

  for (const [parentMessageId, replies] of repliesByParent) {
    store.dispatch(
      serverSliceActions.addThreadMessages({
        parentMessageId,
        messages: replies,
        opts
      })
    );
  }

  rootMessages.forEach((message) => {
    if (message.userId) {
      removeTypingUser(channelId, message.userId);
    }
  });

  threadReplies.forEach((message) => {
    if (message.parentMessageId && message.userId) {
      removeThreadTypingUser(message.parentMessageId, message.userId);
    }
  });

  if (isSubscriptionMessage && messages.length > 0) {
    const state = store.getState();
    const ownUserId = ownUserIdSelector(state);
    const hasBrowserNotificationsEnabled = browserNotificationsSelector(state);
    const notificationsForMentionsOnly =
      browserNotificationsForMentionsSelector(state);
    const targetMessage = messages[0];
    const isFromOwnUser =
      targetMessage.userId && ownUserId === targetMessage.userId;

    const isChannelTextVisible = isChannelTextVisibleByIdSelector(
      state,
      channelId
    );

    const isWindowHidden = document.hidden;

    if (!isFromOwnUser) {
      const isThreadReply = !!targetMessage.parentMessageId;

      if (isThreadReply) {
        const { isOpen, parentMessageId } = threadSidebarDataSelector(state);

        // only play sound if the user has this thread open
        if (isOpen && parentMessageId === targetMessage.parentMessageId) {
          playSound(SoundType.MESSAGE_RECEIVED);
        }
      } else {
        playSound(SoundType.MESSAGE_RECEIVED);
      }

      const canSendNotification = isDesktopClient()
        ? isWindowHidden
        : !isChannelTextVisible || isWindowHidden;

      if (canSendNotification && !isChannelNotificationsMuted(channelId)) {
        const channel = channelByIdSelector(state, channelId);
        const isDmChannel = !!channel?.isDm;
        const hasDmNotificationsEnabled =
          browserNotificationsForDmsSelector(state);
        const hasRepliesNotificationsEnabled =
          browserNotificationsForRepliesSelector(state);
        const isMentioned = hasMention(
          targetMessage.content ?? null,
          ownUserId
        );
        let notificationSent = false;

        if (isDmChannel && hasDmNotificationsEnabled) {
          sendMessageNotification(targetMessage, channelId, true);
          notificationSent = true;
        } else if (notificationsForMentionsOnly) {
          if (isMentioned) {
            sendMessageNotification(targetMessage, channelId);
            notificationSent = true;
          }
        } else if (hasBrowserNotificationsEnabled) {
          sendMessageNotification(targetMessage, channelId);
          notificationSent = true;
        } else if (hasRepliesNotificationsEnabled) {
          const isReplyToOwnMessage =
            !!targetMessage.replyToMessageId &&
            targetMessage.replyTo?.userId === ownUserId;

          if (isReplyToOwnMessage) {
            sendMessageNotification(targetMessage, channelId);
            notificationSent = true;
          }
        }

        if (
          notificationSent &&
          (isDmChannel || isMentioned) &&
          isDesktopClient() &&
          window.sandSharkDesktop
        ) {
          void window.sandSharkDesktop.flashTaskbar();
        }
      }
    }

    if (isChannelTextVisible && !isFromOwnUser && rootMessages.length > 0) {
      markChannelAsRead(channelId, true);
    }
  }
};

export const updateMessage = (channelId: number, message: TJoinedMessage) => {
  if (message.parentMessageId) {
    store.dispatch(
      serverSliceActions.updateThreadMessage({
        parentMessageId: message.parentMessageId,
        message
      })
    );
  } else {
    store.dispatch(serverSliceActions.updateMessage({ channelId, message }));
  }
};

export const deleteMessage = (channelId: number, messageId: number) => {
  // delete from both maps, the message could be a thread reply or root
  store.dispatch(serverSliceActions.deleteMessage({ channelId, messageId }));

  const state = store.getState();
  const threadMessagesMap = threadMessagesMapSelector(state);

  for (const parentId in threadMessagesMap) {
    const threadMessages = threadMessagesMap[parentId];

    if (threadMessages?.some((m) => m.id === messageId)) {
      store.dispatch(
        serverSliceActions.deleteThreadMessage({
          parentMessageId: Number(parentId),
          messageId
        })
      );

      break;
    }
  }
};

export const addThreadMessages = (
  parentMessageId: number,
  messages: TJoinedMessage[],
  opts: { prepend?: boolean } = {}
) => {
  store.dispatch(
    serverSliceActions.addThreadMessages({
      parentMessageId,
      messages,
      opts
    })
  );
};

export const clearThreadMessages = (parentMessageId: number) => {
  store.dispatch(serverSliceActions.clearThreadMessages(parentMessageId));
};

export const addTypingUser = (
  channelId: number,
  userId: number,
  parentMessageId?: number
) => {
  if (parentMessageId) {
    store.dispatch(
      serverSliceActions.addThreadTypingUser({ parentMessageId, userId })
    );

    const timeoutKey = `thread-${parentMessageId}-${userId}`;

    if (typingTimeouts[timeoutKey]) {
      clearTimeout(typingTimeouts[timeoutKey]);
    }

    typingTimeouts[timeoutKey] = setTimeout(() => {
      removeThreadTypingUser(parentMessageId, userId);

      delete typingTimeouts[timeoutKey];
    }, TYPING_MS + 500);
  } else {
    store.dispatch(serverSliceActions.addTypingUser({ channelId, userId }));

    const timeoutKey = getTypingKey(channelId, userId);

    if (typingTimeouts[timeoutKey]) {
      clearTimeout(typingTimeouts[timeoutKey]);
    }

    typingTimeouts[timeoutKey] = setTimeout(() => {
      removeTypingUser(channelId, userId);

      delete typingTimeouts[timeoutKey];
    }, TYPING_MS + 500);
  }
};

export const removeTypingUser = (channelId: number, userId: number) => {
  store.dispatch(serverSliceActions.removeTypingUser({ channelId, userId }));
};

export const removeThreadTypingUser = (
  parentMessageId: number,
  userId: number
) => {
  store.dispatch(
    serverSliceActions.removeThreadTypingUser({ parentMessageId, userId })
  );
};

export const updateReplyCount = (
  channelId: number,
  messageId: number,
  replyCount: number
) => {
  store.dispatch(
    serverSliceActions.updateReplyCount({ channelId, messageId, replyCount })
  );
};

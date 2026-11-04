import { MessageContextMenu } from '@/components/context-menus/message';
import { useCan } from '@/features/server/hooks';
import {
  useIsOwnUser,
  useOwnUserId,
  useOwnUserRoleIds
} from '@/features/server/users/hooks';
import { cn } from '@/lib/utils';
import {
  hasMention,
  Permission,
  TestId,
  type TJoinedMessage
} from '@sandshark/shared';
import { memo, useCallback, useMemo, useState } from 'react';
import { BotThinking } from './bot-thinking';
import { InteractionHeader } from './interaction-header';
import { MessageActions } from './message-actions';
import { MessageEditInline } from './message-edit-inline';
import { MessageRenderer } from './renderer';
import { ThreadRepliesButton } from './thread-replies-button';

// to not trigger re-renders for messages without repliers
const NO_REPLY_USER_IDS: number[] = [];

type TMessageProps = {
  message: TJoinedMessage;
  disableActions?: boolean;
  disableFiles?: boolean;
  disableReactions?: boolean;
  onReplyMessageSelect?: (message: TJoinedMessage) => void;
  isInlineReplyTarget?: boolean;
  isActiveThread?: boolean;
  editingMessageId?: number;
  onEditComplete?: () => void;
};

const Message = memo(
  ({
    message,
    disableActions,
    disableFiles,
    disableReactions,
    onReplyMessageSelect,
    isInlineReplyTarget,
    isActiveThread,
    editingMessageId,
    onEditComplete
  }: TMessageProps) => {
    const [isPencilEditing, setIsPencilEditing] = useState(false);
    const isEditing = isPencilEditing || editingMessageId === message.id;
    const isFromOwnUser = useIsOwnUser(message.userId);
    const can = useCan();
    const ownUserId = useOwnUserId();
    const ownRoleIds = useOwnUserRoleIds();

    const canManage = useMemo(
      () => can(Permission.MANAGE_MESSAGES) || isFromOwnUser,
      [can, isFromOwnUser]
    );

    const isMentioned = useMemo(
      () => hasMention(message.content, ownUserId, ownRoleIds),
      [message.content, ownUserId, ownRoleIds]
    );

    const isThreadReply = !!message.parentMessageId;
    const replyCount = message.replyCount ?? 0;

    const handleEdit = useCallback(() => setIsPencilEditing(true), []);

    const handleReply = useCallback(
      () => onReplyMessageSelect?.(message),
      [onReplyMessageSelect, message]
    );

    const handleEditBlur = useCallback(() => {
      setIsPencilEditing(false);

      if (editingMessageId === message.id) {
        onEditComplete?.();
      }
    }, [editingMessageId, message.id, onEditComplete]);

    let content = (
      <MessageRenderer
        message={message}
        disableFiles={disableFiles}
        disableReactions={disableReactions}
      />
    );

    if (message.loading) {
      content = <BotThinking botId={message.userId} />;
    }

    const messageRow = (
      <div
        className={cn(
          'min-w-0 flex-1 ml-1 relative hover:bg-secondary/50 rounded-md px-1 py-0.5 group',
          isActiveThread && 'bg-primary/10',
          isMentioned && 'border-primary bg-primary/5',
          isInlineReplyTarget && 'ring-1 ring-primary/50 bg-primary/10'
        )}
        data-testid={TestId.MESSAGE_ITEM}
        data-message-id={message.id}
      >
        {!isEditing ? (
          <>
            {message.interactionCommandName && (
              <InteractionHeader
                userId={message.interactionUserId}
                commandName={message.interactionCommandName}
              />
            )}
            {content}
            {!isThreadReply && replyCount > 0 && (
              <ThreadRepliesButton
                messageId={message.id}
                channelId={message.channelId}
                replyCount={replyCount}
                replyUserIds={message.replyUserIds ?? NO_REPLY_USER_IDS}
              />
            )}
            {!disableActions && (
              <MessageActions
                onEdit={handleEdit}
                canManage={canManage}
                messageId={message.id}
                channelId={message.channelId}
                editable={message.editable ?? false}
                isPinned={message.pinned ?? false}
                disablePin={!!message.parentMessageId}
                isThreadReply={isThreadReply}
                onReply={handleReply}
              />
            )}
          </>
        ) : (
          <MessageEditInline message={message} onBlur={handleEditBlur} />
        )}
      </div>
    );

    if (disableActions) return messageRow;

    return (
      <MessageContextMenu
        messageId={message.id}
        channelId={message.channelId}
        onEdit={handleEdit}
        onReply={onReplyMessageSelect ? handleReply : undefined}
        canManage={canManage}
        editable={message.editable ?? false}
        isThreadReply={isThreadReply}
        isPinned={message.pinned ?? false}
        disabled={isEditing}
      >
        {messageRow}
      </MessageContextMenu>
    );
  }
);

export { Message };

import { EmojiPicker } from '@/components/emoji-picker';
import { useRecentEmojis } from '@/components/emoji-picker/use-recent-emojis';
import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { Protect } from '@/components/protect';
import {
  shouldUseFallbackImage,
  withoutShadowedEmojis,
  type TEmojiItem
} from '@/components/tiptap-input/helpers';
import { useCustomEmojis } from '@/features/server/emojis/hooks';
import { Permission, PluginSlot, TestId } from '@sandshark/shared';
import { IconButton } from '@sandshark/ui';
import {
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Smile,
  Trash,
  Trash2
} from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMessageActions } from './hooks/use-message-actions';

const MAX_QUICK_EMOJIS = 4;

type TMessageActionsProps = {
  messageId: number;
  channelId: number;
  onEdit: () => void;
  onReply?: () => void;
  canManage: boolean;
  editable: boolean;
  isThreadReply?: boolean;
  isPinned?: boolean;
  disablePin?: boolean;
};

type TQuickReactionButtonProps = {
  emoji: TEmojiItem;
  onSelect: (emoji: TEmojiItem) => void;
};

const QuickReactionButton = memo(
  ({ emoji, onSelect }: TQuickReactionButtonProps) => {
    const handleClick = useCallback(() => onSelect(emoji), [onSelect, emoji]);

    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded-md transition-colors text-md"
        title={`:${emoji.shortcodes[0]}:`}
      >
        {emoji.emoji && !shouldUseFallbackImage(emoji) ? (
          <span>{emoji.emoji}</span>
        ) : emoji.fallbackImage ? (
          <img
            src={emoji.fallbackImage}
            alt={emoji.name}
            className="w-5 h-5 object-contain"
          />
        ) : (
          <span>{emoji.name}</span>
        )}
      </button>
    );
  }
);

const MessageActions = memo(
  ({
    onEdit,
    messageId,
    channelId,
    canManage,
    editable,
    isThreadReply,
    isPinned,
    disablePin,
    onReply
  }: TMessageActionsProps) => {
    const { t } = useTranslation();
    const { recentEmojis } = useRecentEmojis();
    const customEmojis = useCustomEmojis();

    // a built-in picked before a custom emoji took its name would show itself
    // but react with the custom one
    const recentEmojisToShow = useMemo(() => {
      const reachableEmojis = withoutShadowedEmojis(recentEmojis, customEmojis);

      return reachableEmojis.slice(0, MAX_QUICK_EMOJIS);
    }, [recentEmojis, customEmojis]);

    const {
      isShiftHeld,
      onDelete,
      onToggleReaction,
      onReplyInThread,
      onTogglePin
    } = useMessageActions(messageId, channelId);

    const pluginProps = useMemo(
      () => ({ messageId, channelId }),
      [messageId, channelId]
    );

    return (
      <div className="gap-1 absolute right-0 -top-6 z-10 hidden group-hover:flex [&:has([data-state=open])]:flex items-center space-x-1 rounded-lg shadow-lg border border-border p-2 transition-all bg-background">
        {onReply && (
          <IconButton
            size="sm"
            variant="ghost"
            icon={Reply}
            onClick={onReply}
            title={t('replyToMessage')}
          />
        )}
        {!isThreadReply && (
          <IconButton
            size="sm"
            variant="ghost"
            icon={MessageSquareText}
            onClick={onReplyInThread}
            title={t('replyInThread')}
            data-testid={TestId.MESSAGE_REPLY_IN_THREAD}
          />
        )}
        {canManage && (
          <>
            <IconButton
              size="sm"
              variant="ghost"
              icon={Pencil}
              onClick={onEdit}
              disabled={!editable}
              title={t('editMessage')}
            />

            <IconButton
              size="sm"
              variant="ghost"
              icon={isShiftHeld ? Trash2 : Trash}
              className={isShiftHeld ? 'text-destructive' : ''}
              onClick={onDelete}
              title={t('deleteMessageTitle')}
              data-testid={TestId.MESSAGE_DELETE}
            />
          </>
        )}
        {!disablePin && (
          <Protect permission={Permission.PIN_MESSAGES}>
            <IconButton
              size="sm"
              variant="ghost"
              icon={isPinned ? PinOff : Pin}
              onClick={onTogglePin}
              title={isPinned ? t('unpinMessage') : t('pinMessage')}
            />
          </Protect>
        )}

        <PluginSlotRenderer
          slotId={PluginSlot.MESSAGE_ACTIONS}
          props={pluginProps}
        />

        <Protect permission={Permission.REACT_TO_MESSAGES}>
          <div className="flex items-center space-x-0.5 border-l pl-1 gap-1">
            {recentEmojisToShow.map((emoji) => (
              <QuickReactionButton
                key={emoji.name}
                emoji={emoji}
                onSelect={onToggleReaction}
              />
            ))}

            <EmojiPicker onEmojiSelect={onToggleReaction}>
              <IconButton
                variant="ghost"
                icon={Smile}
                title={t('addReaction')}
              />
            </EmojiPicker>
          </div>
        </Protect>
      </div>
    );
  }
);

export { MessageActions };

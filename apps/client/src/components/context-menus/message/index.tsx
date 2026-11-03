import { useMessageActions } from '@/components/channel-view/text/hooks/use-message-actions';
import { useCan } from '@/features/server/hooks';
import { Permission, TestId } from '@sandshark/shared';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@sandshark/ui';
import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TMessageContextMenuProps = {
  children: React.ReactNode;
  messageId: number;
  channelId: number;
  onEdit: () => void;
  onReply?: () => void;
  canManage: boolean;
  editable: boolean;
  isThreadReply: boolean;
  isPinned: boolean;
  disabled: boolean;
};

// innerText of the rendered paragraphs keeps line breaks, emoji and mentions as
// the user sees them, which the stored html does not give without a dom parser
const getRenderedMessageText = (element: HTMLElement | null) => {
  const content = element?.querySelector<HTMLElement>('.msg-content');

  if (!content) return '';

  return Array.from(content.children)
    .filter((child) => !child.classList.contains('msg-edit'))
    .map((child) => (child as HTMLElement).innerText)
    .join('\n')
    .trim();
};

const MessageContextMenu = memo(
  ({
    children,
    messageId,
    channelId,
    onEdit,
    onReply,
    canManage,
    editable,
    isThreadReply,
    isPinned,
    disabled
  }: TMessageContextMenuProps) => {
    const { t } = useTranslation();
    const can = useCan();
    const triggerRef = useRef<HTMLDivElement>(null);
    const selectedTextRef = useRef('');
    const [linkUrl, setLinkUrl] = useState<string>();
    const { onDelete, onReplyInThread, onTogglePin } = useMessageActions(
      messageId,
      channelId
    );

    const canPin = !isThreadReply && can(Permission.PIN_MESSAGES);

    // taking over the right click hides the browser's own copy and copy link, so the
    // selection and the link under the cursor are read here to offer both instead
    const onContextMenu = useCallback((event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>('a[href]');
      const selection = window.getSelection();

      selectedTextRef.current = selection ? selection.toString().trim() : '';
      setLinkUrl(link ? link.href : undefined);
    }, []);

    const onCopyText = useCallback(async () => {
      const text =
        selectedTextRef.current || getRenderedMessageText(triggerRef.current);

      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);

        toast.success(t('messageTextCopied'));
      } catch {
        toast.error(t('failedCopyMessageText'));
      }
    }, [t]);

    const onCopyLink = useCallback(async () => {
      if (!linkUrl) return;

      try {
        await navigator.clipboard.writeText(linkUrl);

        toast.success(t('linkCopied'));
      } catch {
        toast.error(t('failedCopyLink'));
      }
    }, [linkUrl, t]);

    return (
      <ContextMenu>
        <ContextMenuTrigger
          asChild
          ref={triggerRef}
          disabled={disabled}
          onContextMenu={onContextMenu}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent data-testid={TestId.MESSAGE_CONTEXT_MENU}>
          {onReply && (
            <ContextMenuItem onClick={onReply}>
              {t('replyToMessage')}
            </ContextMenuItem>
          )}
          {!isThreadReply && (
            <ContextMenuItem onClick={onReplyInThread}>
              {t('replyInThread')}
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={onCopyText}>
            {t('copyText')}
          </ContextMenuItem>
          {linkUrl && (
            <ContextMenuItem onClick={onCopyLink}>
              {t('copyLink')}
            </ContextMenuItem>
          )}
          {canPin && (
            <ContextMenuItem onClick={onTogglePin}>
              {isPinned ? t('unpinMessage') : t('pinMessage')}
            </ContextMenuItem>
          )}
          {canManage && (
            <>
              <ContextMenuSeparator />
              {editable && (
                <ContextMenuItem onClick={onEdit}>
                  {t('editMessage')}
                </ContextMenuItem>
              )}
              <ContextMenuItem
                data-testid={TestId.MESSAGE_MENU_DELETE}
                variant="destructive"
                onClick={onDelete}
              >
                {t('deleteMessageTitle')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

export { MessageContextMenu };

import type { TEmojiItem } from '@/components/tiptap-input/helpers';
import { openThreadSidebar } from '@/features/app/actions';
import { useIsShiftHeld } from '@/features/app/hooks';
import { requestConfirmation } from '@/features/dialogs/actions';
import { getTRPCClient } from '@/lib/trpc';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// shared by the hover toolbar and the right-click menu so both run the same calls
const useMessageActions = (messageId: number, channelId: number) => {
  const { t } = useTranslation();
  const isShiftHeld = useIsShiftHeld();

  const onDelete = useCallback(async () => {
    if (!isShiftHeld) {
      const choice = await requestConfirmation({
        title: t('deleteMessageTitle'),
        message: t('deleteMessageConfirm'),
        confirmLabel: t('deleteLabel'),
        cancelLabel: t('cancel')
      });

      if (!choice) return;
    }

    try {
      const trpc = getTRPCClient();

      await trpc.messages.delete.mutate({ messageId });
      toast.success(t('messageDeleted'));
    } catch {
      toast.error(t('failedDeleteMessage'));
    }
  }, [isShiftHeld, messageId, t]);

  const onToggleReaction = useCallback(
    async (emoji: TEmojiItem) => {
      try {
        const trpc = getTRPCClient();

        await trpc.messages.toggleReaction.mutate({
          messageId,
          emoji: emoji.shortcodes[0]
        });
      } catch (error) {
        toast.error(t('failedAddReaction'));

        console.error('Error adding reaction:', error);
      }
    },
    [messageId, t]
  );

  const onReplyInThread = useCallback(() => {
    openThreadSidebar(messageId, channelId);
  }, [messageId, channelId]);

  const onTogglePin = useCallback(async () => {
    try {
      const trpc = getTRPCClient();

      await trpc.messages.togglePin.mutate({ messageId });

      toast.success(t('messagePinToggled'));
    } catch (error) {
      toast.error(t('failedTogglePin'));

      console.error('Error toggling pin status:', error);
    }
  }, [messageId, t]);

  return {
    isShiftHeld,
    onDelete,
    onToggleReaction,
    onReplyInThread,
    onTogglePin
  };
};

export { useMessageActions };

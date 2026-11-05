import { UnreadCount } from '@/components/unread-count';
import { setThreadsOpen } from '@/features/server/threads/actions';
import {
  useFollowedThreadsReadState,
  useThreadsOpen
} from '@/features/server/threads/hooks';
import { TestId } from '@sandshark/shared';
import { cn, Tooltip } from '@sandshark/ui';
import { MessageSquareText, X } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SIDEBAR_ITEM_ACTIVE_CLASS, SIDEBAR_ITEM_CLASS } from '../helpers';

const ThreadsButton = memo(() => {
  const { t } = useTranslation('sidebar');
  const threadsOpen = useThreadsOpen();
  const { unreadCount, hasUnreadMention } = useFollowedThreadsReadState();

  const onToggleThreads = useCallback(() => {
    setThreadsOpen(!threadsOpen);
  }, [threadsOpen]);

  return (
    <Tooltip content={threadsOpen ? t('closeThreads') : t('openThreads')}>
      <button
        type="button"
        data-testid={TestId.THREADS_TOGGLE}
        onClick={onToggleThreads}
        className={cn(
          SIDEBAR_ITEM_CLASS,
          threadsOpen && SIDEBAR_ITEM_ACTIVE_CLASS
        )}
        aria-current={threadsOpen ? 'page' : undefined}
      >
        <MessageSquareText className="h-4 w-4" />
        <span className="flex-1 text-left">{t('threads')}</span>
        {threadsOpen && <X className="h-4 w-4" />}
        <UnreadCount count={unreadCount} hasMention={hasUnreadMention} />
      </button>
    </Tooltip>
  );
});

export { ThreadsButton };

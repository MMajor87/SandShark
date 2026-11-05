import { setDmsOpen } from '@/features/server/actions';
import { useCalendarOpen } from '@/features/server/calendar/hooks';
import { useDirectMessagesUnreadCount } from '@/features/server/channels/hooks';
import { useDmsOpen } from '@/features/server/hooks';
import { useThreadsOpen } from '@/features/server/threads/hooks';
import { TestId } from '@sandshark/shared';
import { cn, Tooltip } from '@sandshark/ui';
import { MessageCircleMore, X } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SIDEBAR_ITEM_ACTIVE_CLASS, SIDEBAR_ITEM_CLASS } from '../helpers';

const DmButton = memo(() => {
  const { t } = useTranslation('sidebar');
  const directMessagesUnreadCount = useDirectMessagesUnreadCount();
  const dmsOpen = useDmsOpen();
  const threadsOpen = useThreadsOpen();
  const calendarOpen = useCalendarOpen();
  const isActive = dmsOpen && !threadsOpen && !calendarOpen;

  const onToggleDmMode = useCallback(() => {
    setDmsOpen(!isActive);
  }, [isActive]);

  return (
    <Tooltip
      content={isActive ? t('closeDirectMessages') : t('openDirectMessages')}
    >
      <button
        data-testid={TestId.DM_TOGGLE}
        type="button"
        onClick={onToggleDmMode}
        className={cn(
          SIDEBAR_ITEM_CLASS,
          isActive && SIDEBAR_ITEM_ACTIVE_CLASS
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <MessageCircleMore className="h-4 w-4" />
        <span className="flex-1 text-left">{t('directMessages')}</span>
        {isActive && <X className="h-4 w-4" />}
        {directMessagesUnreadCount > 0 && (
          <div className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
            {directMessagesUnreadCount > 99 ? '99+' : directMessagesUnreadCount}
          </div>
        )}
      </button>
    </Tooltip>
  );
});

export { DmButton };

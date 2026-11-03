import { TestId } from '@sandshark/shared';
import { ContextMenuItem } from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserActions } from './hooks/use-user-actions';

type TUserMenuItemsProps = {
  userId: number;
};

const UserMenuItems = memo(({ userId }: TUserMenuItemsProps) => {
  const { t } = useTranslation();
  const { canDirectMessage, canModerate, onDirectMessage, onModerate } =
    useUserActions(userId);

  return (
    <>
      {canDirectMessage && (
        <ContextMenuItem
          data-testid={TestId.USER_MENU_DM}
          onClick={onDirectMessage}
        >
          {t('directMessage')}
        </ContextMenuItem>
      )}
      {canModerate && (
        <ContextMenuItem
          data-testid={TestId.USER_MENU_MODERATE}
          onClick={onModerate}
        >
          {t('moderationView')}
        </ContextMenuItem>
      )}
    </>
  );
});

export { UserMenuItems };

import { TestId } from '@sandshark/shared';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TDirectMessageContextMenuProps = {
  children: React.ReactNode;
  name: string;
  onClose: () => void;
};

const DirectMessageContextMenu = memo(
  ({ children, name, onClose }: TDirectMessageContextMenuProps) => {
    const { t } = useTranslation('sidebar');

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>{name}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem data-testid={TestId.DM_MENU_CLOSE} onClick={onClose}>
            {t('closeConversation')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);

export { DirectMessageContextMenu };

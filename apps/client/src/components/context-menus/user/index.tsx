import { useUserById } from '@/features/server/users/hooks';
import { getRenderedUsername } from '@/helpers/get-rendered-username';
import { TestId } from '@sandshark/shared';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@sandshark/ui';
import { memo } from 'react';
import { useUserActions } from './hooks/use-user-actions';
import { UserMenuItems } from './user-menu-items';

type TUserContextMenuProps = {
  children: React.ReactNode;
  userId: number;
};

// the trigger wraps the children in a div because they are usually a user popover,
// a component that does not pass the trigger props on to its own element
const UserContextMenu = memo(({ children, userId }: TUserContextMenuProps) => {
  const user = useUserById(userId);
  const { canDirectMessage, canModerate } = useUserActions(userId);

  if (!user || (!canDirectMessage && !canModerate)) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid={TestId.USER_CONTEXT_MENU}>
        <ContextMenuLabel>{getRenderedUsername(user)}</ContextMenuLabel>
        <ContextMenuSeparator />
        <UserMenuItems userId={userId} />
      </ContextMenuContent>
    </ContextMenu>
  );
});

export { UserContextMenu };

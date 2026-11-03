import { UserContextMenu } from '@/components/context-menus/user';
import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { ResizableSidebar } from '@/components/resizable-sidebar';
import { UserAvatar } from '@/components/user-avatar';
import { useUsers } from '@/features/server/users/hooks';
import { LocalStorageKey } from '@/helpers/storage';
import { cn } from '@/lib/utils';
import {
  DELETED_USER_IDENTITY_AND_NAME,
  PluginSlot,
  TestId,
  UserStatus,
  type TJoinedPublicUser
} from '@sandshark/shared';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPopover } from '../user-popover';

const MAX_USERS_TO_SHOW = 100;
const MIN_WIDTH = 180;
const MAX_WIDTH = 360;
const DEFAULT_WIDTH = 240; // w-60 = 240px

type TUserProps = {
  userId: number;
  name: string;
  banned: boolean;
  offline: boolean;
};

const User = memo(({ userId, name, banned, offline }: TUserProps) => {
  const pluginProps = useMemo(() => ({ userId }), [userId]);

  return (
    <UserContextMenu userId={userId}>
      <UserPopover userId={userId}>
        <div
          data-testid={TestId.MEMBER_ITEM}
          className={cn(
            'flex min-w-0 select-none items-center gap-3 rounded-md px-2 py-1.5 transition-opacity hover:bg-accent hover:opacity-100',
            offline && 'opacity-40'
          )}
        >
          <UserAvatar userId={userId} className="h-8 w-8 shrink-0" />
          <span
            className={cn(
              'text-sm text-foreground truncate',
              banned && 'line-through text-muted-foreground'
            )}
          >
            {name}
          </span>

          <PluginSlotRenderer
            slotId={PluginSlot.MEMBER_LIST_ITEM}
            props={pluginProps}
          />
        </div>
      </UserPopover>
    </UserContextMenu>
  );
});

type TMemberGroupProps = {
  label: string;
  users: TJoinedPublicUser[];
  offline: boolean;
};

const MemberGroup = memo(({ label, users, offline }: TMemberGroupProps) => {
  if (users.length === 0) return null;

  return (
    <section className="space-y-0.5">
      <h3 className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        <span className="ml-1.5">{users.length}</span>
      </h3>
      {users.map((user) => (
        <User
          key={user.id}
          userId={user.id}
          name={user.name}
          banned={user.banned}
          offline={offline}
        />
      ))}
    </section>
  );
});

type TRightSidebarProps = {
  className?: string;
  isOpen?: boolean;
};

const RightSidebar = memo(
  ({ className, isOpen = true }: TRightSidebarProps) => {
    const { t } = useTranslation('sidebar');
    const users = useUsers();

    const { onlineUsers, offlineUsers, hiddenCount } = useMemo(() => {
      const filtered = users.filter(
        (user) => user.name !== DELETED_USER_IDENTITY_AND_NAME
      );
      const visible = filtered.slice(0, MAX_USERS_TO_SHOW);
      const isOffline = (user: TJoinedPublicUser) =>
        !user.status || user.status === UserStatus.OFFLINE;

      return {
        onlineUsers: visible.filter((user) => !isOffline(user)),
        offlineUsers: visible.filter(isOffline),
        hiddenCount: filtered.length - visible.length
      };
    }, [users]);

    return (
      <ResizableSidebar
        storageKey={LocalStorageKey.RIGHT_SIDEBAR_WIDTH}
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
        defaultWidth={DEFAULT_WIDTH}
        edge="left"
        isOpen={isOpen}
        className={cn('h-full', className)}
      >
        <aside
          aria-label={t('members')}
          className="flex-1 overflow-y-auto px-2 pb-2"
        >
          <MemberGroup
            label={t('membersOnline')}
            users={onlineUsers}
            offline={false}
          />
          <MemberGroup
            label={t('membersOffline')}
            users={offlineUsers}
            offline
          />
          {hiddenCount > 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {t('membersHidden', { count: hiddenCount })}
            </div>
          )}
        </aside>
      </ResizableSidebar>
    );
  }
);

export { RightSidebar };

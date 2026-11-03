import { setModViewOpen } from '@/features/app/actions';
import { openDirectMessage } from '@/features/server/dms/actions';
import { useCan, usePublicServerSettings } from '@/features/server/hooks';
import { useIsOwnUser, useUserById } from '@/features/server/users/hooks';
import { DELETED_USER_IDENTITY_AND_NAME, Permission } from '@sandshark/shared';
import { useCallback } from 'react';

// shared by the user popover buttons and the user context menu so both offer the
// same actions to the same people
const useUserActions = (userId: number) => {
  const user = useUserById(userId);
  const settings = usePublicServerSettings();
  const isOwnUser = useIsOwnUser(userId);
  const can = useCan();

  const isDeleted = user?.name === DELETED_USER_IDENTITY_AND_NAME;
  const canDirectMessage =
    !!user && !!settings?.directMessagesEnabled && !isDeleted && !isOwnUser;
  const canModerate = !!user && can(Permission.MANAGE_USERS);

  const onDirectMessage = useCallback(() => {
    openDirectMessage(userId);
  }, [userId]);

  const onModerate = useCallback(() => {
    setModViewOpen(true, userId);
  }, [userId]);

  return { canDirectMessage, canModerate, onDirectMessage, onModerate };
};

export { useUserActions };

import {
  useIsConnected,
  useServerName,
  useTotalUnreadCount
} from '@/features/server/hooks';
import { isDesktopClient } from '@/platform/environment';
import { useEffect } from 'react';
import { getDocumentTitle } from '../helpers';

const useDocumentTitle = () => {
  const isConnected = useIsConnected();
  const serverName = useServerName();
  const unreadCount = useTotalUnreadCount();

  useEffect(() => {
    document.title =
      isDesktopClient() && (!isConnected || !serverName)
        ? 'SandShark'
        : getDocumentTitle(isConnected, serverName, unreadCount);
  }, [isConnected, serverName, unreadCount]);
};

export { useDocumentTitle };

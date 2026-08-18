import { beginServerConnection } from '@/features/app/actions';
import { jumpToMessage, switchServer } from '@/features/server/actions';
import { useIsConnected } from '@/features/server/hooks';
import {
  getActiveServerProfileId,
  selectServerProfile
} from '@/helpers/server-connection';
import { isDesktopClient } from '@/platform/environment';
import { memo, useCallback, useEffect, useRef } from 'react';

type TNotificationTarget = {
  profileId?: string;
  channelId: number;
  messageId: number;
  isDm: boolean;
};

const DesktopNotificationController = memo(() => {
  const isConnected = useIsConnected();
  const pendingTargetRef = useRef<TNotificationTarget | undefined>(undefined);

  const navigate = useCallback(
    (target: TNotificationTarget) => {
      const activeProfileId = getActiveServerProfileId();

      if (target.profileId && target.profileId !== activeProfileId) {
        switchServer();
        if (!selectServerProfile(target.profileId)) return;
        pendingTargetRef.current = target;
        beginServerConnection();
        return;
      }

      if (!isConnected) {
        pendingTargetRef.current = target;
        return;
      }

      jumpToMessage(target);
    },
    [isConnected]
  );

  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    return window.sandSharkDesktop.onNotificationClick(navigate);
  }, [navigate]);

  useEffect(() => {
    const target = pendingTargetRef.current;
    if (!isConnected || !target) return;

    if (target.profileId && target.profileId !== getActiveServerProfileId()) {
      return;
    }

    pendingTargetRef.current = undefined;
    jumpToMessage(target);
  }, [isConnected]);

  return null;
});

DesktopNotificationController.displayName = 'DesktopNotificationController';

export { DesktopNotificationController };

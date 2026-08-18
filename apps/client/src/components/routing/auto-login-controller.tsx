import { setIsAutoConnecting } from '@/features/app/actions';
import { useIsAppLoading, useIsPluginsLoading } from '@/features/app/hooks';
import { connect, setDisconnectInfo } from '@/features/server/actions';
import { useDisconnectInfo, useIsConnected } from '@/features/server/hooks';
import {
  clearCurrentServerAutoLogin,
  getCurrentServerAutoLoginToken,
  setCurrentSessionToken
} from '@/helpers/server-session';
import { memo, useEffect, useRef } from 'react';

const AutoLoginController = memo(() => {
  const isConnected = useIsConnected();
  const isAppLoading = useIsAppLoading();
  const isPluginsLoading = useIsPluginsLoading();
  const disconnectInfo = useDisconnectInfo();
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    if (
      isAppLoading ||
      isPluginsLoading ||
      isConnected ||
      disconnectInfo ||
      autoLoginAttempted.current
    ) {
      // ignore if the app is not done loading, if we're already connected or in the process of connecting
      return;
    }

    autoLoginAttempted.current = true;

    void getCurrentServerAutoLoginToken().then((savedToken) => {
      if (!savedToken) {
        autoLoginAttempted.current = false;
        return;
      }

      setIsAutoConnecting(true);
      setCurrentSessionToken(savedToken);

      return connect()
        .catch(() => {
          // token expired or invalid clear auto-login state so the user
          // sees the connect screen and can log in manually
          clearCurrentServerAutoLogin();
          setDisconnectInfo(undefined);
        })
        .finally(() => {
          // reset auto-login attempt state so if the user logs out and back in they can try auto-login again
          autoLoginAttempted.current = false;
          setIsAutoConnecting(false);
        });
    });
  }, [isAppLoading, isPluginsLoading, isConnected, disconnectInfo]);

  return null;
});

export { AutoLoginController };

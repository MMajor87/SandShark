import { ReconnectingOverlay } from '@/components/reconnecting-overlay';
import {
  useIsAppLoading,
  useIsAutoConnecting,
  useIsPluginsLoading,
  useServerConnectionRequired
} from '@/features/app/hooks';
import {
  useDisconnectInfo,
  useIsConnected,
  useIsReconnecting,
  useServerName,
  useTotalUnreadMentions,
  useTotalUnreadMessages
} from '@/features/server/hooks';
import { useOwnVoiceState } from '@/features/server/voice/hooks';
import { isDesktopClient } from '@/platform/environment';
import { Connect } from '@/screens/connect';
import { Disconnected } from '@/screens/disconnected';
import { LoadingApp } from '@/screens/loading-app';
import { ServerConnection } from '@/screens/server-connection';
import { ServerView } from '@/screens/server-view';
import { DisconnectCode } from '@sharkord/shared';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from './hooks/use-document-title';
import { useOidcAutoRedirect } from './hooks/use-oidc-auto-redirect';

const Routing = memo(() => {
  const { t } = useTranslation('connect');
  const isConnected = useIsConnected();
  const isAppLoading = useIsAppLoading();
  const isPluginsLoading = useIsPluginsLoading();
  const disconnectInfo = useDisconnectInfo();
  const serverName = useServerName();
  const totalUnreadMessages = useTotalUnreadMessages();
  const totalUnreadMentions = useTotalUnreadMentions();
  const ownVoiceState = useOwnVoiceState();
  const isAutoConnecting = useIsAutoConnecting();
  const serverConnectionRequired = useServerConnectionRequired();

  const isReconnecting = useIsReconnecting();
  useDocumentTitle();
  useOidcAutoRedirect();

  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    void window.sandSharkDesktop.setTrayStatus({
      serverName: isConnected ? serverName : undefined,
      micMuted: ownVoiceState.micMuted,
      soundMuted: ownVoiceState.soundMuted,
      unreadCount: totalUnreadMessages
    });
    void window.sandSharkDesktop.setTaskbarStatus({
      unreadCount: totalUnreadMessages,
      mentionCount: totalUnreadMentions
    });
  }, [
    isConnected,
    serverName,
    ownVoiceState.micMuted,
    ownVoiceState.soundMuted,
    totalUnreadMentions,
    totalUnreadMessages
  ]);

  if (isAppLoading || isPluginsLoading) {
    return (
      <LoadingApp text={isAppLoading ? t('loadingApp') : t('loadingPlugins')} />
    );
  }

  if (serverConnectionRequired) {
    return <ServerConnection />;
  }

  if (!isConnected && !isReconnecting) {
    if (isAutoConnecting) {
      return <LoadingApp text={t('loggingInAutomatically')} />;
    }

    if (
      disconnectInfo &&
      (!disconnectInfo.wasClean ||
        disconnectInfo.code === DisconnectCode.KICKED ||
        disconnectInfo.code === DisconnectCode.BANNED ||
        disconnectInfo.code === DisconnectCode.SERVER_SHUTDOWN)
    ) {
      return <Disconnected info={disconnectInfo} />;
    }

    return <Connect />;
  }

  return (
    <>
      {isReconnecting && <ReconnectingOverlay />}

      <div className="contents" inert={isReconnecting}>
        <ServerView />
      </div>
    </>
  );
});

export { Routing };

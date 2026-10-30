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
import { getUrlFromServer } from '@/helpers/get-file-url';
import { cleanup } from '@/lib/trpc';
import { isDesktopClient } from '@/platform/environment';
import { Connect } from '@/screens/connect';
import { Disconnected } from '@/screens/disconnected';
import { LoadingApp } from '@/screens/loading-app';
import { ServerConnection } from '@/screens/server-connection';
import { ServerView } from '@/screens/server-view';
import { DisconnectCode } from '@sharkord/shared';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  const accountDeleteHandled = useRef(false);
  useDocumentTitle();
  useOidcAutoRedirect();

  useEffect(() => {
    const code = new URLSearchParams(window.location.hash.slice(1)).get(
      'account_deleted'
    );

    if (accountDeleteHandled.current || !code) return;

    accountDeleteHandled.current = true;
    window.history.replaceState({}, document.title, window.location.pathname);
    fetch(`${getUrlFromServer()}/oidc/exchange`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Account deletion confirmation failed');
        const result = (await response.json()) as { token: string };
        if (result.token !== 'deleted')
          throw new Error('Account deletion confirmation failed');
        cleanup();
        toast.success(t('accountDeleted'));
      })
      .catch(() => {
        toast.error(t('oidcError.server_error'));
      });
  }, [t]);

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

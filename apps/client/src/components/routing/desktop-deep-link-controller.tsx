import {
  beginServerConnection,
  setSelectedDmChannelId
} from '@/features/app/actions';
import { setDmsOpen, switchServer } from '@/features/server/actions';
import { setSelectedChannelId } from '@/features/server/channels/actions';
import { useIsConnected } from '@/features/server/hooks';
import { store } from '@/features/store';
import {
  getActiveServerProfile,
  saveServerConnection,
  selectServerProfile,
  validateServerConnection
} from '@/helpers/server-connection';
import { isDesktopClient } from '@/platform/environment';
import { memo, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

type TDeepLinkDestination = {
  channelId?: number;
  serverUrl?: string;
};

const getPathSegments = (pathname: string) => {
  try {
    return pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
};

const getChannelId = (value: string | undefined) => {
  if (!value || !/^\d+$/.test(value)) return undefined;

  const channelId = Number(value);

  return Number.isSafeInteger(channelId) && channelId > 0
    ? channelId
    : undefined;
};

const parseDeepLink = (value: string): TDeepLinkDestination | undefined => {
  try {
    const url = new URL(value);

    if (
      (url.protocol !== 'sandshark:' && url.protocol !== 'sharkord:') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }

    const segments = getPathSegments(url.pathname);
    if (!segments) return undefined;

    if (url.hostname === 'channel' && segments.length === 1) {
      const channelId = getChannelId(segments[0]);
      return channelId ? { channelId } : undefined;
    }

    if (url.hostname === 'server' && segments.length >= 1) {
      const [serverUrl, route, channel] = segments;
      if (!serverUrl || (route !== undefined && route !== 'channel')) {
        return undefined;
      }

      if (route === undefined) return { serverUrl };
      if (segments.length !== 3) return undefined;

      const channelId = getChannelId(channel);
      return channelId ? { serverUrl, channelId } : undefined;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const DesktopDeepLinkController = memo(() => {
  const isConnected = useIsConnected();
  const pendingDestinationRef = useRef<TDeepLinkDestination | undefined>(
    undefined
  );

  const openChannel = useCallback((channelId: number) => {
    const channelExists = store
      .getState()
      .server.channels.some((channel) => channel.id === channelId);

    if (!channelExists) {
      toast.error('The linked channel is not available on this server.');
      return;
    }

    setDmsOpen(false);
    setSelectedDmChannelId(undefined);
    setSelectedChannelId(channelId);
  }, []);

  const openDeepLink = useCallback(
    async (value: string) => {
      const destination = parseDeepLink(value);

      if (!destination) {
        toast.error('This SandShark link is invalid.');
        return;
      }

      if (destination.serverUrl) {
        try {
          const { config, icon } = await validateServerConnection(
            destination.serverUrl
          );
          const profile = saveServerConnection(config, { icon });

          pendingDestinationRef.current = {
            channelId: destination.channelId
          };
          switchServer();
          selectServerProfile(profile.id);
          beginServerConnection();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not open the linked Sharkord server.'
          );
        }

        return;
      }

      if (isConnected && destination.channelId) {
        openChannel(destination.channelId);
        return;
      }

      if (!getActiveServerProfile()) {
        toast.error('Choose a Sharkord server before opening a channel link.');
        return;
      }

      pendingDestinationRef.current = destination;
      beginServerConnection();
    },
    [isConnected, openChannel]
  );

  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    const unsubscribe = window.sandSharkDesktop.onDeepLink((url) => {
      void openDeepLink(url);
    });

    void window.sandSharkDesktop.readyForDeepLinks().then((urls) => {
      for (const url of urls) void openDeepLink(url);
    });

    return unsubscribe;
  }, [openDeepLink]);

  useEffect(() => {
    const destination = pendingDestinationRef.current;
    if (!isConnected || !destination) return;

    pendingDestinationRef.current = undefined;

    if (destination.channelId) openChannel(destination.channelId);
  }, [isConnected, openChannel]);

  return null;
});

DesktopDeepLinkController.displayName = 'DesktopDeepLinkController';

export { DesktopDeepLinkController };

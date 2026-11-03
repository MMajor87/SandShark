import { TextChannel } from '@/components/channel-view/text';
import { VoiceChannel } from '@/components/channel-view/voice';
import { PluginSlotRenderer } from '@/components/plugin-slot-renderer';
import { ThreadContent } from '@/components/thread-sidebar/thread-content';
import { ViewHeader } from '@/components/view-header';
import { setSelectedThread } from '@/features/app/actions';
import { useSelectedThread } from '@/features/app/hooks';
import {
  useChannelById,
  useSelectedChannelId,
  useSelectedChannelType
} from '@/features/server/channels/hooks';
import {
  useActiveFullscreenPluginId,
  useServerName
} from '@/features/server/hooks';
import { useThreadsOpen } from '@/features/server/threads/hooks';
import { ChannelType, PluginSlot } from '@sandshark/shared';
import { Alert, AlertDescription } from '@sandshark/ui';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  MessageCircleMore,
  MessageSquareText,
  Volume2
} from 'lucide-react';
import { memo, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type TContentWrapperProps = {
  isDmMode: boolean;
  selectedDmChannelId?: number;
  headerActions: ReactNode;
};

type TVoiceHeaderProps = {
  channelId: number;
  actions: ReactNode;
};

const VoiceHeader = memo(({ channelId, actions }: TVoiceHeaderProps) => {
  const channel = useChannelById(channelId);

  return <ViewHeader icon={Volume2} title={channel?.name} actions={actions} />;
});

const ContentWrapper = memo(
  ({ isDmMode, selectedDmChannelId, headerActions }: TContentWrapperProps) => {
    const { t } = useTranslation();
    const selectedChannelId = useSelectedChannelId();
    const selectedChannelType = useSelectedChannelType();
    const serverName = useServerName();
    const activeFullscreenPluginId = useActiveFullscreenPluginId();
    const threadsOpen = useThreadsOpen();
    const selectedThread = useSelectedThread();

    const onCloseThread = useCallback(() => setSelectedThread(undefined), []);

    if (activeFullscreenPluginId) {
      return (
        <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
          <ViewHeader actions={headerActions} />
          <div className="flex-col gap-2 h-full w-full flex overflow-auto relative bg-background">
            <PluginSlotRenderer
              slotId={PluginSlot.FULL_SCREEN}
              onlyPluginId={activeFullscreenPluginId}
            />
          </div>
        </main>
      );
    }

    let content;

    if (threadsOpen) {
      if (selectedThread) {
        content = (
          <ThreadContent
            key={selectedThread.parentMessageId}
            parentMessageId={selectedThread.parentMessageId}
            channelId={selectedThread.channelId}
            onClose={onCloseThread}
            headerActions={headerActions}
          />
        );
      } else {
        content = (
          <>
            <ViewHeader
              icon={MessageSquareText}
              title={t('sidebar:threads')}
              actions={headerActions}
            />
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('selectThreadPrompt')}
            </div>
          </>
        );
      }

      return (
        <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
          {content}
        </main>
      );
    }

    if (isDmMode) {
      if (selectedDmChannelId) {
        content = (
          <TextChannel
            key={selectedDmChannelId}
            channelId={selectedDmChannelId}
            headerActions={headerActions}
          />
        );
      } else {
        content = (
          <>
            <ViewHeader
              icon={MessageCircleMore}
              title={t('sidebar:directMessages')}
              actions={headerActions}
            />
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('selectDmPrompt')}
            </div>
          </>
        );
      }

      return (
        <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
          {content}
        </main>
      );
    }

    if (selectedChannelId) {
      if (selectedChannelType === ChannelType.TEXT) {
        content = (
          <TextChannel
            key={selectedChannelId}
            channelId={selectedChannelId}
            headerActions={headerActions}
          />
        );
      } else if (selectedChannelType === ChannelType.VOICE) {
        content = (
          <>
            <VoiceHeader
              channelId={selectedChannelId}
              actions={headerActions}
            />
            <VoiceChannel
              key={selectedChannelId}
              channelId={selectedChannelId}
            />
          </>
        );
      }
    } else {
      content = (
        <>
          <ViewHeader title={serverName} actions={headerActions} />
          <div className="flex-col gap-2 h-full w-full hidden lg:flex overflow-auto">
            <PluginSlotRenderer slotId={PluginSlot.HOME_SCREEN} />
          </div>
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center md:hidden">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {t('welcomeToServer', { name: serverName })}
              </h2>
            </div>
            <Alert variant="destructive" className="max-w-md">
              <AlertTriangle />
              <AlertDescription>{t('mobileNotOptimized')}</AlertDescription>
            </Alert>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  <ArrowRight />
                </span>
                <span>{t('swipeRightForChannels')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  <ArrowLeft />
                </span>
                <span>{t('swipeLeftForUsers')}</span>
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <main className="flex flex-1 flex-col bg-background relative min-w-0 min-h-0">
        {content}
      </main>
    );
  }
);

export { ContentWrapper };

import { memo, useCallback, type ReactNode } from 'react';
import { Conversation } from './conversation';
import { TextTopbar } from './text-top-bar';

type TChannelProps = {
  channelId: number;
  onClose?: () => void;
  headerActions?: ReactNode;
};

const TextChannel = memo(
  ({ channelId, onClose, headerActions }: TChannelProps) => {
    const renderHeader = useCallback(
      (scrollToMessage: (messageId: number) => Promise<void>) => (
        <TextTopbar
          onScrollToMessage={scrollToMessage}
          channelId={channelId}
          onClose={onClose}
          actions={headerActions}
        />
      ),
      [channelId, onClose, headerActions]
    );

    return <Conversation channelId={channelId} renderHeader={renderHeader} />;
  }
);

export { TextChannel };

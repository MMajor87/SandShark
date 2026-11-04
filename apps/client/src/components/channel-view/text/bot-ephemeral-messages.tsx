import { removeBotEphemeralMessage } from '@/features/server/bot-commands/actions';
import { useBotEphemeralMessages } from '@/features/server/bot-commands/hooks';
import { useOwnUserId, useUserById } from '@/features/server/users/hooks';
import { getRenderedUsername } from '@/helpers/get-rendered-username';
import {
  TestId,
  type TBotEphemeralMessage,
  type TJoinedMessage
} from '@sandshark/shared';
import { Button } from '@sandshark/ui';
import { EyeOff } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BotThinking } from './bot-thinking';
import { InteractionHeader } from './interaction-header';
import { BotMessageComponents } from './renderer/bot-message-components';
import { getParsedMessageHtml } from './renderer/content-cache';
import { MessageEmbeds } from './renderer/message-embeds';

// an ephemeral answer has no message row, so it is shaped like one for the content parser.
// the id is negated to stay clear of real message ids
const toParsableMessage = (message: TBotEphemeralMessage): TJoinedMessage => ({
  id: -message.id,
  content: message.content,
  userId: message.botId,
  pluginId: null,
  pluginComponents: null,
  channelId: message.channelId,
  parentMessageId: null,
  replyToMessageId: null,
  editable: false,
  metadata: null,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
  pinned: false,
  pinnedAt: null,
  pinnedBy: null,
  editedAt: null,
  editedBy: null,
  interactionId: message.interactionId,
  interactionUserId: null,
  interactionCommandName: null,
  loading: message.loading,
  embeds: message.embeds,
  components: message.components,
  files: [],
  reactions: []
});

type TBotEphemeralMessageItemProps = {
  message: TBotEphemeralMessage;
};

const BotEphemeralMessageItem = memo(
  ({ message }: TBotEphemeralMessageItemProps) => {
    const { t } = useTranslation();
    const ownUserId = useOwnUserId();
    const bot = useUserById(message.botId);
    const botName = bot ? getRenderedUsername(bot) : t('unknownUser');

    const content = useMemo(
      () => getParsedMessageHtml(toParsableMessage(message)),
      [message]
    );

    const onDismiss = useCallback(
      () => removeBotEphemeralMessage(message.id),
      [message.id]
    );

    let body = (
      <>
        <div className="prose max-w-full msg-content">{content}</div>
        <MessageEmbeds embeds={message.embeds} messageId={-message.id} />
        <BotMessageComponents
          rows={message.components}
          ephemeralMessageId={message.id}
        />
      </>
    );

    if (message.loading) {
      body = <BotThinking botId={message.botId} />;
    }

    return (
      <div
        className="ml-12 mr-2 flex flex-col gap-0.5 rounded-md border border-dashed border-border bg-muted/30 px-2 py-1"
        data-testid={TestId.BOT_EPHEMERAL_MESSAGE}
      >
        <InteractionHeader
          userId={ownUserId ?? null}
          commandName={message.commandName}
        />
        <span className="text-sm font-medium">{botName}</span>
        {body}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <EyeOff className="size-3" />
          <span>{t('botEphemeralOnlyYou')}</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={onDismiss}
          >
            {t('botEphemeralDismiss')}
          </Button>
        </div>
      </div>
    );
  }
);

type TBotEphemeralMessagesProps = {
  channelId: number;
};

// answers to this member's commands that only they see, below the channel's messages as
// they arrive, until dismissed or the page is reloaded. they sit inside the message list
// so the list's resize keeps the view pinned to the bottom when one arrives
const BotEphemeralMessages = memo(
  ({ channelId }: TBotEphemeralMessagesProps) => {
    const messages = useBotEphemeralMessages(channelId);

    if (messages.length === 0) return null;

    return (
      <div className="flex flex-col gap-2">
        {messages.map((message) => (
          <BotEphemeralMessageItem key={message.id} message={message} />
        ))}
      </div>
    );
  }
);

export { BotEphemeralMessages };

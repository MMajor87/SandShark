import { useUserById } from '@/features/server/users/hooks';
import { getRenderedUsername } from '@/helpers/get-rendered-username';
import { Spinner } from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TBotThinkingProps = {
  botId: number | null;
};

// a deferred answer the bot has not written yet
const BotThinking = memo(({ botId }: TBotThinkingProps) => {
  const { t } = useTranslation();
  const bot = useUserById(botId);
  const name = bot ? getRenderedUsername(bot) : t('unknownUser');

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
      <Spinner size="xs" />
      {t('botIsThinking', { bot: name })}
    </div>
  );
});

export { BotThinking };

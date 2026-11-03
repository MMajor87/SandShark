import { TestId } from '@sandshark/shared';
import { cn } from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TBotBadgeProps = {
  className?: string;
};

// marks plugin messages and bot accounts alike, both act on someone's behalf
const BotBadge = memo(({ className }: TBotBadgeProps) => {
  const { t } = useTranslation();

  return (
    <span
      data-testid={TestId.BOT_BADGE}
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary/60',
        className
      )}
    >
      {t('botBadge')}
    </span>
  );
});

export { BotBadge };

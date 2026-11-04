import { useUserById } from '@/features/server/users/hooks';
import { getRenderedUsername } from '@/helpers/get-rendered-username';
import { CornerDownRight } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TInteractionHeaderProps = {
  userId: number | null;
  commandName: string;
};

// above a bot's answer to a slash command, who ran which command
const InteractionHeader = memo(
  ({ userId, commandName }: TInteractionHeaderProps) => {
    const { t } = useTranslation();
    const user = useUserById(userId);
    const name = user ? getRenderedUsername(user) : t('unknownUser');

    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <CornerDownRight className="size-3 shrink-0" />
        <span className="truncate">
          {t('botUsedCommand', { user: name, command: commandName })}
        </span>
      </div>
    );
  }
);

export { InteractionHeader };

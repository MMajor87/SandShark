import { Dialog } from '@/components/dialogs/dialogs';
import {
  openDialog,
  requestConfirmation,
  requestTextInput
} from '@/features/dialogs/actions';
import { useRoles } from '@/features/server/roles/hooks';
import { getTRPCClient } from '@/lib/trpc';
import { getTrpcError, TestId, type TJoinedBot } from '@sandshark/shared';
import { Badge, IconButton } from '@sandshark/ui';
import { Bot, KeyRound, Pencil, Server, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { HostedBotPanel } from './hosted';

type TBotRowProps = {
  bot: TJoinedBot;
  refetch: () => Promise<void>;
  canHost: boolean;
};

const BotRow = memo(({ bot, refetch, canHost }: TBotRowProps) => {
  const { t } = useTranslation('settings');
  const roles = useRoles();
  const [hostingOpen, setHostingOpen] = useState(false);

  const onToggleHosting = useCallback(
    () => setHostingOpen((open) => !open),
    []
  );

  const roleNames = useMemo(
    () =>
      roles
        .filter((role) => bot.roleIds.includes(role.id))
        .map((role) => role.name),
    [roles, bot.roleIds]
  );

  const onRename = useCallback(async () => {
    const name = await requestTextInput({
      title: t('renameBotTitle'),
      message: t('renameBotMsg'),
      confirmLabel: t('renameBotConfirm')
    });

    if (!name) return;

    try {
      const trpc = getTRPCClient();

      await trpc.bots.rename.mutate({ botId: bot.id, name });
      await refetch();
    } catch (error) {
      toast.error(getTrpcError(error, t('failedRenameBot')));
    }
  }, [bot.id, refetch, t]);

  const onResetToken = useCallback(async () => {
    const choice = await requestConfirmation({
      title: t('resetBotTokenTitle'),
      message: t('resetBotTokenMsg', { name: bot.name }),
      confirmLabel: t('resetBotTokenConfirm'),
      variant: 'danger'
    });

    if (!choice) return;

    try {
      const trpc = getTRPCClient();
      const token = await trpc.bots.resetToken.mutate({ botId: bot.id });

      openDialog(Dialog.BOT_TOKEN, { botName: bot.name, token });
      await refetch();
    } catch (error) {
      toast.error(getTrpcError(error, t('failedResetBotToken')));
    }
  }, [bot.id, bot.name, refetch, t]);

  const onDelete = useCallback(async () => {
    const choice = await requestConfirmation({
      title: t('deleteBotTitle'),
      message: t('deleteBotMsg', { name: bot.name }),
      confirmLabel: t('deleteBotConfirm'),
      variant: 'danger'
    });

    if (!choice) return;

    try {
      const trpc = getTRPCClient();

      await trpc.bots.delete.mutate({ botId: bot.id });
      await refetch();
      toast.success(t('botDeleted'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedDeleteBot')));
    }
  }, [bot.id, bot.name, refetch, t]);

  return (
    <div className="space-y-2">
      <div
        className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
        data-testid={TestId.BOT_ROW}
      >
        <Bot className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{bot.name}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {roleNames.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </div>
        </div>
        {canHost && (
          <IconButton
            icon={Server}
            variant={hostingOpen ? 'secondary' : 'ghost'}
            size="sm"
            title={t('hostBot')}
            onClick={onToggleHosting}
            data-testid={TestId.BOT_HOSTING_OPEN}
          />
        )}
        <IconButton
          icon={Pencil}
          variant="ghost"
          size="sm"
          title={t('renameBot')}
          onClick={onRename}
        />
        <IconButton
          icon={KeyRound}
          variant="ghost"
          size="sm"
          title={t('resetBotToken')}
          onClick={onResetToken}
          data-testid={TestId.BOT_RESET_TOKEN}
        />
        <IconButton
          icon={Trash2}
          variant="ghost"
          size="sm"
          title={t('deleteBot')}
          onClick={onDelete}
          className="text-destructive"
        />
      </div>
      {canHost && hostingOpen && <HostedBotPanel botId={bot.id} />}
    </div>
  );
});

export { BotRow };

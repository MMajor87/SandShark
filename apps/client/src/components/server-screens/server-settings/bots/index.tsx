import { Dialog } from '@/components/dialogs/dialogs';
import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { openDialog, requestTextInput } from '@/features/dialogs/actions';
import { useAdminBots } from '@/features/server/admin/hooks';
import { getTRPCClient } from '@/lib/trpc';
import { getTrpcError, TestId } from '@sandshark/shared';
import { Button, LoadingCard } from '@sandshark/ui';
import { Plus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { BotRow } from './bot-row';

const Bots = memo(() => {
  const { t } = useTranslation('settings');
  const { bots, loading, refetch } = useAdminBots();

  const onCreate = useCallback(async () => {
    const name = await requestTextInput({
      title: t('createBotTitle'),
      message: t('createBotMsg'),
      confirmLabel: t('createBotBtn')
    });

    if (!name) return;

    try {
      const trpc = getTRPCClient();
      const { bot, token } = await trpc.bots.create.mutate({ name });

      openDialog(Dialog.BOT_TOKEN, { botName: bot.name, token });
      await refetch();
    } catch (error) {
      toast.error(getTrpcError(error, t('failedCreateBot')));
    }
  }, [refetch, t]);

  if (loading && bots.length === 0) {
    return <LoadingCard className="h-[300px]" />;
  }

  return (
    <SettingsSection
      title={t('botsTitle')}
      description={t('botsDesc')}
      action={
        <Button onClick={onCreate} data-testid={TestId.BOT_CREATE}>
          <Plus className="h-4 w-4" />
          {t('createBotBtn')}
        </Button>
      }
    >
      <div className="space-y-2">
        {bots.map((bot) => (
          <BotRow key={bot.id} bot={bot} refetch={refetch} />
        ))}
        {bots.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('noBots')}
          </p>
        )}
      </div>
    </SettingsSection>
  );
});

export { Bots };

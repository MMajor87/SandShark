import { useBotHostingEnabled } from '@/features/server/hooks';
import { getTRPCClient } from '@/lib/trpc';
import { getTrpcError, TestId } from '@sandshark/shared';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Group,
  Switch
} from '@sandshark/ui';
import { TriangleAlert } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// shown to those who can host bots only, since turning hosting on is what lets uploaded
// code run on the server
const HostingToggle = memo(() => {
  const { t } = useTranslation('settings');
  const enabled = useBotHostingEnabled();

  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        const trpc = getTRPCClient();

        await trpc.others.updateSettings.mutate({ enableBotHosting: checked });
      } catch (error) {
        toast.error(getTrpcError(error, t('failedUpdateHosting')));
      }
    },
    [t]
  );

  return (
    <div className="space-y-3">
      <Group label={t('hostingLabel')} description={t('hostingDesc')}>
        <Switch
          checked={enabled}
          onCheckedChange={onChange}
          data-testid={TestId.BOT_HOSTING_TOGGLE}
        />
      </Group>
      {enabled && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>{t('hostingWarningTitle')}</AlertTitle>
          <AlertDescription>{t('hostingWarning')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
});

export { HostingToggle };

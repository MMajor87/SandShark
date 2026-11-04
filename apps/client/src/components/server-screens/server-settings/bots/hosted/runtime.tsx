import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  HostedBotJsRuntime,
  type THostedBot
} from '@sandshark/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@sandshark/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type THostedRuntimeProps = {
  hosted: THostedBot;
  onChanged: () => Promise<void>;
};

const HostedRuntime = memo(({ hosted, onChanged }: THostedRuntimeProps) => {
  const { t } = useTranslation('settings');
  const { botId, jsRuntime } = hosted;
  const [busy, setBusy] = useState(false);

  const onValueChange = useCallback(
    async (value: HostedBotJsRuntime) => {
      setBusy(true);

      try {
        const trpc = getTRPCClient();

        await trpc.bots.setHostedJsRuntime.mutate({ botId, jsRuntime: value });
        await onChanged();
      } catch (error) {
        toast.error(getTrpcError(error, t('failedSetHostedRuntime')));
      } finally {
        setBusy(false);
      }
    },
    [botId, onChanged, t]
  );

  return (
    <div className="space-y-1">
      <Select value={jsRuntime} onValueChange={onValueChange} disabled={busy}>
        <SelectTrigger className="h-8 w-[180px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={HostedBotJsRuntime.BUN}>
            {t('hostedRuntimeBun')}
          </SelectItem>
          <SelectItem value={HostedBotJsRuntime.NODE}>
            {t('hostedRuntimeNode')}
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t('hostedRuntimeHint')}</p>
    </div>
  );
});

export { HostedRuntime };

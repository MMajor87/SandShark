import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  HostedBotStatus,
  type THostedBot
} from '@sandshark/shared';
import { Badge, Button } from '@sandshark/ui';
import { Play, RotateCw, Square } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { HostedUsage } from './usage';

const STATUS_VARIANTS = {
  [HostedBotStatus.STOPPED]: 'secondary',
  [HostedBotStatus.INSTALLING]: 'outline',
  [HostedBotStatus.STARTING]: 'outline',
  [HostedBotStatus.RUNNING]: 'default',
  [HostedBotStatus.CRASHED]: 'destructive'
} as const;

const ACTIVE_STATUSES = [
  HostedBotStatus.RUNNING,
  HostedBotStatus.STARTING,
  HostedBotStatus.INSTALLING
];

type THostedControlsProps = {
  hosted: THostedBot;
};

const HostedControls = memo(({ hosted }: THostedControlsProps) => {
  const { t } = useTranslation('settings');
  const [busy, setBusy] = useState(false);
  const { botId, status, restarts } = hosted;
  const active = ACTIVE_STATUSES.includes(status);

  const run = useCallback(
    async (action: 'startHosted' | 'stopHosted' | 'restartHosted') => {
      setBusy(true);

      try {
        const trpc = getTRPCClient();

        await trpc.bots[action].mutate({ botId });
      } catch (error) {
        toast.error(getTrpcError(error, t('failedHostedAction')));
      } finally {
        setBusy(false);
      }
    },
    [botId, t]
  );

  const onStart = useCallback(() => run('startHosted'), [run]);
  const onStop = useCallback(() => run('stopHosted'), [run]);
  const onRestart = useCallback(() => run('restartHosted'), [run]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={STATUS_VARIANTS[status]}>
        {t(`hostedStatus_${status}`)}
      </Badge>
      {status === HostedBotStatus.RUNNING && <HostedUsage botId={botId} />}
      {restarts > 0 && (
        <span className="text-xs text-muted-foreground">
          {t('hostedRestarts', { count: restarts })}
        </span>
      )}
      <div className="ml-auto flex gap-2">
        {active ? (
          <Button size="sm" variant="outline" onClick={onStop} disabled={busy}>
            <Square className="h-4 w-4" />
            {t('hostedStop')}
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} disabled={busy}>
            <Play className="h-4 w-4" />
            {t('hostedStart')}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onRestart} disabled={busy}>
          <RotateCw className="h-4 w-4" />
          {t('hostedRestart')}
        </Button>
      </div>
    </div>
  );
});

export { HostedControls };

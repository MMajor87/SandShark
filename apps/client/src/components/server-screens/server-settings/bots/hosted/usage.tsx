import { getTRPCClient } from '@/lib/trpc';
import type { THostedBotUsage } from '@sandshark/shared';
import { filesize } from 'filesize';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const POLL_INTERVAL_MS = 5000;

type THostedUsageProps = {
  botId: number;
};

// rendered only while the bot runs. the server reads usage from /proc, so on platforms
// without it there is nothing to show and nothing is shown
const HostedUsage = memo(({ botId }: THostedUsageProps) => {
  const { t } = useTranslation('settings');
  const [usage, setUsage] = useState<THostedBotUsage | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchUsage = async () => {
      try {
        const trpc = getTRPCClient();
        const result = await trpc.bots.getHostedUsage.query({ botId });

        if (!cancelled) setUsage(result);
      } catch (error) {
        console.error('Failed to load the hosted bot usage:', error);
      }
    };

    fetchUsage();

    const interval = setInterval(fetchUsage, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [botId]);

  if (!usage) return null;

  const { memoryBytes, cpuPercent } = usage;

  return (
    <span className="text-xs text-muted-foreground">
      {t('hostedMemory', { value: filesize(memoryBytes) })}
      {cpuPercent !== null &&
        ` · ${t('hostedCpu', { value: cpuPercent.toFixed(1) })}`}
    </span>
  );
});

export { HostedUsage };

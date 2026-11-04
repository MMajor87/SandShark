import { TestId } from '@sandshark/shared';
import { LoadingCard } from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { HostedControls } from './controls';
import { HostedEnv } from './env';
import { useHostedBot } from './hooks/use-hosted-bot';
import { HostedLogs } from './logs';
import { HostedReport } from './report';
import { HostedRuntime } from './runtime';
import { HostedSource } from './source';

type TPanelSectionProps = {
  title: string;
  children: React.ReactNode;
};

const PanelSection = memo(({ title, children }: TPanelSectionProps) => (
  <section className="space-y-2">
    <h4 className="text-sm font-semibold">{title}</h4>
    {children}
  </section>
));

type THostedBotPanelProps = {
  botId: number;
};

const HostedBotPanel = memo(({ botId }: THostedBotPanelProps) => {
  const { t } = useTranslation('settings');
  const { hosted, refetch } = useHostedBot(botId);

  if (!hosted) {
    return <LoadingCard className="h-[200px]" />;
  }

  return (
    <div
      className="space-y-5 rounded-md border border-border p-4"
      data-testid={TestId.HOSTED_BOT_PANEL}
    >
      <HostedControls hosted={hosted} />
      <PanelSection title={t('hostedSourceTitle')}>
        <HostedSource hosted={hosted} />
      </PanelSection>
      <PanelSection title={t('hostedRuntimeTitle')}>
        <HostedRuntime hosted={hosted} onChanged={refetch} />
      </PanelSection>
      <PanelSection title={t('hostedEnvTitle')}>
        <HostedEnv hosted={hosted} onChanged={refetch} />
      </PanelSection>
      <PanelSection title={t('hostedReportTitle')}>
        <HostedReport unsupported={hosted.unsupported} />
      </PanelSection>
      <PanelSection title={t('hostedLogsTitle')}>
        <HostedLogs botId={botId} />
      </PanelSection>
    </div>
  );
});

export { HostedBotPanel };

import type { THostedBotUnsupportedCall } from '@sandshark/shared';
import { Badge } from '@sandshark/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TReportLineProps = {
  call: THostedBotUnsupportedCall;
};

const ReportLine = memo(({ call }: TReportLineProps) => {
  const { t } = useTranslation('settings');

  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="flex-1 break-all font-mono">{call.call}</span>
      {call.stubbed && (
        <Badge variant="outline">{t('hostedReportStubbed')}</Badge>
      )}
      <span className="shrink-0 text-muted-foreground">×{call.count}</span>
    </li>
  );
});

type THostedReportProps = {
  unsupported: THostedBotUnsupportedCall[];
};

// what a bot asked for that this server does not do yet, the first thing to look at when a
// bot that works on discord misbehaves here
const HostedReport = memo(({ unsupported }: THostedReportProps) => {
  const { t } = useTranslation('settings');

  if (unsupported.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('hostedReportEmpty')}</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('hostedReportDesc')}</p>
      <ul className="space-y-1">
        {unsupported.map((call) => (
          <ReportLine key={call.call} call={call} />
        ))}
      </ul>
    </div>
  );
});

export { HostedReport };

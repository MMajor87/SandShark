import type { THostedBotLogEntry } from '@sandshark/shared';
import { cn } from '@sandshark/ui';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHostedBotLogs } from './hooks/use-hosted-bot-logs';

const STREAM_COLORS = {
  stdout: '',
  stderr: 'text-destructive',
  system: 'text-primary'
} as const;

type TLogLineProps = {
  entry: THostedBotLogEntry;
};

const LogLine = memo(({ entry }: TLogLineProps) => (
  <div className="flex gap-2 px-2 py-0.5 font-mono text-xs">
    <span className="shrink-0 text-muted-foreground">
      {new Date(entry.timestamp).toLocaleTimeString()}
    </span>
    <span className={cn('flex-1 break-all', STREAM_COLORS[entry.stream])}>
      {entry.message}
    </span>
  </div>
));

type THostedLogsProps = {
  botId: number;
};

const HostedLogs = memo(({ botId }: THostedLogsProps) => {
  const { t } = useTranslation('settings');
  const logs = useHostedBotLogs(botId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);

  // the view follows new lines until the admin scrolls up to read older ones
  useEffect(() => {
    const element = scrollRef.current;

    if (follow && element) element.scrollTop = element.scrollHeight;
  }, [logs, follow]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;

    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;

    setFollow(scrollHeight - scrollTop - clientHeight < 10);
  }, []);

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('hostedLogsEmpty')}</p>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="max-h-80 overflow-y-auto rounded-md border border-border bg-muted/30 py-1"
    >
      {logs.map((entry, index) => (
        <LogLine key={`${entry.timestamp}-${index}`} entry={entry} />
      ))}
    </div>
  );
});

export { HostedLogs };

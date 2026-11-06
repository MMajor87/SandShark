import { useVoiceStats } from '@/components/voice-provider/stats-context';
import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { getPingQuality, getVoicePing, type TPingQuality } from './helpers';

const QUALITY_CLASSES: Record<TPingQuality, string> = {
  good: 'text-green-600',
  fair: 'text-yellow-500',
  poor: 'text-red-500'
};

// the latency beside "voice connected". reading the stats keeps them polled, once a second,
// for as long as the user is in a voice channel
const VoicePing = memo(() => {
  const { t } = useTranslation('sidebar');
  const { producer, consumer } = useVoiceStats();
  const ping = getVoicePing(producer?.rtt, consumer?.rtt);

  if (ping === undefined) return null;

  return (
    <span
      className={cn(
        'ml-auto text-xs font-medium tabular-nums',
        QUALITY_CLASSES[getPingQuality(ping)]
      )}
      title={t('voicePingTitle')}
    >
      {t('voicePing', { ms: ping })}
    </span>
  );
});

export { VoicePing };

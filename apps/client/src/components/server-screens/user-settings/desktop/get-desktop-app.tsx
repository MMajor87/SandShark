import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { Button } from '@sandshark/ui';
import { Check, Download } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { RELEASES_URL } from './helpers';

const FEATURES = [
  'getDesktopFeaturePushToTalk',
  'getDesktopFeatureTray',
  'getDesktopFeatureNotifications',
  'getDesktopFeatureAudio'
] as const;

// the browser's view of the desktop entry. SandShark is built for its desktop app, so the
// browser says what the app adds and where to get it, instead of showing switches that do
// nothing here
const GetDesktopApp = memo(() => {
  const { t } = useTranslation('settings');

  return (
    <SettingsSection
      title={t('getDesktopTitle')}
      description={t('getDesktopDesc')}
    >
      <ul className="space-y-2 text-sm">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-highlight" />
            <span>{t(feature)}</span>
          </li>
        ))}
      </ul>

      <Button asChild>
        <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
          <Download className="size-4" />
          {t('getDesktopBtn')}
        </a>
      </Button>
    </SettingsSection>
  );
});

export { GetDesktopApp };

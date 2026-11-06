import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { Alert, AlertDescription, Button, Group, Switch } from '@sandshark/ui';
import { FolderOpen, Info } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { THardwareAccelerationSettings } from './types';

// only rendered in the desktop app, where window.sandSharkDesktop is set
const AdvancedSettings = memo(() => {
  const { t } = useTranslation('settings');
  const [acceleration, setAcceleration] = useState<
    THardwareAccelerationSettings | undefined
  >();

  useEffect(() => {
    const desktop = window.sandSharkDesktop;

    if (!desktop) return;

    let isCurrent = true;

    desktop
      .getHardwareAcceleration()
      .then((settings) => {
        if (isCurrent) setAcceleration(settings);
      })
      .catch(() => {
        // the switch stays disabled when the desktop app cannot answer
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleAccelerationChange = useCallback(
    async (enabled: boolean) => {
      const desktop = window.sandSharkDesktop;

      if (!desktop) return;

      const previous = acceleration;

      setAcceleration((current) =>
        current ? { ...current, enabled, restartRequired: true } : current
      );

      try {
        setAcceleration(await desktop.setHardwareAcceleration(enabled));
      } catch {
        setAcceleration(previous);
        toast.error(t('failedHardwareAcceleration'));
      }
    },
    [acceleration, t]
  );

  const handleOpenLogFolder = useCallback(async () => {
    try {
      const desktop = window.sandSharkDesktop;

      if (desktop) await desktop.openLogFolder();
    } catch {
      toast.error(t('failedOpenLogFolder'));
    }
  }, [t]);

  return (
    <SettingsSection title={t('advancedTitle')} description={t('advancedDesc')}>
      <Group
        label={t('hardwareAccelerationLabel')}
        description={t('hardwareAccelerationDesc')}
      >
        <Switch
          checked={acceleration?.enabled ?? true}
          disabled={!acceleration}
          onCheckedChange={handleAccelerationChange}
        />
      </Group>

      {acceleration?.restartRequired && (
        <Alert>
          <Info />
          <AlertDescription>
            {t('hardwareAccelerationRestart')}
          </AlertDescription>
        </Alert>
      )}

      <Group label={t('logFolderLabel')} description={t('logFolderDesc')}>
        <Button variant="outline" size="sm" onClick={handleOpenLogFolder}>
          <FolderOpen className="size-4" />
          {t('openLogFolderBtn')}
        </Button>
      </Group>
    </SettingsSection>
  );
});

export { AdvancedSettings };

import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { getDesktopVersion } from '@/platform/environment';
import { Button, Group, Switch } from '@sandshark/ui';
import { Download, ExternalLink, Power, RefreshCw } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getUpdateStatusText, RELEASES_URL } from './helpers';
import type { TDesktopUpdateSettings, TDesktopUpdateStatus } from './types';

const BUSY_STATES: TDesktopUpdateStatus['state'][] = [
  'checking',
  'downloading'
];

// only rendered in the desktop app, where window.sandSharkDesktop is set
const UpdateSettings = memo(() => {
  const { t } = useTranslation('settings');
  const [version, setVersion] = useState(getDesktopVersion());
  const [settings, setSettings] = useState<
    TDesktopUpdateSettings | undefined
  >();
  const [status, setStatus] = useState<TDesktopUpdateStatus>({ state: 'idle' });

  useEffect(() => {
    const desktop = window.sandSharkDesktop;

    if (!desktop) return;

    let isCurrent = true;

    const load = async () => {
      const [nextVersion, nextSettings, nextStatus] = await Promise.all([
        desktop.getVersion(),
        desktop.getUpdateSettings(),
        desktop.getUpdateStatus()
      ]);

      if (!isCurrent) return;

      setVersion(nextVersion);
      setSettings(nextSettings);
      setStatus(nextStatus);
    };

    load().catch(() => {
      // the switches stay disabled when the desktop app cannot answer
    });

    const unsubscribe = desktop.onUpdateStatus((nextStatus) => {
      if (isCurrent) setStatus(nextStatus);
    });

    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, []);

  const saveSetting = useCallback(
    async (change: Partial<TDesktopUpdateSettings>) => {
      const desktop = window.sandSharkDesktop;

      if (!desktop || !settings) return;

      const previous = settings;
      const next = { ...settings, ...change };

      setSettings(next);

      try {
        setSettings(await desktop.setUpdateSettings(next));
      } catch {
        setSettings(previous);
        toast.error(t('failedSaveUpdateSettings'));
      }
    },
    [settings, t]
  );

  const handleAutoCheckChange = useCallback(
    (automaticallyCheck: boolean) => {
      saveSetting({ automaticallyCheck });
    },
    [saveSetting]
  );

  const handleAutoDownloadChange = useCallback(
    (automaticallyDownload: boolean) => {
      saveSetting({ automaticallyDownload });
    },
    [saveSetting]
  );

  const handleCheck = useCallback(async () => {
    try {
      const desktop = window.sandSharkDesktop;

      if (desktop) setStatus(await desktop.checkForUpdates());
    } catch {
      toast.error(t('failedCheckUpdates'));
    }
  }, [t]);

  const handleDownload = useCallback(async () => {
    try {
      const desktop = window.sandSharkDesktop;

      if (desktop) setStatus(await desktop.downloadUpdate());
    } catch {
      toast.error(t('failedUpdateAction'));
    }
  }, [t]);

  const handleInstall = useCallback(async () => {
    try {
      const desktop = window.sandSharkDesktop;

      if (desktop) await desktop.installUpdate();
    } catch {
      toast.error(t('failedUpdateAction'));
    }
  }, [t]);

  const handleOpenReleases = useCallback(async () => {
    try {
      const desktop = window.sandSharkDesktop;

      if (desktop) await desktop.openExternal(RELEASES_URL);
    } catch {
      toast.error(t('failedOpenReleases'));
    }
  }, [t]);

  const isBusy = BUSY_STATES.includes(status.state);

  let primaryAction = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCheck}
      disabled={isBusy || status.state === 'unsupported'}
    >
      <RefreshCw className={isBusy ? 'size-4 animate-spin' : 'size-4'} />
      {t('checkForUpdatesBtn')}
    </Button>
  );

  if (status.state === 'available') {
    primaryAction = (
      <Button size="sm" onClick={handleDownload}>
        <Download className="size-4" />
        {t('downloadUpdateBtn')}
      </Button>
    );
  } else if (status.state === 'downloaded') {
    primaryAction = (
      <Button size="sm" onClick={handleInstall}>
        <Power className="size-4" />
        {t('installUpdateBtn')}
      </Button>
    );
  }

  return (
    <SettingsSection
      title={t('desktopUpdatesTitle')}
      description={t('desktopVersion', {
        version: version ?? t('desktopVersionUnknown')
      })}
    >
      <Group
        label={t('updateStatusLabel')}
        description={getUpdateStatusText(status, t)}
      >
        <div className="flex flex-wrap items-center gap-2">
          {primaryAction}
          <Button variant="ghost" size="sm" onClick={handleOpenReleases}>
            <ExternalLink className="size-4" />
            {t('openReleasesBtn')}
          </Button>
        </div>
      </Group>

      <Group
        label={t('autoCheckUpdatesLabel')}
        description={t('autoCheckUpdatesDesc')}
      >
        <Switch
          checked={settings?.automaticallyCheck ?? true}
          disabled={!settings}
          onCheckedChange={handleAutoCheckChange}
        />
      </Group>

      <Group
        label={t('autoDownloadUpdatesLabel')}
        description={t('autoDownloadUpdatesDesc')}
      >
        <Switch
          checked={settings?.automaticallyDownload ?? false}
          disabled={!settings}
          onCheckedChange={handleAutoDownloadChange}
        />
      </Group>
    </SettingsSection>
  );
});

export { UpdateSettings };

import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import {
  Group,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@sandshark/ui';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TStartAtLoginSettings, TWindowBehavior } from './types';

const CLOSE_TO_TRAY = 'tray';
const CLOSE_TO_EXIT = 'exit';

// only rendered in the desktop app, where window.sandSharkDesktop is set
const WindowSettings = memo(() => {
  const { t } = useTranslation('settings');
  const [behavior, setBehavior] = useState<TWindowBehavior | undefined>();
  const [startAtLogin, setStartAtLogin] = useState<
    TStartAtLoginSettings | undefined
  >();

  useEffect(() => {
    const desktop = window.sandSharkDesktop;

    if (!desktop) return;

    let isCurrent = true;

    const load = async () => {
      const [nextBehavior, nextStartAtLogin] = await Promise.all([
        desktop.getWindowBehavior(),
        desktop.getStartAtLogin()
      ]);

      if (!isCurrent) return;

      setBehavior(nextBehavior);
      setStartAtLogin(nextStartAtLogin);
    };

    load().catch(() => {
      // the section stays hidden when the desktop app cannot answer
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const updateBehavior = useCallback(
    async (change: Partial<TWindowBehavior>) => {
      const desktop = window.sandSharkDesktop;

      if (!desktop || !behavior) return;

      const previous = behavior;
      const next = { ...behavior, ...change };

      setBehavior(next);

      try {
        await desktop.setWindowBehavior(next);
      } catch {
        setBehavior(previous);
        toast.error(t('failedSaveWindowBehavior'));
      }
    },
    [behavior, t]
  );

  const handleCloseChange = useCallback(
    (value: string) => {
      updateBehavior({ closeToTray: value === CLOSE_TO_TRAY });
    },
    [updateBehavior]
  );

  const handleMinimizeChange = useCallback(
    (minimizeToTray: boolean) => {
      updateBehavior({ minimizeToTray });
    },
    [updateBehavior]
  );

  const handleStartMinimizedChange = useCallback(
    (startMinimized: boolean) => {
      updateBehavior({ startMinimized });
    },
    [updateBehavior]
  );

  const handleStartAtLoginChange = useCallback(
    async (enabled: boolean) => {
      const desktop = window.sandSharkDesktop;

      if (!desktop) return;

      const previous = startAtLogin;

      setStartAtLogin((current) =>
        current ? { ...current, enabled } : current
      );

      try {
        setStartAtLogin(await desktop.setStartAtLogin(enabled));
      } catch {
        setStartAtLogin(previous);
        toast.error(t('failedStartAtLogin'));
      }
    },
    [startAtLogin, t]
  );

  if (!behavior) return null;

  return (
    <SettingsSection title={t('windowTitle')} description={t('windowDesc')}>
      {startAtLogin?.supported && (
        <Group label={t('startAtLoginLabel')}>
          <Switch
            checked={startAtLogin.enabled}
            onCheckedChange={handleStartAtLoginChange}
          />
        </Group>
      )}

      <Group
        label={t('startMinimizedLabel')}
        description={t('startMinimizedDesc')}
      >
        <Switch
          checked={behavior.startMinimized}
          onCheckedChange={handleStartMinimizedChange}
        />
      </Group>

      <Group label={t('closeBehaviorLabel')}>
        <Select
          value={behavior.closeToTray ? CLOSE_TO_TRAY : CLOSE_TO_EXIT}
          onValueChange={handleCloseChange}
        >
          <SelectTrigger className="max-w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CLOSE_TO_TRAY}>
              {t('closeBehaviorTray')}
            </SelectItem>
            <SelectItem value={CLOSE_TO_EXIT}>
              {t('closeBehaviorExit')}
            </SelectItem>
          </SelectContent>
        </Select>
      </Group>

      <Group
        label={t('minimizeToTrayLabel')}
        description={t('minimizeToTrayDesc')}
      >
        <Switch
          checked={behavior.minimizeToTray}
          onCheckedChange={handleMinimizeChange}
        />
      </Group>
    </SettingsSection>
  );
});

export { WindowSettings };

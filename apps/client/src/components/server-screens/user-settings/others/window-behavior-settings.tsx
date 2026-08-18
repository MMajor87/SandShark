import { isDesktopClient } from '@/platform/environment';
import {
  Group,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@sharkord/ui';
import { memo, useCallback, useEffect, useState } from 'react';

type TWindowBehavior = {
  closeToTray: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
};

type TStartAtLoginSettings = {
  enabled: boolean;
  supported: boolean;
};

const WindowBehaviorSettings = memo(() => {
  const [behavior, setBehavior] = useState<TWindowBehavior | undefined>();
  const [startAtLogin, setStartAtLogin] = useState<
    TStartAtLoginSettings | undefined
  >();
  const isAvailable = isDesktopClient() && !!window.sandSharkDesktop;

  useEffect(() => {
    if (!isAvailable || !window.sandSharkDesktop) return;

    let isCurrent = true;

    void window.sandSharkDesktop.getWindowBehavior().then((nextBehavior) => {
      if (isCurrent) setBehavior(nextBehavior);
    });
    void window.sandSharkDesktop.getStartAtLogin().then((nextSettings) => {
      if (isCurrent) setStartAtLogin(nextSettings);
    });

    return () => {
      isCurrent = false;
    };
  }, [isAvailable]);

  const updateBehavior = useCallback((nextBehavior: TWindowBehavior) => {
    setBehavior(nextBehavior);

    if (window.sandSharkDesktop) {
      void window.sandSharkDesktop.setWindowBehavior(nextBehavior);
    }
  }, []);

  const updateStartAtLogin = useCallback(
    async (enabled: boolean) => {
      if (!window.sandSharkDesktop) return;

      const previousSettings = startAtLogin;
      setStartAtLogin((current) =>
        current ? { ...current, enabled } : current
      );

      try {
        setStartAtLogin(await window.sandSharkDesktop.setStartAtLogin(enabled));
      } catch {
        setStartAtLogin(previousSettings);
      }
    },
    [startAtLogin]
  );

  if (!isAvailable || !behavior) return null;

  return (
    <div className="space-y-4">
      <Group label="When closing SandShark">
        <Select
          value={behavior.closeToTray ? 'tray' : 'exit'}
          onValueChange={(value) =>
            updateBehavior({ ...behavior, closeToTray: value === 'tray' })
          }
        >
          <SelectTrigger className="max-w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="exit">Exit application</SelectItem>
            <SelectItem value="tray">Minimize to system tray</SelectItem>
          </SelectContent>
        </Select>
      </Group>

      <Group label="Minimize to system tray">
        <Switch
          checked={behavior.minimizeToTray}
          onCheckedChange={(minimizeToTray) =>
            updateBehavior({ ...behavior, minimizeToTray })
          }
        />
      </Group>

      <Group label="Start minimized">
        <Switch
          checked={behavior.startMinimized}
          onCheckedChange={(startMinimized) =>
            updateBehavior({ ...behavior, startMinimized })
          }
        />
      </Group>

      {startAtLogin?.supported && (
        <Group label="Start SandShark with Windows">
          <Switch
            checked={startAtLogin.enabled}
            onCheckedChange={(enabled) => void updateStartAtLogin(enabled)}
          />
        </Group>
      )}
    </div>
  );
});

WindowBehaviorSettings.displayName = 'WindowBehaviorSettings';

export { WindowBehaviorSettings };

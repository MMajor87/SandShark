import { setBrowserNotifications } from '@/features/app/actions';
import { useBrowserNotifications } from '@/features/app/hooks';
import { getDesktopVersion } from '@/platform/environment';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group,
  Separator,
  Switch
} from '@sharkord/ui';
import {
  Download,
  ExternalLink,
  FolderOpen,
  Info,
  Power,
  RefreshCw
} from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PushToTalkSettings } from '../devices/push-to-talk-settings';
import { WindowBehaviorSettings } from '../others/window-behavior-settings';

type THardwareAccelerationSettings = {
  enabled: boolean;
  restartRequired: boolean;
};

type TDesktopUpdateSettings = {
  automaticallyCheck: boolean;
  automaticallyDownload: boolean;
};

type TDesktopUpdateStatus = {
  state: string;
  version?: string;
  percent?: number;
  message?: string;
};

const Desktop = memo(() => {
  const nativeNotificationsEnabled = useBrowserNotifications();
  const [hardwareAcceleration, setHardwareAcceleration] = useState<
    THardwareAccelerationSettings | undefined
  >();
  const [updateSettings, setUpdateSettings] = useState<
    TDesktopUpdateSettings | undefined
  >();
  const [updateStatus, setUpdateStatus] = useState<TDesktopUpdateStatus>({
    state: 'idle'
  });
  const [version, setVersion] = useState(getDesktopVersion());

  useEffect(() => {
    if (!window.sandSharkDesktop) return;

    let active = true;
    void window.sandSharkDesktop.getHardwareAcceleration().then((settings) => {
      if (active) setHardwareAcceleration(settings);
    });
    void window.sandSharkDesktop.getVersion().then((nextVersion) => {
      if (active) setVersion(nextVersion);
    });
    void window.sandSharkDesktop.getUpdateSettings().then((settings) => {
      if (active) setUpdateSettings(settings);
    });
    void window.sandSharkDesktop.getUpdateStatus().then((status) => {
      if (active) setUpdateStatus(status);
    });

    const unsubscribe = window.sandSharkDesktop.onUpdateStatus((status) => {
      if (active) setUpdateStatus(status);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const setHardwareAccelerationEnabled = useCallback(
    async (enabled: boolean) => {
      if (!window.sandSharkDesktop) return;

      const previous = hardwareAcceleration;
      setHardwareAcceleration((current) =>
        current ? { ...current, enabled, restartRequired: true } : current
      );

      try {
        setHardwareAcceleration(
          await window.sandSharkDesktop.setHardwareAcceleration(enabled)
        );
      } catch {
        setHardwareAcceleration(previous);
        toast.error('Could not update hardware acceleration.');
      }
    },
    [hardwareAcceleration]
  );

  const setUpdatePreference = useCallback(
    async (key: keyof TDesktopUpdateSettings, value: boolean) => {
      if (!window.sandSharkDesktop || !updateSettings) return;

      const previous = updateSettings;
      const next = { ...previous, [key]: value };
      setUpdateSettings(next);

      try {
        setUpdateSettings(
          await window.sandSharkDesktop.setUpdateSettings(next)
        );
      } catch {
        setUpdateSettings(previous);
        toast.error('Could not save update preferences.');
      }
    },
    [updateSettings]
  );

  const handleManualUpdateCheck = useCallback(async () => {
    if (!window.sandSharkDesktop) return;

    try {
      setUpdateStatus(await window.sandSharkDesktop.checkForUpdates());
    } catch {
      toast.error('Could not check for updates.');
    }
  }, []);

  const handleAvailableUpdateAction = useCallback(async () => {
    if (!window.sandSharkDesktop) return;

    try {
      if (updateStatus.state === 'available') {
        setUpdateStatus(await window.sandSharkDesktop.downloadUpdate());
      } else if (updateStatus.state === 'downloaded') {
        await window.sandSharkDesktop.installUpdate();
      }
    } catch {
      toast.error('Could not complete the update action.');
    }
  }, [updateStatus.state]);

  const openLatestRelease = useCallback(async () => {
    if (!window.sandSharkDesktop) return;

    try {
      await window.sandSharkDesktop.openExternal(
        'https://github.com/MMajor87/SandShark/releases/latest'
      );
    } catch {
      toast.error('Could not open the SandShark release page.');
    }
  }, []);

  const openLogFolder = useCallback(async () => {
    if (!window.sandSharkDesktop) return;

    try {
      await window.sandSharkDesktop.openLogFolder();
    } catch {
      toast.error('Could not open the SandShark log folder.');
    }
  }, []);

  const updateDescription =
    updateStatus.state === 'available'
      ? `Version ${updateStatus.version ?? 'unknown'} is ready to download.`
      : updateStatus.state === 'downloading'
        ? `Downloading update${updateStatus.percent !== undefined ? ` (${updateStatus.percent}%)` : ''}.`
        : updateStatus.state === 'downloaded'
          ? `Version ${updateStatus.version ?? 'unknown'} is ready to install now.`
          : updateStatus.state === 'not-available'
            ? 'SandShark is up to date.'
            : updateStatus.state === 'error'
              ? (updateStatus.message ?? 'The update check failed safely.')
              : updateStatus.state === 'unsupported'
                ? (updateStatus.message ??
                  'Updates are unavailable in this build.')
                : 'Check GitHub releases for a newer version of SandShark.';

  const isUpdateActionBusy =
    updateStatus.state === 'checking' || updateStatus.state === 'downloading';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desktop</CardTitle>
        <CardDescription>
          SandShark is a desktop client for compatible Sharkord servers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <WindowBehaviorSettings />

        <Separator />

        <Group
          label="Enable native notifications"
          description="Show SandShark notifications through Windows."
        >
          <Switch
            checked={nativeNotificationsEnabled}
            onCheckedChange={(enabled) => void setBrowserNotifications(enabled)}
          />
        </Group>

        <Separator />

        <PushToTalkSettings />

        <Separator />

        <Group
          label="Hardware acceleration"
          description="Use your GPU to render SandShark. Restart required after changing this setting."
        >
          <Switch
            checked={hardwareAcceleration?.enabled ?? true}
            disabled={!hardwareAcceleration}
            onCheckedChange={(enabled) =>
              void setHardwareAccelerationEnabled(enabled)
            }
          />
        </Group>

        {hardwareAcceleration?.restartRequired && (
          <Alert>
            <Info />
            <AlertDescription>
              Restart SandShark for the hardware acceleration change to take
              effect.
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <Group
          label="Open log folder"
          description="Open SandShark desktop diagnostics in Windows Explorer."
        >
          <Button
            variant="outline"
            size="icon"
            title="Open log folder"
            aria-label="Open log folder"
            onClick={() => void openLogFolder()}
          >
            <FolderOpen className="size-4" />
          </Button>
        </Group>

        <Separator />

        <Group label="Update status" description={updateDescription}>
          {(updateStatus.state === 'available' ||
            updateStatus.state === 'downloaded') && (
            <Button
              variant="outline"
              size="icon"
              title={
                updateStatus.state === 'available'
                  ? 'Download update'
                  : 'Install update now'
              }
              aria-label={
                updateStatus.state === 'available'
                  ? 'Download update'
                  : 'Install update now'
              }
              onClick={() => void handleAvailableUpdateAction()}
            >
              {updateStatus.state === 'available' ? (
                <Download className="size-4" />
              ) : (
                <Power className="size-4" />
              )}
            </Button>
          )}
          {isUpdateActionBusy && (
            <RefreshCw className="size-4 animate-spin text-muted-foreground" />
          )}
        </Group>

        <Group
          label="Automatically check for updates"
          description="Check for new SandShark releases after the app starts."
        >
          <Switch
            checked={updateSettings?.automaticallyCheck ?? true}
            disabled={!updateSettings}
            onCheckedChange={(enabled) =>
              void setUpdatePreference('automaticallyCheck', enabled)
            }
          />
        </Group>

        <Group
          label="Automatically download updates"
          description="Download available updates in the background and install them after restart."
        >
          <Switch
            checked={updateSettings?.automaticallyDownload ?? false}
            disabled={!updateSettings}
            onCheckedChange={(enabled) =>
              void setUpdatePreference('automaticallyDownload', enabled)
            }
          />
        </Group>

        <Group
          label="About SandShark"
          description="A Sharkord-compatible desktop client."
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Version {version ?? 'Unknown'}
            </span>
            <Button
              variant="outline"
              size="icon"
              title="Check for updates"
              aria-label="Check for updates"
              disabled={
                isUpdateActionBusy || updateStatus.state === 'unsupported'
              }
              onClick={() => void handleManualUpdateCheck()}
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Open latest SandShark release"
              aria-label="Open latest SandShark release"
              onClick={() => void openLatestRelease()}
            >
              <ExternalLink className="size-4" />
            </Button>
          </div>
        </Group>
      </CardContent>
    </Card>
  );
});

Desktop.displayName = 'Desktop';

export { Desktop };

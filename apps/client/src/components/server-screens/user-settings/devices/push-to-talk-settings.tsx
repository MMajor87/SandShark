import {
  getPushToTalkKey,
  getPushToTalkMouseButton,
  getPushToTalkSettings,
  savePushToTalkSettings,
  type TPushToTalkSettings
} from '@/helpers/push-to-talk';
import {
  Alert,
  AlertDescription,
  Button,
  Group,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch
} from '@sandshark/ui';
import { Info, Keyboard, Mouse } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type TCapture = 'key' | 'mouse' | null;

// the desktop app's global push to talk and push to mute, held from anywhere in windows. only
// rendered in the desktop app; the browser has its own mic mode, driven by hotkeys
const PushToTalkSettings = memo(() => {
  const { t } = useTranslation('settings');
  const [settings, setSettings] = useState<TPushToTalkSettings>(
    getPushToTalkSettings
  );
  const [capture, setCapture] = useState<TCapture>(null);
  const [registrationError, setRegistrationError] = useState<
    string | undefined
  >(undefined);

  const applySettings = useCallback(
    async (nextSettings: TPushToTalkSettings) => {
      setSettings(nextSettings);
      savePushToTalkSettings(nextSettings);

      const desktop = window.sandSharkDesktop;

      if (!desktop) return;

      setRegistrationError(undefined);

      try {
        if (!nextSettings.enabled) {
          await desktop.clearPushToTalk();
          return;
        }

        const result = await desktop.setPushToTalk({
          input: nextSettings.input,
          modifiers: nextSettings.input.modifiers
        });

        if (!result.registered) {
          setRegistrationError(result.error ?? t('pttRegistrationFailed'));
        }
      } catch {
        setRegistrationError(t('pttRegistrationFailed'));
      }
    },
    [t]
  );

  useEffect(() => {
    if (!capture) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (capture !== 'key') return;

      const input = getPushToTalkKey(event);

      if (!input) return;

      event.preventDefault();
      setCapture(null);
      applySettings({ ...settings, input });
    };

    const onMouseDown = (event: MouseEvent) => {
      if (capture !== 'mouse') return;

      const input = getPushToTalkMouseButton(event);

      if (!input) return;

      event.preventDefault();
      setCapture(null);
      applySettings({ ...settings, input });
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [applySettings, capture, settings]);

  const handleEnabledChange = useCallback(
    (enabled: boolean) => {
      applySettings({ ...settings, enabled });
    },
    [applySettings, settings]
  );

  const handleModeChange = useCallback(
    (mode: string) => {
      applySettings({ ...settings, mode: mode === 'mute' ? 'mute' : 'talk' });
    },
    [applySettings, settings]
  );

  const handleCaptureKey = useCallback(() => {
    setCapture('key');
  }, []);

  const handleCaptureMouse = useCallback(() => {
    setCapture('mouse');
  }, []);

  const handleActivationDelayChange = useCallback(
    ([activationDelayMs]: number[]) => {
      if (activationDelayMs === undefined) return;

      applySettings({ ...settings, activationDelayMs });
    },
    [applySettings, settings]
  );

  const handleReleaseDelayChange = useCallback(
    ([releaseDelayMs]: number[]) => {
      if (releaseDelayMs === undefined) return;

      applySettings({ ...settings, releaseDelayMs });
    },
    [applySettings, settings]
  );

  return (
    <Group label={t('pttLabel')} description={t('pttDesc')}>
      <div className="space-y-3">
        <Switch
          checked={settings.enabled}
          onCheckedChange={handleEnabledChange}
        />

        <Select value={settings.mode} onValueChange={handleModeChange}>
          <SelectTrigger className="max-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="talk">{t('pttModeTalk')}</SelectItem>
            <SelectItem value="mute">{t('pttModeMute')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handleCaptureKey}>
            <Keyboard className="size-4" />
            {capture === 'key' ? t('pttKeyCapturing') : settings.input.keyLabel}
          </Button>
          <Button variant="secondary" onClick={handleCaptureMouse}>
            <Mouse className="size-4" />
            {capture === 'mouse' ? t('pttMouseCapturing') : t('pttMouseBtn')}
          </Button>
        </div>

        <Group
          label={t('pttActivationDelay', { ms: settings.activationDelayMs })}
        >
          <Slider
            min={0}
            max={1000}
            step={25}
            value={[settings.activationDelayMs]}
            onValueChange={handleActivationDelayChange}
          />
        </Group>

        <Group label={t('pttReleaseDelay', { ms: settings.releaseDelayMs })}>
          <Slider
            min={0}
            max={1000}
            step={25}
            value={[settings.releaseDelayMs]}
            onValueChange={handleReleaseDelayChange}
          />
        </Group>

        {registrationError && (
          <Alert variant="destructive">
            <Info />
            <AlertDescription>{registrationError}</AlertDescription>
          </Alert>
        )}
      </div>
    </Group>
  );
});

PushToTalkSettings.displayName = 'PushToTalkSettings';

export { PushToTalkSettings };

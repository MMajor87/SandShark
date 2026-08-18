import {
  getPushToTalkKey,
  getPushToTalkMouseButton,
  getPushToTalkSettings,
  savePushToTalkSettings,
  type TPushToTalkSettings
} from '@/helpers/push-to-talk';
import { isDesktopClient } from '@/platform/environment';
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
} from '@sharkord/ui';
import { Info, Keyboard, Mouse } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';

const PushToTalkSettings = memo(() => {
  const [settings, setSettings] = useState<TPushToTalkSettings>(
    getPushToTalkSettings
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMouseButton, setCaptureMouseButton] = useState(false);
  const [registrationError, setRegistrationError] = useState<
    string | undefined
  >(undefined);
  const isAvailable = isDesktopClient() && !!window.sandSharkDesktop;

  const applySettings = useCallback(
    async (nextSettings: TPushToTalkSettings) => {
      setSettings(nextSettings);
      savePushToTalkSettings(nextSettings);

      if (!isAvailable || !window.sandSharkDesktop) return;

      setRegistrationError(undefined);

      if (!nextSettings.enabled) {
        await window.sandSharkDesktop.clearPushToTalk();
        return;
      }

      const result = await window.sandSharkDesktop.setPushToTalk({
        input: nextSettings.input,
        modifiers: nextSettings.input.modifiers
      });

      if (!result.registered) {
        setRegistrationError(
          result.error ?? 'The selected key could not be registered.'
        );
      }
    },
    [isAvailable]
  );

  useEffect(() => {
    if (!isCapturing && !captureMouseButton) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const key = isCapturing ? getPushToTalkKey(event) : undefined;
      if (!key) return;

      event.preventDefault();
      if (key) {
        setIsCapturing(false);
        void applySettings({ ...settings, input: key });
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!captureMouseButton) return;

      const input = getPushToTalkMouseButton(event);
      if (!input) return;

      event.preventDefault();
      setCaptureMouseButton(false);
      void applySettings({ ...settings, input });
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('mousedown', onMouseDown, true);
    };
  }, [applySettings, captureMouseButton, isCapturing, settings]);

  return (
    <Group
      label="Push to Talk"
      description={
        isAvailable
          ? 'Hold the selected key to transmit while SandShark is unfocused.'
          : 'Global push-to-talk is available in the SandShark desktop client.'
      }
    >
      <div className="space-y-3">
        <Switch
          checked={settings.enabled}
          disabled={!isAvailable}
          onCheckedChange={(enabled) =>
            void applySettings({ ...settings, enabled })
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            disabled={!isAvailable}
            onClick={() => {
              setCaptureMouseButton(false);
              setIsCapturing(true);
            }}
          >
            <Keyboard className="size-4" />
            {isCapturing ? 'Press a key...' : settings.input.keyLabel}
          </Button>
          <Button
            variant="secondary"
            disabled={!isAvailable}
            onClick={() => {
              setIsCapturing(false);
              setCaptureMouseButton(true);
            }}
          >
            <Mouse className="size-4" />
            {captureMouseButton ? 'Press a mouse button...' : 'Capture mouse'}
          </Button>
        </div>

        <Select
          value={settings.mode}
          disabled={!isAvailable}
          onValueChange={(mode) =>
            void applySettings({
              ...settings,
              mode: mode === 'mute' ? 'mute' : 'talk'
            })
          }
        >
          <SelectTrigger className="max-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="talk">Push to talk</SelectItem>
            <SelectItem value="mute">Push to mute</SelectItem>
          </SelectContent>
        </Select>

        <Group label={`Activation delay: ${settings.activationDelayMs} ms`}>
          <Slider
            min={0}
            max={1000}
            step={25}
            value={[settings.activationDelayMs]}
            disabled={!isAvailable}
            onValueChange={([activationDelayMs]) =>
              activationDelayMs !== undefined &&
              void applySettings({ ...settings, activationDelayMs })
            }
          />
        </Group>

        <Group label={`Release delay: ${settings.releaseDelayMs} ms`}>
          <Slider
            min={0}
            max={1000}
            step={25}
            value={[settings.releaseDelayMs]}
            disabled={!isAvailable}
            onValueChange={([releaseDelayMs]) =>
              releaseDelayMs !== undefined &&
              void applySettings({ ...settings, releaseDelayMs })
            }
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

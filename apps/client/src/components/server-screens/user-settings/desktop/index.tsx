import { isDesktopClient } from '@/platform/environment';
import { memo } from 'react';
import { AdvancedSettings } from './advanced-settings';
import { GetDesktopApp } from './get-desktop-app';
import { UpdateSettings } from './update-settings';
import { WindowSettings } from './window-settings';

// push to talk moved to devices, next to the microphone it controls, and notifications to
// notifications, where the same switch already was
const Desktop = memo(() => {
  if (!isDesktopClient() || !window.sandSharkDesktop) {
    return <GetDesktopApp />;
  }

  return (
    <>
      <WindowSettings />
      <UpdateSettings />
      <AdvancedSettings />
    </>
  );
});

export { Desktop };

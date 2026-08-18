import { isDesktopClient } from '@/platform/environment';
import { useMemo } from 'react';

/**
 * Checks if screen sharing (getDisplayMedia) is supported on the current device.
 * This API is not available on mobile browsers (iOS Safari, Android Chrome, etc.)
 */
const useScreenShareSupport = () => {
  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (!navigator.mediaDevices) return false;

    if (isDesktopClient() && window.sandSharkDesktop) return true;

    return typeof navigator.mediaDevices.getDisplayMedia === 'function';
  }, []);

  return { isScreenShareSupported: isSupported };
};

export { useScreenShareSupport };

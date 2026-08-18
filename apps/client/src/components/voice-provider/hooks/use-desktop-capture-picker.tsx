import { isDesktopClient } from '@/platform/environment';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DesktopCapturePicker,
  type TDesktopCaptureSource
} from '../desktop-capture-picker';

const useDesktopCapturePicker = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<TDesktopCaptureSource[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const resolveRef = useRef<
    ((source: TDesktopCaptureSource | undefined) => void) | undefined
  >(undefined);

  const resolve = useCallback((source: TDesktopCaptureSource | undefined) => {
    const pendingResolve = resolveRef.current;
    resolveRef.current = undefined;
    setOpen(false);
    pendingResolve?.(source);
  }, []);

  const chooseDesktopCaptureSource = useCallback(async () => {
    const desktopApi = window.sandSharkDesktop;

    if (!isDesktopClient() || !desktopApi) return undefined;

    return new Promise<TDesktopCaptureSource | undefined>((resolveSource) => {
      resolveRef.current = resolveSource;
      setLoading(true);
      setError(undefined);
      setSources([]);
      setOpen(true);

      void desktopApi
        .getDesktopCaptureSources()
        .then((availableSources) => {
          setSources(availableSources);
        })
        .catch(() => {
          setError('Unable to list displays and application windows.');
        })
        .finally(() => {
          setLoading(false);
        });
    });
  }, []);

  useEffect(() => {
    return () => {
      resolveRef.current?.(undefined);
      resolveRef.current = undefined;
    };
  }, []);

  const picker = (
    <DesktopCapturePicker
      open={open}
      loading={loading}
      sources={sources}
      error={error}
      onSelect={resolve}
      onClose={() => resolve(undefined)}
    />
  );

  return { chooseDesktopCaptureSource, picker };
};

export { useDesktopCapturePicker };
export type { TDesktopCaptureSource };

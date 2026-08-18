import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject
} from 'react';

const IDLE_TIMEOUT = 3000;

export const useFullscreen = (containerRef: RefObject<HTMLElement | null>) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const resetIdleTimer = useCallback(() => {
    setIsOverlayVisible(true);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(
      () => setIsOverlayVisible(false),
      IDLE_TIMEOUT
    );
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const entered = document.fullscreenElement === containerRef.current;
      setIsFullscreen(entered);

      if (entered) {
        resetIdleTimer();
      } else {
        clearTimeout(idleTimerRef.current);
        setIsOverlayVisible(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearTimeout(idleTimerRef.current);
    };
  }, [containerRef, resetIdleTimer]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isFullscreen) return;

    const onActivity = () => resetIdleTimer();

    el.addEventListener('mousemove', onActivity);
    el.addEventListener('touchstart', onActivity);
    el.addEventListener('keydown', onActivity);

    return () => {
      el.removeEventListener('mousemove', onActivity);
      el.removeEventListener('touchstart', onActivity);
      el.removeEventListener('keydown', onActivity);
    };
  }, [isFullscreen, containerRef, resetIdleTimer]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen({ navigationUI: 'hide' });
      }
    } catch (error) {
      console.error('Fullscreen toggle failed', error);
    }
  }, [containerRef]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, toggleFullscreen]);

  const handleDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  return {
    isFullscreen,
    isOverlayVisible,
    toggleFullscreen,
    handleDoubleClick
  };
};

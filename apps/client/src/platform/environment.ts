export type TDesktopOperatingSystem = 'windows' | 'macos' | 'linux' | 'unknown';

const getSearchParams = () => {
  if (typeof window === 'undefined') return new URLSearchParams();

  return new URLSearchParams(window.location.search);
};

const isDesktopClient = () => {
  if (typeof window === 'undefined') return false;

  return (
    window.location.protocol === 'file:' ||
    getSearchParams().get('desktop') === '1'
  );
};

const isBrowserClient = () => !isDesktopClient();

const getDesktopVersion = () => {
  if (!isDesktopClient()) return undefined;

  return getSearchParams().get('desktopVersion') ?? undefined;
};

const getDesktopOperatingSystem = (): TDesktopOperatingSystem => {
  if (typeof navigator === 'undefined') return 'unknown';

  const platform = navigator.userAgent.toLowerCase();

  if (platform.includes('windows')) return 'windows';
  if (platform.includes('mac os') || platform.includes('macintosh')) {
    return 'macos';
  }
  if (platform.includes('linux')) return 'linux';

  return 'unknown';
};

export {
  getDesktopOperatingSystem,
  getDesktopVersion,
  isBrowserClient,
  isDesktopClient
};

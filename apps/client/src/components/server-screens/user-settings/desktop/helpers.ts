import type { TFunction } from 'i18next';
import type { TDesktopUpdateStatus } from './types';

export const RELEASES_URL =
  'https://github.com/MMajor87/SandShark/releases/latest';

// what each update state says under the version. the updater's own message wins for an error
// or an unsupported build, since it says why
export const getUpdateStatusText = (
  status: TDesktopUpdateStatus,
  t: TFunction<'settings'>
) => {
  const version = status.version ?? t('desktopVersionUnknown');

  if (
    (status.state === 'error' || status.state === 'unsupported') &&
    status.message
  ) {
    return status.message;
  }

  if (status.state === 'downloading' && status.percent !== undefined) {
    return t('updateState_downloadingPercent', { percent: status.percent });
  }

  const texts: Record<TDesktopUpdateStatus['state'], string> = {
    idle: t('updateState_idle'),
    checking: t('updateState_checking'),
    available: t('updateState_available', { version }),
    'not-available': t('updateState_notAvailable'),
    downloading: t('updateState_downloading'),
    downloaded: t('updateState_downloaded', { version }),
    error: t('updateState_error'),
    unsupported: t('updateState_unsupported')
  };

  return texts[status.state];
};

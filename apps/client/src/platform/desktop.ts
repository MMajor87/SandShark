import {
  getDesktopOperatingSystem,
  getDesktopVersion,
  isDesktopClient,
  type TDesktopOperatingSystem
} from './environment';

export type TDesktopClientInfo = {
  version: string | undefined;
  operatingSystem: TDesktopOperatingSystem;
};

const getDesktopClientInfo = (): TDesktopClientInfo | undefined => {
  if (!isDesktopClient()) return undefined;

  return {
    version: getDesktopVersion(),
    operatingSystem: getDesktopOperatingSystem()
  };
};

export { getDesktopClientInfo };

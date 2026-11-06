// the desktop bridge's own types, read off window.sandSharkDesktop so this folder does not
// reach into packages/shared/desktop-api.d.ts by a relative path
type TDesktopApi = NonNullable<Window['sandSharkDesktop']>;

type TResult<K extends keyof TDesktopApi> = TDesktopApi[K] extends (
  ...args: never[]
) => Promise<infer R>
  ? R
  : never;

export type TWindowBehavior = TResult<'getWindowBehavior'>;
export type TStartAtLoginSettings = TResult<'getStartAtLogin'>;
export type THardwareAccelerationSettings = TResult<'getHardwareAcceleration'>;
export type TDesktopUpdateSettings = TResult<'getUpdateSettings'>;
export type TDesktopUpdateStatus = TResult<'getUpdateStatus'>;

import type {
  uIOhook as NativeInputHook,
  UiohookKeyboardEvent,
  UiohookMouseEvent
} from 'uiohook-napi';
import type {
  TPushToTalkConfig,
  TPushToTalkRegistration
} from './desktop-api.js';
import type { TDesktopIpc } from './desktop-ipc.js';

const createPushToTalk = (
  uIOhook: typeof NativeInputHook,
  sendState: (active: boolean) => void,
  platform = process.platform
) => {
  let pushToTalkConfig: TPushToTalkConfig | undefined;
  let pushToTalkIsHeld = false;
  let globalInputHookStarted = false;
  const isPushToTalkConfig = (value: unknown): value is TPushToTalkConfig => {
    if (!value || typeof value !== 'object') return false;

    const config = value as Record<string, unknown>;

    const input = config.input as Record<string, unknown> | undefined;
    const modifiers = config.modifiers as Record<string, unknown> | undefined;

    const hasValidModifiers =
      !!modifiers &&
      ['control', 'shift', 'alt', 'meta'].every(
        (key) => typeof modifiers[key] === 'boolean'
      );

    if (!input || !hasValidModifiers) return false;

    if (input.type === 'keyboard') {
      return (
        typeof input.keyCode === 'number' &&
        Number.isInteger(input.keyCode) &&
        input.keyCode > 0 &&
        input.keyCode <= 65_535
      );
    }

    return (
      input.type === 'mouse' &&
      typeof input.button === 'number' &&
      Number.isInteger(input.button) &&
      input.button >= 1 &&
      input.button <= 5
    );
  };

  const sendPushToTalkState = (active: boolean) => {
    if (pushToTalkIsHeld === active) return;

    pushToTalkIsHeld = active;
    sendState(active);
  };

  const handleGlobalKeyDown = (event: UiohookKeyboardEvent) => {
    if (
      pushToTalkConfig?.input.type === 'keyboard' &&
      event.keycode === pushToTalkConfig.input.keyCode &&
      hasMatchingModifiers(event)
    ) {
      sendPushToTalkState(true);
    }
  };

  const handleGlobalKeyUp = (event: UiohookKeyboardEvent) => {
    if (
      pushToTalkConfig?.input.type === 'keyboard' &&
      event.keycode === pushToTalkConfig.input.keyCode
    ) {
      sendPushToTalkState(false);
    }
  };

  const hasMatchingModifiers = (
    event: Pick<
      UiohookKeyboardEvent | UiohookMouseEvent,
      'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
    >
  ) => {
    const modifiers = pushToTalkConfig?.modifiers;

    return (
      !!modifiers &&
      event.ctrlKey === modifiers.control &&
      event.shiftKey === modifiers.shift &&
      event.altKey === modifiers.alt &&
      event.metaKey === modifiers.meta
    );
  };

  const handleGlobalMouseDown = (event: UiohookMouseEvent) => {
    if (
      pushToTalkConfig?.input.type === 'mouse' &&
      typeof event.button === 'number' &&
      event.button === pushToTalkConfig.input.button &&
      hasMatchingModifiers(event)
    ) {
      sendPushToTalkState(true);
    }
  };

  const handleGlobalMouseUp = (event: UiohookMouseEvent) => {
    if (
      pushToTalkConfig?.input.type === 'mouse' &&
      typeof event.button === 'number' &&
      event.button === pushToTalkConfig.input.button
    ) {
      sendPushToTalkState(false);
    }
  };

  const startGlobalInputHook = () => {
    if (globalInputHookStarted) return;

    uIOhook.on('keydown', handleGlobalKeyDown);
    uIOhook.on('keyup', handleGlobalKeyUp);
    uIOhook.on('mousedown', handleGlobalMouseDown);
    uIOhook.on('mouseup', handleGlobalMouseUp);
    globalInputHookStarted = true;
    uIOhook.start();
  };

  const stopGlobalInputHook = () => {
    if (!globalInputHookStarted) return;

    sendPushToTalkState(false);
    uIOhook.removeListener('keydown', handleGlobalKeyDown);
    uIOhook.removeListener('keyup', handleGlobalKeyUp);
    uIOhook.removeListener('mousedown', handleGlobalMouseDown);
    uIOhook.removeListener('mouseup', handleGlobalMouseUp);
    globalInputHookStarted = false;
    try {
      uIOhook.stop();
    } catch (error) {
      console.error('SandShark could not stop global input.', error);
    }
  };

  const setPushToTalk = (
    config: TPushToTalkConfig
  ): TPushToTalkRegistration => {
    if (platform !== 'win32') {
      return {
        registered: false,
        error: 'Global push-to-talk is currently available on Windows only.'
      };
    }

    try {
      sendPushToTalkState(false);
      pushToTalkConfig = config;
      startGlobalInputHook();

      return { registered: true };
    } catch {
      pushToTalkConfig = undefined;
      stopGlobalInputHook();

      return {
        registered: false,
        error: 'The selected key is unavailable for global push-to-talk.'
      };
    }
  };

  const dispose = () => {
    pushToTalkConfig = undefined;
    stopGlobalInputHook();
  };
  const releaseHeld = () => sendPushToTalkState(false);
  const registerIpc = (ipc: TDesktopIpc) => {
    const { getSenderWindow } = ipc;
    ipc.handle('sandshark:set-push-to-talk', (event, config: unknown) => {
      getSenderWindow(event);

      if (!isPushToTalkConfig(config)) {
        throw new Error('Invalid push-to-talk configuration.');
      }

      return setPushToTalk(config);
    });
    ipc.handle('sandshark:clear-push-to-talk', (event) => {
      getSenderWindow(event);
      pushToTalkConfig = undefined;
      stopGlobalInputHook();
    });
  };
  return { setPushToTalk, releaseHeld, dispose, registerIpc };
};
export { createPushToTalk };

import {
  getLocalStorageItemAsJSON,
  LocalStorageKey,
  setLocalStorageItemAsJSON
} from './storage';

export type TPushToTalkSettings = {
  enabled: boolean;
  mode: 'talk' | 'mute';
  input: TPushToTalkInput;
  activationDelayMs: number;
  releaseDelayMs: number;
};

export type TPushToTalkModifiers = {
  control: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

export type TPushToTalkInput =
  | {
      type: 'keyboard';
      keyCode: number;
      keyLabel: string;
      modifiers: TPushToTalkModifiers;
    }
  | {
      type: 'mouse';
      button: number;
      keyLabel: string;
      modifiers: TPushToTalkModifiers;
    };

export type TPushToTalkKey = TPushToTalkInput;

const EMPTY_MODIFIERS: TPushToTalkModifiers = {
  control: false,
  shift: false,
  alt: false,
  meta: false
};

const DEFAULT_PUSH_TO_TALK_SETTINGS: TPushToTalkSettings = {
  enabled: false,
  mode: 'talk',
  input: {
    type: 'keyboard',
    keyCode: 57,
    keyLabel: 'Space',
    modifiers: EMPTY_MODIFIERS
  },
  activationDelayMs: 0,
  releaseDelayMs: 0
};

const keyCodes: Record<string, number> = {
  Space: 57,
  Escape: 1,
  Tab: 15,
  Enter: 28,
  Backspace: 14,
  CapsLock: 58,
  Delete: 3667,
  Insert: 3666,
  Home: 3655,
  End: 3663,
  PageUp: 3657,
  PageDown: 3665,
  ArrowUp: 57416,
  ArrowDown: 57424,
  ArrowLeft: 57419,
  ArrowRight: 57421,
  ShiftLeft: 42,
  ShiftRight: 54,
  ControlLeft: 29,
  ControlRight: 3613,
  AltLeft: 56,
  AltRight: 3640,
  MetaLeft: 3675,
  MetaRight: 3676,
  NumLock: 69,
  ScrollLock: 70,
  PrintScreen: 3639,
  F1: 59,
  F2: 60,
  F3: 61,
  F4: 62,
  F5: 63,
  F6: 64,
  F7: 65,
  F8: 66,
  F9: 67,
  F10: 68,
  F11: 87,
  F12: 88
};

const digitKeyCodes: Record<string, number> = {
  0: 11,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 6,
  6: 7,
  7: 8,
  8: 9,
  9: 10
};

const numpadKeyCodes: Record<string, number> = {
  Numpad0: 82,
  Numpad1: 79,
  Numpad2: 80,
  Numpad3: 81,
  Numpad4: 75,
  Numpad5: 76,
  Numpad6: 77,
  Numpad7: 71,
  Numpad8: 72,
  Numpad9: 73,
  NumpadMultiply: 55,
  NumpadAdd: 78,
  NumpadSubtract: 74,
  NumpadDecimal: 83,
  NumpadDivide: 3637,
  NumpadEnter: 3612
};

const keyLabels: Record<string, string> = {
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  MetaLeft: 'Left Meta',
  MetaRight: 'Right Meta',
  ScrollLock: 'Scroll Lock',
  CapsLock: 'Caps Lock',
  NumLock: 'Num Lock',
  PrintScreen: 'Print Screen',
  PageUp: 'Page Up',
  PageDown: 'Page Down'
};

const alphabetKeyCodes: Record<string, number> = {
  A: 30,
  B: 48,
  C: 46,
  D: 32,
  E: 18,
  F: 33,
  G: 34,
  H: 35,
  I: 23,
  J: 36,
  K: 37,
  L: 38,
  M: 50,
  N: 49,
  O: 24,
  P: 25,
  Q: 16,
  R: 19,
  S: 31,
  T: 20,
  U: 22,
  V: 47,
  W: 17,
  X: 45,
  Y: 21,
  Z: 44
};

const listeners = new Set<() => void>();

const loadPushToTalkSettings = (): TPushToTalkSettings => {
  const stored = getLocalStorageItemAsJSON<Partial<TPushToTalkSettings>>(
    LocalStorageKey.PUSH_TO_TALK_SETTINGS
  );

  const input = stored?.input as Partial<TPushToTalkInput> | undefined;

  if (!stored || typeof stored.enabled !== 'boolean' || !input) {
    return DEFAULT_PUSH_TO_TALK_SETTINGS;
  }

  const modifiers = input.modifiers as
    | Partial<TPushToTalkModifiers>
    | undefined;

  if (
    (input.type !== 'keyboard' && input.type !== 'mouse') ||
    typeof input.keyLabel !== 'string' ||
    !modifiers
  ) {
    return DEFAULT_PUSH_TO_TALK_SETTINGS;
  }

  if (
    input.type === 'keyboard' &&
    (!Number.isInteger(input.keyCode) || typeof input.keyCode !== 'number')
  ) {
    return DEFAULT_PUSH_TO_TALK_SETTINGS;
  }

  if (
    input.type === 'mouse' &&
    (!Number.isInteger(input.button) || typeof input.button !== 'number')
  ) {
    return DEFAULT_PUSH_TO_TALK_SETTINGS;
  }

  return {
    enabled: stored.enabled,
    mode: stored.mode === 'mute' ? 'mute' : 'talk',
    input: {
      ...input,
      modifiers: { ...EMPTY_MODIFIERS, ...modifiers }
    } as TPushToTalkInput,
    activationDelayMs: Math.max(
      0,
      Math.min(1000, stored.activationDelayMs ?? 0)
    ),
    releaseDelayMs: Math.max(0, Math.min(1000, stored.releaseDelayMs ?? 0))
  };
};

let pushToTalkSettings = loadPushToTalkSettings();

const getPushToTalkSettings = (): TPushToTalkSettings => pushToTalkSettings;

const savePushToTalkSettings = (settings: TPushToTalkSettings) => {
  pushToTalkSettings = settings;
  setLocalStorageItemAsJSON(LocalStorageKey.PUSH_TO_TALK_SETTINGS, settings);
  listeners.forEach((listener) => listener());
};

const subscribePushToTalkSettings = (listener: () => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

const getModifiers = (
  event: Pick<
    KeyboardEvent | MouseEvent,
    'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'
  >
): TPushToTalkModifiers => ({
  control: event.ctrlKey,
  shift: event.shiftKey,
  alt: event.altKey,
  meta: event.metaKey
});

const getModifierLabel = (modifiers: TPushToTalkModifiers) => {
  const labels = [
    modifiers.control ? 'Ctrl' : undefined,
    modifiers.shift ? 'Shift' : undefined,
    modifiers.alt ? 'Alt' : undefined,
    modifiers.meta ? 'Meta' : undefined
  ].filter((label): label is string => !!label);

  return labels.length > 0 ? `${labels.join('+')}+` : '';
};

const getPushToTalkKey = (event: KeyboardEvent): TPushToTalkKey | undefined => {
  const alphabetCode = event.code.startsWith('Key')
    ? alphabetKeyCodes[event.code.slice(3)]
    : undefined;
  const digitCode = event.code.startsWith('Digit')
    ? digitKeyCodes[event.code.slice(5)]
    : undefined;
  const keyCode =
    alphabetCode ??
    digitCode ??
    numpadKeyCodes[event.code] ??
    keyCodes[event.code];

  if (!keyCode) return undefined;

  const modifiers = getModifiers(event);
  const keyLabel = event.code.startsWith('Key')
    ? event.code.slice(3)
    : event.code.startsWith('Digit')
      ? event.code.slice(5)
      : (keyLabels[event.code] ?? event.code);

  return {
    type: 'keyboard',
    keyCode,
    keyLabel: `${getModifierLabel(modifiers)}${keyLabel}`,
    modifiers
  };
};

const getPushToTalkMouseButton = (
  event: MouseEvent
): TPushToTalkKey | undefined => {
  const button = event.button + 1;

  if (button < 1 || button > 5) return undefined;

  const modifiers = getModifiers(event);

  return {
    type: 'mouse',
    button,
    keyLabel: `${getModifierLabel(modifiers)}Mouse button ${button}`,
    modifiers
  };
};

export {
  getPushToTalkKey,
  getPushToTalkMouseButton,
  getPushToTalkSettings,
  savePushToTalkSettings,
  subscribePushToTalkSettings
};

import { getErrorMessage } from '@sharkord/shared';
import { isDebug } from './is-debug';
import { pushVoiceDebugEvent } from './voice-debug';

type TDesktopLogDetails = Record<string, boolean | number | string | undefined>;

const sensitiveLogKeyPattern =
  /(token|secret|password|authorization|cookie|session|credential|key)/i;
const messageContentLogKeyPattern = /(message|content|body|text|markdown)/i;

const formatLogValue = (
  value: unknown
): string | number | boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (value instanceof Error) return value.message.slice(0, 500);

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.name === 'string' && typeof record.message === 'string') {
      return `${record.name}: ${record.message}`.slice(0, 500);
    }

    if (typeof record.id === 'string') return record.id.slice(0, 500);
    if (typeof record.kind === 'string') return record.kind.slice(0, 500);
    if (typeof record.type === 'string') return record.type.slice(0, 500);
    if (typeof record.state === 'string') return record.state.slice(0, 500);

    return value.constructor?.name ?? 'object';
  }

  return String(value).slice(0, 500);
};

const sanitizeDesktopLogDetails = (details: unknown): TDesktopLogDetails => {
  if (!details || typeof details !== 'object') return {};

  return Object.fromEntries(
    Object.entries(details as Record<string, unknown>)
      .slice(0, 16)
      .map(([key, value]) => {
        if (sensitiveLogKeyPattern.test(key)) return [key, '[redacted]'];
        if (messageContentLogKeyPattern.test(key)) return [key, '[omitted]'];

        return [key, formatLogValue(value)];
      })
  );
};

const reportDesktopDiagnostic = (
  category: string,
  message: string,
  details?: TDesktopLogDetails
) => {
  void window.sandSharkDesktop
    ?.reportDesktopDiagnostic({
      category,
      message: message.slice(0, 256),
      details
    })
    .catch(() => undefined);
};

const logDesktopDiagnostic = (
  category: string,
  message: string,
  details?: unknown
) => {
  if (!window.sandSharkDesktop) return;

  reportDesktopDiagnostic(
    category,
    message,
    sanitizeDesktopLogDetails(details)
  );
};

const logVoice = (message: string, data?: object) => {
  pushVoiceDebugEvent('voice', message, data);
  logDesktopDiagnostic('mediasoup', message, data);

  console.log('%c[VOICE]', 'color: salmon; font-weight: bold;', message, data);
};

const logVoiceWarn = (message: string, data?: object) => {
  pushVoiceDebugEvent('warn', message, data);
  logDesktopDiagnostic('mediasoup', message, data);

  console.warn('%c[VOICE]', 'color: orange; font-weight: bold;', message, data);
};

const getErrorCode = (error: unknown): string | undefined => {
  const code = (error as { data?: { code?: unknown } } | undefined)?.data?.code;

  return typeof code === 'string' ? code : undefined;
};

const logVoiceError = (message: string, error: unknown, data?: object) => {
  const payload = {
    ...data,
    error: getErrorMessage(error),
    code: getErrorCode(error)
  };

  pushVoiceDebugEvent('error', message, payload);
  logDesktopDiagnostic('mediasoup', message, payload);

  console.error(
    '%c[VOICE]',
    'color: red; font-weight: bold;',
    message,
    payload
  );
};

const logDebug = (...args: unknown[]) => {
  if (isDebug()) {
    console.log('%c[DEBUG]', 'color: lightblue; font-weight: bold;', ...args);
  }
};

export {
  logDebug,
  logDesktopDiagnostic,
  logVoice,
  logVoiceError,
  logVoiceWarn
};

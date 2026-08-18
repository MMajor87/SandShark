import { isDebug } from './is-debug';

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

const logVoice = (...args: unknown[]) => {
  console.log(
    '%c[VOICE-PROVIDER]',
    'color: salmon; font-weight: bold;',
    ...args
  );

  const [message, details] = args;
  if (typeof message === 'string') {
    logDesktopDiagnostic('mediasoup', message, details);
  }
};

const logDebug = (...args: unknown[]) => {
  if (isDebug()) {
    console.log('%c[DEBUG]', 'color: lightblue; font-weight: bold;', ...args);
  }
};

export { logDebug, logDesktopDiagnostic, logVoice };

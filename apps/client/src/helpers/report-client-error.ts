import { getTRPCClient } from '@/lib/trpc';
import type { ErrorInfo } from 'react';

type TClientErrorSource = 'react' | 'window' | 'unhandled-rejection';

const reportedErrors = new WeakSet<object>();

const normalizeError = (value: unknown) => {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === 'string') {
    return new Error(value);
  }

  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
};

const reportClientError = (
  value: unknown,
  source: TClientErrorSource,
  errorInfo?: ErrorInfo
) => {
  const error = normalizeError(value);

  if (typeof value === 'object' && value !== null) {
    if (reportedErrors.has(value)) {
      return;
    }

    reportedErrors.add(value);
  }

  try {
    void getTRPCClient()
      .others.reportClientError.mutate({
        message: error.message.slice(0, 2_000) || 'Unknown client error',
        stack: error.stack?.slice(0, 20_000),
        componentStack: errorInfo?.componentStack?.slice(0, 10_000),
        source,
        clientVersion: VITE_APP_VERSION.slice(0, 100),
        path: window.location.pathname.slice(0, 2_000),
        userAgent: navigator.userAgent.slice(0, 1_000)
      })
      .catch(() => {});
  } catch {
    // errors before a server connection exists cannot be reported
  }
};

const installGlobalErrorReporting = () => {
  window.addEventListener('error', (event) => {
    reportClientError(event.error ?? event.message, 'window');
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'unhandled-rejection');
  });
};

export { installGlobalErrorReporting, reportClientError };

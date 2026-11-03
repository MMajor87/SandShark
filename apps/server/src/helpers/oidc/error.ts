import type { OidcError } from '@sandshark/shared';

class OidcCallbackError extends Error {
  constructor(
    readonly code: OidcError,
    message: string
  ) {
    super(message);
  }
}

export { OidcCallbackError };

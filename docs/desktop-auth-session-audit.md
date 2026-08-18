# Desktop Authentication and Session Audit

## Current authentication flow

- `POST /login` accepts an identity and password and returns a signed JWT in JSON.
- The JWT is passed to the tRPC WebSocket as `connectionParams.token`.
- The server verifies the JWT and rejects expired, invalid, missing, or banned-user tokens.
- The HTTP login route does not issue a session cookie; client authentication is token-based.

## SandShark desktop session behavior

- A successful login keeps the active token only in session storage.
- Enabling auto-login persists the token in a server-scoped local-storage record.
- Session records are keyed by the selected server ID, with the server URL as a temporary fallback until its ID is known.
- A different server identity at the same URL clears the old session before the profile is updated.
- Explicit disconnect clears the active server's stored token and identity. Passwords are not persisted.
- Expired, invalid, revoked, or banned tokens fail the WebSocket handshake and clear only the affected server's saved auto-login token.

## Electron origin compatibility

The desktop UI uses the selected server's HTTP and WebSocket origins directly. The test server permits cross-origin requests, so the local Electron renderer can retrieve `/info` and submit `/login` without relying on same-origin cookies.

# SandShark Desktop Logging Validation

Phase 36 adds local desktop diagnostics for SandShark.

## Log Files

SandShark creates these files under Electron's `logs` path:

- `sandshark.log` for structured desktop diagnostics.
- `screen-capture.log` for focused screen-share capture diagnostics.
- `chromium-media.log` for Chromium media subsystem output.

Desktop settings include `Settings > Desktop > Open log folder`.

## Logged Events

The desktop log records:

- Main-process startup with SandShark, Electron, Chromium, Node, platform, and packaging versions.
- Renderer startup with the bundled client version.
- Server connection lifecycle events.
- WebSocket reconnect scheduling, errors, and closes.
- Mediasoup voice-provider diagnostics and connection errors.
- Screen-share selection, permission, grant, denial, and failure stages.
- Update check/download requests and update failure status.
- Renderer and GPU process exits, along with the selected recovery action.
- App shutdown.

## Privacy Guardrails

Diagnostics are written as JSON lines and pass through a sanitizer before disk write.

- Keys that look like tokens, secrets, passwords, authorization headers, cookies, sessions, credentials, or keys are redacted.
- Keys that look like message bodies, content, markdown, text, or message payloads are omitted.
- Renderer diagnostics are schema-validated and length-limited at the IPC boundary.
- Server connection diagnostics do not store server URLs.

## Crash Recovery

When Electron reports a renderer or GPU-process exit, SandShark records the
reason and exit code in `sandshark.log`, then offers a native recovery dialog.
The dialog can reload the renderer, open the log folder, or close the app.

Reload is always user-initiated and is limited to two attempts within one
minute. This keeps a repeated renderer or graphics failure from turning into an
automatic restart loop. Existing diagnostic files are retained across launches.

# Phase 2 implementation and validation

October 27, 2026. Implemented in `.integration/sharkord-v0.0.28` on local branch
`refactor/phase-two`, based on Phase 1 at `adec2a72`. Final code commit: `375320d2`.
The root checkout and its pre-existing changes were preserved. No push, PR,
publication, installation or deployment was performed.

## Completed work

| TODO | Implementation |
| --- | --- |
| R6 | Extracted settings and encrypted-secret persistence, diagnostic logging, redaction and retention. Preferences, secrets and window-state writes use same-directory temporary files followed by atomic replacement. Existing startup ordering, defaults, encryption and failure reporting remain. Application/capture logs rotate at 5 MiB with two archives. Chromium rotates only before startup, so its active file can still grow during a long session. |
| R7 | Updater and downloads own registration, state and disposal. Concurrent updater initialization cannot duplicate listeners; partial registration failure removes its listeners. Download handling matches the requested URL or redirect chain, handles closed/cancelled dialogs, cleans up completed items and cancels active downloads when their window closes or the service is disposed. |
| R8 | PTT owns native input listeners and held state, including failed startup and rebind cleanup. Application audio owns its helper immediately after spawn, so stopping/replacing a pending startup settles it and prevents a late ready response from reviving it. Main-frame reload/crash, renderer destruction, window closure and quit release native resources. Subframe navigation does not stop capture. |
| R9 | Main is startup/teardown orchestration. Window/tray/navigation policy remains in its window owner; capture permissions have a separate owner. Each service registers its own IPC and validates payloads. The common registry guards the expected live main frame and allowed renderer URL before dispatch, is idempotent and removes its handlers on disposal. Static checks inventory 39 uniquely owned channels and match preload invocations, complemented by behavioral guard tests. |
| R10 | `packages/shared/desktop-api.d.ts` is the single browser-safe contract, imported as types by the client and desktop/preload. No Electron or Node runtime dependency enters the client through it. |

The lifecycle fixes above are explicit correctness changes accompanying the extraction.
No server route, database schema, native C# implementation or client runtime feature
was changed. No dependencies were added. Module ownership and testing guidance are
recorded in `DEVELOPMENT.md`.

## Review commits

- `76591b94`: shared bridge types.
- `384afd44`: owned IPC registration and trusted renderer validation.
- `6baa345d`: persistence and diagnostic logging.
- `cfd0ea09`: updater and download lifecycles.
- `eebd792a`: native input and application-audio lifecycles.
- `375320d2`: startup/teardown wiring, window and capture owners, security inventory and packaged smoke verification.

Review the series together; extraction modules are connected in the final wiring commit.

## Validation

- `bun run magic`: passed, with existing client lint warnings only. Client, shared and desktop/preload type checks passed together.
- `bun run test`: 2,164 passed, zero failures: desktop 32, shared 216, client 156, server 1,760. Desktop tests were rerun after the final stale-window guard ordering adjustment; 32 passed.
- Desktop static security checks: passed, 39 unique IPC registrations. Behavioral tests cover denied senders before payload handling, subframes, unexpected URLs, destroyed windows, repeated registration and disposal.
- Lifecycle regressions cover concurrent/failed updater registration, disposal during lazy loading, duplicate download completion, cancellation/closure during save dialogs, download cleanup, PTT retry/rebinding, pending audio startup cancellation, replacement, invalid headers, helper errors and renderer destruction.
- Windows native helper, main and renderer builds, and NSIS packaging passed using the pinned .NET SDK and real Node 22.
- Final packaged startup passed with an isolated temporary profile. The actual renderer called `getVersion`, hardware settings, update settings and window behavior through the preload bridge and guarded IPC. The script requires those results; staying alive alone no longer counts as success.
- All 35 preserved development-backup SHA256 entries still match. No development data was reset or migrated.

Logs are retained in root `.integration/phase-two-*.log`, particularly `phase-two-magic.log`,
`phase-two-tests.log`, `phase-two-desktop-tests-final.log`, `phase-two-security.log`,
`phase-two-package-final.log` and `phase-two-packaged-startup-final.log`.

## Candidate and open release gates

Unsigned local candidate:
`.integration/phase-two-desktop-release/SandShark-1.1.1-Setup-x64.exe`.

SHA256: `2802955ED6DE27ACB38141A81706E45100105EC34C71A5AAACA2042283060C78`.

This is an internal validation build retaining version 1.1.1, not a newly published
update. Identify it by commit/hash. Its separate output directory preserves the
Phase 1 installer.

Real two-participant voice/capture, background PTT with physical input, application
audio exclusion, renderer reload during live capture, and installed update/download
acceptance still need live verification. Automated lifecycle tests do not establish
audible correctness or physical-device behavior. Signing policy remains open.

No browser E2E rerun was needed for this desktop refactor and type-only client change;
the prior intermittent media-scroll failure remains unresolved. Hosted clean Windows
CI, real-provider SSO and the other Phase 1 release gates remain open. This report
marks implementation complete, not production readiness.

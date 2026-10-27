# SandShark 1.1.1

- Protects message attachments with current channel and DM access checks, including permission revocation. The paired Phase 1 server and client are required for authenticated attachment URLs.
- Fixes voice controls remaining busy during reconnect and releases camera/screen capture after failed startup or permission revocation.
- Makes calendar event/invitation creation atomic and adds route regression coverage.
- Pins the native build SDK and validates/packages the same resolved release commit.

Private attachment URLs now carry a read-only media credential. Treat them as credentials; do not publish them. File signatures alone no longer grant private attachment access. Logos, profile images and emoji retain their existing asset policy. Revoking a user session or banning the user invalidates their media credential.

This installer remains unsigned. Live two-participant capture, real-provider SSO and installed updater validation remain release gates. See PHASE_ONE_REPORT.md for checks and compatibility details.

# SandShark 1.1.0

- Integrates Sharkord v0.0.28 security fixes, role mentions, thread following, channel notification settings, voice reactions and plugin SDK extensions.
- Adds configurable browser hotkeys while retaining native desktop push-to-talk and capture controls.
- Preserves per-server notification preferences and supports invites in desktop SSO login.
- Preserves calendars and upgrades existing databases through migration 0020.
- Improves Windows file moves when antivirus or indexing temporarily locks a file.

## Validation and upgrade

Automated validation passed: 2,119 unit/integration tests, 53 browser E2E tests (one intentional skip), formatting, lint, types, builds and packaged Windows startup. A development backup passed upgrade, repeat migration and rollback rehearsals.

Upgrade the server to the bundled v0.0.28 integration before using this client. Older server combinations have not been verified. Back up the database, uploads, configuration and plugin data first. Rollback requires the previous server build and its pre-upgrade backup.

Live multi-participant voice, real identity-provider login, installed updater flows and third-party plugin compatibility remain release checks. This Windows installer is unsigned. See UPSTREAM_V0_0_28_REPORT.md for evidence and limitations.

# SandShark 1.0.31

- Shows minimized fullscreen applications in the stream source picker and restores the selected window for capture.
- Updates client labels, translations, default icons, and support links to SandShark while preserving custom server branding.
- Enables automatic update downloads by default. Existing saved preferences are preserved; downloaded updates install when the app exits.
- Points the bundled server updater at the SandShark repository. Server updates still require matching server release assets.

## Validation

Formatting, lint, type checks, and the full test suite passed. The capture and branding changes also passed native capture checks, connection E2E tests, and packaged startup checks before this version bump.

This Windows installer is unsigned.

## Previous release: 1.0.30

- Integrates Sharkord v0.0.25, including the redesigned settings, plugin framework, authentication/session protections, voice statistics and screen-share cursor controls.
- Preserves SandShark's calendars, saved servers, desktop settings, downloads and profile fixes.
- Adds native whole-screen audio capture excluding the SandShark process tree, plus capture levels, outbound audio statistics and playback-error diagnostics.
- Adds desktop OIDC login and retains server-side client error reporting.
- Fixes browser auto-login compatibility and retains the username after logout while clearing credentials.

## Upgrade notes

Back up the server database, uploads, configuration and plugin data before upgrading. The merged server preserves SandShark's calendar migration and applies upstream database changes in a new migration. Existing plugins must be checked against the v0.0.25 SDK. Database rollback requires the previous build and its pre-upgrade database backup.

## Validation and limitations

The merge passed unit tests, builds, a database-copy upgrade rehearsal and packaged startup. The browser suite passed with one media-scroll check requiring retries. Real identity-provider login and second-participant audio/exclusion checks remain unverified; the new diagnostics help investigate those paths, but audible correctness is not yet confirmed.

This Windows installer is unsigned. Verify its SHA256 checksum before installation.

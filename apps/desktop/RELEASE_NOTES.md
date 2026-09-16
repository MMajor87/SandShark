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

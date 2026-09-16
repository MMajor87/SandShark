# SandShark integration of Sharkord v0.0.25

Upstream target: `b94d9a9e`. SandShark desktop/client version remains `1.0.29`; this is a local integration candidate, not a published release.

## Included

- Upstream v0.0.24 and v0.0.25 authentication, OIDC, session revocation, permissions, upload protections, plugin framework, settings redesign, voice diagnostics/stats and cursor controls.
- SandShark saved servers/accounts, encrypted desktop credentials, calendar, desktop settings, tray/taskbar integration, downloads and profile persistence fixes.
- Native program audio capture and whole-screen capture excluding the SandShark process tree. Capture-input levels, outbound audio statistics and playback errors remain in sanitized desktop diagnostics.
- Desktop OIDC uses a sandboxed login window with an isolated cookie session. Callback codes are accepted only from the selected server and exchanged in that session.
- Owner password resets invalidate the target user's sessions and reject identity-provider-only accounts. Browser legacy auto-login preferences remain compatible.

## Upgrade and rollback

Keep the deployed migration history through `0018_quiet_the_order` intact. The generated `0019_eminent_patch` applies upstream migrations 0018 through 0034, including data repairs, in their original order. Its timestamp follows SandShark's calendar migration. Do not replace the journal with upstream's journal or apply upstream's conflicting 0018 separately.

The upstream migration runner creates a SQLite snapshot before pending migrations when `server.backupDatabase` is enabled. Back up the database consistently plus uploads, configuration and plugin data before deployment. Restore both the previous build and its pre-upgrade database for rollback; do not run the old build against an upgraded database.

The local backup rehearsal preserved all existing table counts, passed integrity/foreign-key checks and applied nothing on a second run. Regression fixtures also cover calendars, attachments, replies, reactions, read markers and transactional failure rollback.

## Plugin compatibility

The plugin SDK and runtime changed together. Existing deployed plugins must be checked against the v0.0.25 manifest, capabilities, commands/actions and client UI contracts before enabling them. No installed local plugin manifests were found; remote deployments were not inventoried.

## Remaining release validation

- Test an actual identity provider in the packaged desktop application.
- Test saved-server switching, updater controls and desktop persistence on the target installation.
- Use a second participant to verify program/screen audio, SandShark voice/notification exclusion, mute/deafen, device changes and capture recovery. Native startup and RTP statistics alone do not establish audible correctness.
- Development-only upstream commits remain outside this merge.

See `UPSTREAM_MERGE_CHECKLIST.md` for commands, results and outstanding gates. No release was published and no deployment database was modified.

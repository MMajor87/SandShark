# Sharkord v0.0.28 integration report

Local implementation completed October 26, 2026, on `integrate/sharkord-v0.0.28`, merge commit `00063c66afbf79a02dd9b8db38d5a221863ae919`. The active main checkout remains unchanged. Nothing has been pushed, published or deployed.

## Scope

Merged pinned upstream `07ab40f7bd8b5102cedb55fa04ed03d22590be6d`, including v0.0.26 and v0.0.27, with upstream ancestry retained. Desktop and client versions are 1.1.0; the server/shared target is 0.0.28.

Security, authentication, notifications, role mentions, threads, voice reactions, plugin storage/components and configurable hotkeys are integrated. SandShark calendars, branding, saved servers, updater endpoints, source picker, process audio capture, exclusion and diagnostics are preserved. Native desktop push-to-talk remains authoritative; browser push-to-talk is disabled in the desktop client. The optional upstream hotkey bridge does not add a required native runtime.

Adaptations include per-profile channel mutes, desktop SSO invite forwarding, thread navigation reset when switching servers or opening notifications, role-aware desktop notifications, social embeds outside message paragraphs, and bounded Windows file-move retries. Regression tests cover the storage, SSO, media and filesystem adaptations.

## Data safety

Existing migrations 0018 and 0019 remain unchanged. Generated migration `0020_brief_rogue.sql` continues SandShark history with plugin storage, plugin message components, thread followers, DM close state, indexes and the voice-reaction permission backfill. Metadata was generated with Drizzle.

The user-selected development data was preserved in `.integration/baseline-v0.0.28/development-backup`, with a consistent SQLite backup and SHA256 inventory. All backup hashes remain unchanged. No development or installed-server database was upgraded in place.

A separate backup copy upgraded from 18 to 21 migrations. Original table row counts were preserved except for the intended role-permission grants. Foreign keys and database integrity passed; repeated migration made no changes. Regression tests cover calendar preservation and failed migration rollback. A fresh backup copy also started successfully with the previous v0.0.25 server executable and passed healthz.

## Validation

- Frozen dependency installation, `bun run magic`, migration consistency and translation synchronization passed. Existing lint warnings remain, with no errors.
- Full workspace tests: 2,119 passed, zero failed (desktop 15, shared 216, client 150, server 1,738).
- Final browser E2E: 53 passed, one intentional skip. The repeat run used an explicit loopback bind after wildcard server startup failed. Final navigation changes are included in this run.
- Desktop security check, four server platform builds, native capture build, Electron Windows package and packaged startup smoke test passed.
- Server release manifest sizes and SHA256 hashes match the generated binaries. Git whitespace checks passed.

Logs and rehearsal data are local ignored artifacts under `.integration/baseline-v0.0.28`. Key logs: `integration-tests-verified.log`, `integration-magic-final.log`, `e2e-final.log`, `server-build-final.log`, `package-final.log`, `packaged-startup.log` and `upgrade-rehearsal.log`.

Installer: `.integration/sharkord-v0.0.28/apps/desktop/release/SandShark-1.1.0-Setup-x64.exe`.

SHA256: `28B11325F360304E88CA409604F39EF4B8A40AC47C9D6EACA697EB6C7F7DA342`.

The installer is unsigned. The code commit above identifies the build source; subsequent documentation-only commits do not change binaries.

## Remaining release gates

Automated tests cover authentication/invite rejection cases and messaging permissions. Real identity-provider login, multi-server desktop notifications, installed downloads/updater behavior, live calendar navigation and two-participant voice/capture need manual validation. This includes audible per-application capture, whole-screen exclusion, push-to-talk while unfocused, reconnect and repeated stop/start capture.

No plugins were installed in the development baseline. Plugin commands, components, storage, unread behavior and permission checks have automated coverage; third-party plugins still need validation against the v0.0.28 SDK.

The supported validation target is the bundled v0.0.28 integration. This is not evidence that every older server is incompatible; older and remotely deployed combinations have not been verified. Complete that matrix before advertising backward compatibility.

An issue is required before a PR, and the PR must target `development`. No external issue, PR, publication or deployment was created. The checklist explicitly reserves those actions for authorization.

## Deployment and rollback

1. Complete the live checks above and obtain release authorization.
2. Stop the target server and back up its actual database, uploads, configuration and plugin data. The local development backup is not a remote deployment backup.
3. Deploy the matching server build first; startup applies migrations. Verify healthz, migration count, login, permissions, messages and plugin behavior.
4. Install desktop 1.1.0 and verify saved servers, SSO, notifications, calendar, downloads, updater and live voice/capture.
5. If rollback is necessary, stop the new server and restore the complete pre-upgrade backup with the previous server executable. Do not run the old executable on the upgraded database or attempt a downmigration. Restore the previous desktop version as needed. Changes made after the backup require separate recovery.

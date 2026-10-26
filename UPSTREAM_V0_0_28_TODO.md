# Sharkord v0.0.28 integration TODO

Status: planned, October 26, 2026. No integration changes have been applied.

Starting point: SandShark 1.0.31 (`13636e06`), with Sharkord v0.0.25 (`b94d9a9e`) integrated by `1875f5e3`. Target the released v0.0.28 content, including v0.0.26 and v0.0.27. Verify the exact release commit before starting; do not assume the current development branch matches the release.

Keep the completed [v0.0.25 checklist](UPSTREAM_MERGE_CHECKLIST.md) as historical evidence. Follow [upstream compatibility](docs/upstream-compatibility.md), [AGENTS.md](AGENTS.md), and [CONTRIBUTING.md](CONTRIBUTING.md). Check tasks only when results are recorded. This checklist does not authorize publishing or deployment.

## 1. Establish the baseline

- [ ] Record the current branch, commit, tracked changes, untracked files and existing test failures.
- [ ] Preserve the existing deletion of `Sharkord_Desktop_Fork_TODO.md` and modification of `apps/desktop/native/process-audio-capture/ProcessAudioCapture.csproj`. Inspect their current state before making a recoverable checkpoint.
- [ ] Create an isolated integration branch/worktree with the intended local changes preserved. Keep the active checkout intact.
- [ ] Fetch upstream refs without overwriting existing local tags. Pin and record the exact v0.0.28 commit and tree, checking the release notes against its contents.
- [ ] Verify the common ancestry with the already integrated v0.0.25 baseline. Investigate any unexpected divergence before merging.
- [ ] Generate a merge preview and record conflicting paths. Distinguish actual conflicts from files changed on both sides.
- [ ] Inventory deployed server versions, installed plugins, authentication configuration and database migration state.
- [ ] Make a consistent SQLite backup, accounting for WAL, and preserve uploads/configuration. Use a copy for upgrade testing.

Gate: code and data are recoverable, and the exact source and target are recorded.

## 2. Bring over security and reliability fixes first

- [ ] Require `MANAGE_SETTINGS` when changing the server logo (#853).
- [ ] Integrate UI permission enforcement fixes (#858), retaining server-side authorization.
- [ ] Integrate failed-login IP blocking and localized feedback (#872), including lockout expiry, capacity handling and trusted-proxy behavior.
- [ ] Integrate the server rate-limiter setting (#884) with its validation and tests.
- [ ] Fix IPv4-mapped trusted-proxy handling (#825).
- [ ] Fix non-ASCII file handling (#827), preserving desktop downloads and authenticated file URLs.
- [ ] Fix external audio playback, reconciling the `useVoiceRefs` call contract with SandShark's capture and playback changes.
- [ ] Fix plugin-message unread counts (#812) and voice-control sizing (#810).
- [ ] Fix YouTube rendering (#861), pasted links (#863), and emoji issues while retaining SandShark media overrides.
- [ ] Carry over relevant upstream tests and add regression coverage for adaptations. Record dependencies before treating any fix as independently backportable.

Gate: the prioritized fixes pass focused tests without changing desktop capture, playback or download behavior.

## 3. Reconcile schema and shared contracts

- [ ] Inventory upstream migrations 0035 through 0038 and confirm the pinned release contains each expected operation.
- [ ] Preserve all deployed SandShark migrations, including calendar migration `0018_quiet_the_order` and consolidated migration `0019_eminent_patch`.
- [ ] Map voice-reaction permission grants, plugin storage, plugin message components, thread followers, DM close state and indexes into a new continuation of SandShark's migration history.
- [ ] Merge schema and shared types while preserving calendar tables and SandShark activity-log additions.
- [ ] Generate new migration metadata with `bun run db:gen` from `apps/server`. Do not copy upstream's journal or hand-edit metadata.
- [ ] Include required data backfills with exact `--> statement-breakpoint` separators. Verify new migration timestamps follow the deployed history.
- [ ] Run `bun run db:check` from `apps/server`.
- [ ] Test a fresh database, an upgrade of a backup copy, and a repeat startup. Verify foreign keys, row counts, calendar data and permission backfills.
- [ ] Test failed-upgrade recovery and restoration of the untouched backup with the previous build.

Gate: schema and data upgrades are repeatable and preserve existing SandShark data.

## 4. Integrate messaging, notifications and authentication

- [ ] Integrate notification settings and channel muting (#860). Preserve per-server mute storage, existing user preferences and Electron notification delivery.
- [ ] Integrate role mentions (#864) across composition, rendering, permission checks and notifications.
- [ ] Integrate thread improvements (#881), including sidebar navigation, following/unread state and related DM changes. Retain calendar navigation and desktop layout behavior.
- [ ] Integrate SSO invites when registration is disabled (#874). Preserve desktop browser launch, callback handling and server selection.
- [ ] Test SSO invite validity, expiry, use limits and role assignment, plus ordinary sign-in and reconnect behavior.
- [ ] Test notification and unread behavior across multiple saved servers, muted channels, role mentions, DMs and threads.

Gate: messaging and authentication work with the target server and do not mix state between saved servers.

## 5. Reconcile hotkeys, voice and plugins

- [ ] Integrate configurable hotkeys (#875) through SandShark's existing platform boundaries. Decide how upstream's hotkey bridge maps to Electron support before adding any new runtime dependency.
- [ ] Preserve native push-to-talk, focus/background behavior, configurable bindings and cleanup. Prevent duplicate actions when browser and desktop handlers are both active.
- [ ] Integrate voice reactions (#796) with shared contracts, permission grants, server events and client rendering together.
- [ ] Preserve the desktop source picker, per-application audio, whole-screen audio exclusion, minimized-source restoration, capture cleanup and diagnostics.
- [ ] Integrate plugin SDK extensions (#856, #879) with server runtime, shared contracts, client rendering and storage migrations together.
- [ ] Verify installed plugins or record incompatibilities. Test commands, UI components, storage, unread counts and permission denials.
- [ ] Smoke-test voice join/leave, reconnect, mute/deafen, push-to-talk, external audio, screen sharing and stopping/restarting capture.

Gate: desktop voice behavior is preserved and the plugin compatibility result is documented.

## 6. Finish integration and validation

- [ ] Integrate the listen-interface setting (#862), Docker entry-point fixes (#857, #865), and storage-input improvements (#859) where applicable.
- [ ] Reconcile package manifests and regenerate `bun.lock`, retaining desktop scripts and dependencies.
- [ ] Preserve SandShark branding, desktop versioning, updater endpoints, packaging and release workflows. Review upstream desktop CI separately before adopting it.
- [ ] Run `bun run synci18n` from the scripts package and complete translations for touched keys in every supported locale.
- [ ] Run `bun install --frozen-lockfile`, `bun run magic`, `bun run test`, and `git diff --check`. Record failures and their causes; do not mark failed checks complete.
- [ ] Run relevant E2E coverage and desktop type/build checks, then smoke-test the packaged Windows application.
- [ ] Test desktop sign-in, saved-server switching, notifications, downloads, calendar access, updates and the voice scenarios above.
- [ ] Verify compatibility with deployed server versions. Document any new minimum server version or unsupported combinations.
- [ ] Inspect the final diff for accidental changes, credentials, private server addresses, local paths and runtime logs.
- [ ] Record final commit IDs, validation results, unresolved issues and rollback steps in integration release notes.

Gate: required checks pass and remaining compatibility limitations are explicit.

## 7. Review and release readiness

- [ ] Create or reference the required issue before opening a PR. Follow repository branch and PR rules.
- [ ] Review the final integration scope and retain upstream ancestry for future updates.
- [ ] Prepare desktop/server version changes as applicable, release notes and verified build artifacts.
- [ ] Record the deployment order, database backup procedure and rollback plan. Database rollback uses the preserved backup rather than assuming migrations can be reversed.
- [ ] Obtain release/deployment authorization before publishing artifacts or updating a running server.
- [ ] After authorized release, verify installed versions, startup, migrations, login, voice and messaging; record the result.

## Sources

- [Sharkord v0.0.26, October 9](https://github.com/Sharkord/sharkord/releases/tag/v0.0.26)
- [Sharkord v0.0.27, October 11](https://github.com/Sharkord/sharkord/releases/tag/v0.0.27)
- [Sharkord v0.0.28, October 16](https://github.com/Sharkord/sharkord/releases/tag/v0.0.28)

## Execution log

Record each completed phase with its commit, checks run, results and remaining issues. Planning alone does not complete an implementation task.

| Date | Phase | Commit | Validation and outcome |
| --- | --- | --- | --- |
| 2026-10-26 | Planning | `13636e06` baseline | Checklist created from the upstream assessment; implementation has not started. |

# Sharkord v0.0.28 integration TODO

Status: local integration implemented and committed as `00063c66`, October 26, 2026. Automated validation passed at that point. See the current [server release verification](docs/server-0.1.0-validation.md) and [desktop release notes](apps/desktop/RELEASE_NOTES.md) for later checks and remaining limits.

Starting point: SandShark 1.0.31 (`13636e06`), with Sharkord v0.0.25 (`b94d9a9e`) integrated by `1875f5e3`. Target the released v0.0.28 content, including v0.0.26 and v0.0.27. Verify the exact release commit before starting; do not assume the current development branch matches the release.

Follow [upstream compatibility](docs/upstream-compatibility.md), [AGENTS.md](AGENTS.md), and [CONTRIBUTING.md](CONTRIBUTING.md). Check tasks only when results are recorded.

## 1. Establish the baseline

- [x] Record the current branch, commit, tracked changes, untracked files and existing test failures.
- [x] Preserve the existing deletion of `Sharkord_Desktop_Fork_TODO.md` and modification of `apps/desktop/native/process-audio-capture/ProcessAudioCapture.csproj`. Inspect their current state before making a recoverable checkpoint.
- [x] Create an isolated integration branch/worktree with the intended local changes preserved. Keep the active checkout intact.
- [x] Fetch upstream refs without overwriting existing local tags. Pin and record the exact v0.0.28 commit and tree, checking the release notes against its contents.
- [x] Verify the common ancestry with the already integrated v0.0.25 baseline. Investigate any unexpected divergence before merging.
- [x] Generate a merge preview and record conflicting paths. Distinguish actual conflicts from files changed on both sides.
- [x] Inventory the user-selected development data: source version, installed plugins, authentication configuration and database migration state. Remote deployment inventory is deferred outside this scope.
- [x] Make a consistent SQLite backup, accounting for WAL, and preserve uploads/configuration. Use a copy for upgrade testing.

Gate: local code and development data are recoverable; source, target and merge conflicts are recorded in [the baseline report](UPSTREAM_V0_0_28_BASELINE.md). Baseline validation limitations are documented there.

## 2. Bring over security and reliability fixes first

- [x] Require `MANAGE_SETTINGS` when changing the server logo (#853).
- [x] Integrate UI permission enforcement fixes (#858), retaining server-side authorization.
- [x] Integrate failed-login IP blocking and localized feedback (#872), including lockout expiry, capacity handling and trusted-proxy behavior.
- [x] Integrate the server rate-limiter setting (#884) with its validation and tests.
- [x] Fix IPv4-mapped trusted-proxy handling (#825).
- [x] Fix non-ASCII file handling (#827), preserving desktop downloads and authenticated file URLs.
- [x] Fix external audio playback, reconciling the `useVoiceRefs` call contract with SandShark's capture and playback changes.
- [x] Fix plugin-message unread counts (#812) and voice-control sizing (#810).
- [x] Fix YouTube rendering (#861), pasted links (#863), and emoji issues while retaining SandShark media overrides.
- [x] Carry over relevant upstream tests and add regression coverage for adaptations. Record dependencies before treating any fix as independently backportable.

Gate: the prioritized fixes pass focused tests without changing desktop capture, playback or download behavior.

## 3. Reconcile schema and shared contracts

- [x] Inventory upstream migrations 0035 through 0038 and confirm the pinned release contains each expected operation.
- [x] Preserve all deployed SandShark migrations, including calendar migration `0018_quiet_the_order` and consolidated migration `0019_eminent_patch`.
- [x] Map voice-reaction permission grants, plugin storage, plugin message components, thread followers, DM close state and indexes into a new continuation of SandShark's migration history.
- [x] Merge schema and shared types while preserving calendar tables and SandShark activity-log additions.
- [x] Generate new migration metadata with `bun run db:gen` from `apps/server`. Do not copy upstream's journal or hand-edit metadata.
- [x] Include required data backfills with exact `--> statement-breakpoint` separators. Verify new migration timestamps follow the deployed history.
- [x] Run `bun run db:check` from `apps/server`.
- [x] Test a fresh database, an upgrade of a backup copy, and a repeat startup. Verify foreign keys, row counts, calendar data and permission backfills.
- [x] Test failed-upgrade recovery and restoration of the untouched backup with the previous build.

Gate: schema and data upgrades are repeatable and preserve existing SandShark data.

## 4. Integrate messaging, notifications and authentication

- [x] Integrate notification settings and channel muting (#860). Preserve per-server mute storage, existing user preferences and Electron notification delivery.
- [x] Integrate role mentions (#864) across composition, rendering, permission checks and notifications.
- [x] Integrate thread improvements (#881), including sidebar navigation, following/unread state and related DM changes. Retain calendar navigation and desktop layout behavior.
- [x] Integrate SSO invites when registration is disabled (#874). Preserve desktop browser launch, callback handling and server selection.
- [ ] Test SSO invite validity, expiry, use limits and role assignment, plus ordinary sign-in and reconnect behavior.
- [ ] Test notification and unread behavior across multiple saved servers, muted channels, role mentions, DMs and threads.

Gate: messaging and authentication work with the target server and do not mix state between saved servers.

## 5. Reconcile hotkeys, voice and plugins

- [x] Integrate configurable hotkeys (#875) through SandShark's existing platform boundaries. Decide how upstream's hotkey bridge maps to Electron support before adding any new runtime dependency.
- [x] Preserve native push-to-talk, focus/background behavior, configurable bindings and cleanup. Prevent duplicate actions when browser and desktop handlers are both active.
- [x] Integrate voice reactions (#796) with shared contracts, permission grants, server events and client rendering together.
- [x] Preserve the desktop source picker, per-application audio, whole-screen audio exclusion, minimized-source restoration, capture cleanup and diagnostics.
- [x] Integrate plugin SDK extensions (#856, #879) with server runtime, shared contracts, client rendering and storage migrations together.
- [x] Verify installed plugins or record incompatibilities. Test commands, UI components, storage, unread counts and permission denials.
- [ ] Smoke-test voice join/leave, reconnect, mute/deafen, push-to-talk, external audio, screen sharing and stopping/restarting capture.

Gate: desktop voice behavior is preserved and the plugin compatibility result is documented.

## 6. Finish integration and validation

- [x] Integrate the listen-interface setting (#862), Docker entry-point fixes (#857, #865), and storage-input improvements (#859) where applicable.
- [x] Reconcile package manifests and regenerate `bun.lock`, retaining desktop scripts and dependencies.
- [x] Preserve SandShark branding, desktop versioning, updater endpoints, packaging and release workflows. Review upstream desktop CI separately before adopting it.
- [x] Run `bun run synci18n` from the scripts package and complete translations for touched keys in every supported locale.
- [x] Run `bun install --frozen-lockfile`, `bun run magic`, `bun run test`, and `git diff --check`. Record failures and their causes; do not mark failed checks complete.
- [x] Run relevant E2E coverage and desktop type/build checks, then smoke-test the packaged Windows application.
- [ ] Test desktop sign-in, saved-server switching, notifications, downloads, calendar access, updates and the voice scenarios above.
- [ ] Verify compatibility with deployed server versions. Document any new minimum server version or unsupported combinations.
- [x] Inspect the final diff for accidental changes, credentials, private server addresses, local paths and runtime logs.
- [x] Record final commit IDs, validation results, unresolved issues and rollback steps in integration release notes.

Gate: required checks pass and remaining compatibility limitations are explicit.

## 7. Review and release readiness

- [ ] Create or reference the required issue before opening a PR. Follow repository branch and PR rules.
- [x] Review the final integration scope and retain upstream ancestry for future updates.
- [x] Prepare desktop/server version changes as applicable, release notes and verified build artifacts.
- [x] Record the deployment order, database backup procedure and rollback plan. Database rollback uses the preserved backup rather than assuming migrations can be reversed.
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

| 2026-10-26 | Step 1 | `692c3c85` checkpoint | Development backup and rehearsal copy verified; release pinned; 39 conflicts across 70 overlapping paths; 1,766 tests pass in workspace logs. Magic blocked by missing worktree dependencies. See baseline report. |

| 2026-10-26 | Steps 2-7 local implementation | `00063c66` | 2,119 unit/integration tests pass; final E2E 53 pass, 1 intentional skip; magic, migration checks, frozen install, translations, server/desktop builds and packaged startup pass. Backup upgrade/repeat/rollback rehearsed. Remaining unchecked items require live environments or release authorization. See integration report. |

# Sharkord v0.0.25 merge checklist

Status: local integration complete. Merge commit `1875f5e3` is on `main` and `integrate/sharkord-v0.0.25`. Release-only checks remain unchecked below.

Target: `b94d9a9e` (Sharkord v0.0.25). See [the assessment](UPSTREAM_MERGE_ASSESSMENT.md) for evidence and release links. Complete the phases in order. A checked task must have a recorded result; unresolved failures stay unchecked.

## 1. Preserve the starting point

- [x] Record the current SandShark commit, branch, tracked changes, untracked files and deleted files.
- [x] Preserve the uncommitted audio diagnostics, native audio exclusion and tests in a recoverable checkpoint, including untracked files. Verify the checkpoint against the working files.
- [x] Keep the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md` separate from merge work.
- [x] Create an isolated integration branch/worktree from that checkpoint. Keep the user's active checkout intact.
- [x] Record baseline results for types, lint, tests, native build and packaged startup. Distinguish environment failures from code failures.
- [ ] Inventory deployed SandShark versions, installed plugins and their SDK versions, authentication settings, and database migration state.
- [x] Create a consistent SQLite backup for upgrade testing, accounting for WAL, plus the associated uploads/configuration. Confirm the backup opens and retain an untouched copy.

Gate: the starting code and data can be restored, and existing failures are documented.

## 2. Establish the correct upstream baseline

- [x] Pin the integration to v0.0.25 at `b94d9a9e`; do not include development-only commits in this pass.
- [x] Verify that old baseline `fee3f6c8` and rewritten baseline `ecea4d3c` still resolve to identical tree `43645521907e394eac291f0b4bc93f686e6a3b06`.
- [x] Preserve existing local tags. Fetch any additional upstream tag references into a separate namespace instead of replacing them.
- [x] Regenerate the three-way merge preview against `ecea4d3c`, now including the checkpointed audio changes.
- [x] Save the complete conflict list and assign each file to the database, server/plugins, desktop/UI, or voice phase below. The previous committed-HEAD preview found 37 conflicts; this count may change.
- [x] Prepare the integration using the verified equivalent baseline. Document how the final merge will record upstream ancestry so future merges use the correct common history.

Gate: the preview represents changes since the actual shared content baseline, not the much older automatic merge base.

## 3. Resolve database compatibility first

- [x] Keep SandShark's committed migrations through `0018_quiet_the_order.sql` unchanged, including its calendar tables.
- [x] Inventory every upstream migration from 0018 through 0034: schema changes, backfills, data cleanup, index changes and required ordering.
- [x] Map each upstream operation to a new migration after SandShark's existing history. Do not copy upstream's conflicting `0018` snapshot/journal over SandShark's.
- [x] Merge the final schema while preserving `calendar_events` and `calendar_event_invitees`.
- [x] Generate the migration progression and metadata with `bun run db:gen` from `apps/server`. Add necessary data migration SQL with exact `--> statement-breakpoint` separators. Do not hand-edit metadata or omit data repairs that schema generation cannot infer.
- [x] Ensure all new entries have timestamps newer than the deployed calendar migration, `1787109319980`. Upstream 0018 through 0025 would otherwise be skipped.
- [x] Integrate upstream `db/migrate.ts` and its startup/test wiring, including backups and foreign-key handling outside migration transactions.
- [x] Run `bun run db:check` from `apps/server`.
- [x] Add migration regression tests using the pre-upgrade schema and representative messages, attachments, replies, reactions, read markers, calendars and invitees.
- [x] Verify a fresh database, an upgrade of the backup copy, and a second startup that applies nothing twice.
- [x] Compare record counts and relationships before/after; document any intentional upstream data repairs. Confirm expected columns, indexes, calendar data and foreign-key checks.
- [ ] Verify failed migrations roll back and that the untouched backup can be restored with the old build. Transactional rollback and backup integrity pass; a separate old-executable startup is not yet tested.

Gate: both fresh installation and existing SandShark upgrades succeed without unintended data loss or skipped migrations.

## 4. Integrate shared contracts, server changes and plugins

- [x] Merge shared types, validation, permissions and activity-log definitions, retaining calendar additions.
- [x] Integrate upstream authentication/session invalidation, permission checks, upload protections, proxy/origin settings and related tests.
- [x] Reconcile SandShark avatar/banner/user-update persistence fixes with the upstream routes.
- [x] Review calendar routes against the changed user types, permission helpers and authentication behavior.
- [x] Upgrade the plugin SDK, runtime, manifest/capability validation, shared contracts, client controller and administration UI together.
- [x] Migrate each inventoried plugin to the new SDK or record it as incompatible before release.
- [x] Test plugin commands, actions, HTTP routes, UI slots and per-role permission denials. Include plugin-owned files/messages where used.
- [x] Extend seed fixtures and route tests for any behavior changed by conflict resolution, including rejection paths and side effects.

Gate: server/shared types compile, route tests pass, and plugin compatibility is accounted for.

## 5. Reconcile desktop integration and redesigned UI

- [x] Resolve routing, connect screen, tRPC, storage and server-state conflicts while preserving saved servers/accounts and desktop credentials.
- [x] Integrate OIDC and session invalidation; test local login, logout, expiration, reconnect and server switching.
- [ ] Verify OIDC's external-browser/callback flow fits desktop navigation and deep-link restrictions. Test enabled and disabled configurations.
- [x] Move the avatar/banner fixes into the redesigned profile UI before accepting removal of the old manager components.
- [x] Retain desktop/update settings, calendar navigation and SandShark branding in the new settings layout.
- [x] Transfer desktop download behavior before removing upstream's deleted `helpers/download-file.ts` path.
- [ ] Verify notification permission handling, uploads/downloads, profile saves and persistence after restarting the desktop app.
- [x] Preserve Electron/preload boundaries, native helper packaging, updater configuration, release scripts and SandShark versioning.

Gate: desktop-specific behavior survives the upstream UI and authentication refactors.

## 6. Reconcile voice, capture and diagnostics

- [x] Resolve voice-provider, transport/control hooks, voice cards and device-settings conflicts explicitly.
- [x] Keep the desktop source picker and native per-application audio capture.
- [x] Keep whole-screen native capture that excludes SandShark's main process and children. Do not substitute upstream browser loopback for this path.
- [x] Preserve share-audio on/off behavior, capture cleanup, transport recovery and cancellation handling.
- [x] Add upstream cursor controls, voice diagnostics and stats-context changes to the merged implementation.
- [x] Connect upstream debug events/warnings/errors to sanitized desktop logs; retain input levels, outbound statistics and playback-failure diagnostics.
- [x] Run the native helper tests and client diagnostic tests.
- [ ] Test with a second participant: microphone, webcam, whole-screen share and program share, with shared audio enabled and disabled.
- [ ] While another application plays audio, play SandShark voices/notifications. Confirm the listener hears the intended application but not SandShark playback.
- [ ] Test mute/deafen, volume/output-device changes, stop/restart, source closing, picker cancellation and connection recovery. Confirm no stale tracks/helpers remain.
- [ ] Test browser capture separately from packaged Windows capture and record the observed behavior.

Gate: actual listener tests confirm useful audio and self-audio exclusion; a live track or successful helper startup alone is insufficient.

## 7. Resolve dependencies and run repository checks

- [x] Merge package manifests, preserving desktop scripts and adding upstream client tests, OIDC dependencies and plugin exports.
- [x] Regenerate `bun.lock` with `bun install`; review unexpected dependency/version changes.
- [x] Run `bun run synci18n` from `packages/scripts`; fix only keys affected by the integration across supported languages, including pt-BR.
- [x] Review all conflict resolutions, auto-merged fork files and remaining conflict markers.
- [x] Run `bun run magic` and `bun run test` from the repository root. Resolve new failures and record any remaining blockers.
- [x] Run `bun run db:check` from `apps/server` and upstream E2E coverage through the merged root `test:e2e` script.
- [x] Build the server, client, Electron main process and native helper; run desktop security-boundary and packaged-startup checks.

Gate: the merged source builds and required checks pass, with reproducible commands/results recorded.

## 8. Validate the release candidate and finish integration

- [x] Produce a local packaged Windows candidate containing the updated renderer and native helper.
- [ ] Repeat desktop login, update controls, profiles, calendars, files, plugins and live audio checks on the packaged candidate.
- [ ] Rehearse the upgrade using the database copy, including migration backup behavior and rollback to the old code plus old data backup. Upgrade, backup creation and repeat startup pass; old-executable rollback smoke remains a release check.
- [x] Review the final diff for lost SandShark behavior, accidental upstream branding/version replacements, secrets and unrelated changes.
- [x] Record final upstream ancestry and the tested target commit; verify the next upstream comparison starts from v0.0.25.
- [x] Write release notes covering SDK/plugin incompatibility, database upgrade behavior, audio changes and remaining limitations.
- [x] Complete the authorized local integration merge and present the candidate with test evidence. Publishing and deployment remain outside this task.

Gate: a reviewable, tested candidate exists with a demonstrated rollback path.

## Follow-up outside the initial target

- [ ] Separately assess development commit `ac889718` for the external-audio fix after v0.0.25 integration.
- [ ] Track `7ed3eff9` (plugin unread count) and `0eea660e` (disconnect-button height) for a later update.

## Execution record

Results are recorded below as each phase is validated. Unchecked live checks remain release gates.

| Phase | Commit/checkpoint | Checks and evidence | Remaining blockers |
| --- | --- | --- | --- |
| 1. Starting point | `e7983d4c` | Audio checkpoint, original deletion preserved, consistent local backup | Remote deployment inventory not available |
| 2. Baseline | `287d316e` | Identical-tree ancestry reconciliation; target v0.0.25 | None |
| 3. Database | Generated 0019 | db:check, seeded upgrade/rollback tests, actual backup-copy rehearsal | Old executable rollback smoke not performed |
| 4. Server/plugins | Integrated | 1,456 server and 207 shared tests pass; no installed local plugins | Deployed third-party plugin inventory |
| 5. Desktop/UI | Integrated | Types, client build, 7 desktop OIDC tests and security boundary pass | Real identity provider and installed desktop workflows |
| 6. Voice/audio | Preserved and integrated | Client diagnostics and 3 native helper tests pass | Second-participant listening tests |
| 7. Repository checks | Final candidate | magic, unit tests, db:check and all build targets pass | E2E exits 0; media-scroll check required retry |
| 8. Candidate | Local unpacked Windows app | Packaged startup passes; release notes written | Live audio, real OIDC and deployment checks |

### Progress: checkpoint and baseline

- Audio checkpoint: `e7983d4c`; original checkout remains unchanged.
- Recorded the equivalent upstream baseline with an ancestry-only merge before merging v0.0.25.
- Local development SQLite backup passed integrity_check; 18 applied migrations, latest timestamp 1786049599269 (before the calendar migration). Config, public files and uploads copied under `.integration/pre-merge-backup`. No local plugin manifests found. Remote deployments are not accessible from this checkout.
- Previous baseline: 822 server tests and 147 shared tests passed outside the subprocess-restricted sandbox; client/desktop type checks and three native helper tests passed. Packaged/live participant checks remain outstanding.

### Progress: conflict resolution and first validation

- Combined upstream migrations 0018 through 0034 in generated SandShark migration `0019_eminent_patch`, preserving the deployed calendar migration and its metadata. `bun run db:check` passes. Migration tests verify calendar/message relationships, rollback, backup creation and repeat startup.
- Integrated upstream authentication, plugin SDK/runtime/UI, settings, stats and capture controls. Preserved native desktop capture, saved servers, downloads, calendar and profile persistence. Owner password reset now revokes existing sessions and rejects identity-provider-only accounts.
- Desktop OIDC uses a sandboxed, isolated login window and exchanges the one-time code using that window's cookie session. Seven callback/origin/cancellation tests pass; real identity-provider testing remains pending.
- All translations are synchronized. Client production build, desktop main build and Electron security-boundary verification pass. Required lint/types passed before the latest regression additions; final rerun pending.
- Full regression run found a Windows migration-test cleanup lock and an image optimization test that passes alone but fails in the full suite. Investigation remains active; neither failure is waived.

### Progress: regression and upgrade results

- Full unit/integration suite: 1,456 server, 207 shared, 86 client and 7 desktop tests passed; shared suite retains its existing skipped test. Native helper: 3 passed.
- Fixed full-suite isolation: plugin hooks are cleared between tests; migration fixtures rely on the existing global temporary-directory cleanup to avoid concurrent deletion on Windows.
- `bun run magic`, migration consistency, translations and desktop security-boundary checks pass. Built the client, Electron main, native helper and all four server targets (Windows x64, Linux x64/arm64, macOS arm64).
- Ran the actual migration runner on a copy of `.integration/pre-merge-backup/db.sqlite`: all existing table counts unchanged, integrity and foreign-key checks clean, 20 applied migrations, second startup applied nothing. The untouched backup still opens with its original 18-entry history. Seeded upgrade tests additionally preserve calendar events/invitees and message relationships.
- Local unpacked Windows candidate created at `apps/desktop/release/win-unpacked/SandShark.exe`. Isolated startup remained running for 8 seconds. No publication or deployment performed.
- Bun's Playwright launcher and electron-builder icon helper required a portable Node runtime. Official Node 22.14.0 executable was checksum-verified and stored outside the worktree at `.integration/tools`; Chromium test binaries are in `.integration/browsers`.
- Browser tests caught legacy browser auto-login preference restoration/cleanup mismatches; corrected without changing desktop secret storage. Final browser run is in progress.
- No installed local plugin manifests were present to port; plugin API and permission tests pass. Remote installed plugins and real OIDC provider configuration still require deployment-specific verification.

### Progress: final source validation

- `bun run magic` passes with warnings only. Final `bun run test`: server 1,456 passed, shared 207 passed (one existing skip), client 86 passed, desktop 7 passed. Native helper tests: 3 passed.
- E2E findings resolved: late media resizing now keeps a bottom-following reader at the bottom; confirmation helpers click the intended action instead of racing autofocus; Windows test data is cleaned by the next seed before server startup rather than while SQLite is open; saved-token assertions now use SandShark's per-server storage; logout preserves identity and clears credentials.
- Unit and browser suites must run sequentially because both use mediasoup UDP port 40000. A concurrent run collided on that port; the subsequent sequential unit run passed.
- Final full E2E command completed with portable Node on PATH and PLAYWRIGHT_BROWSERS_PATH pointing to `.integration/browsers`: 46 passed directly, 1 flaky test passed on retry, 1 exploration harness skipped, exit code 0.

### Completion

- Merge commit `1875f5e3` has parents `287d316e` and `b94d9a9e`. `git merge-base HEAD v0.0.25^{}` resolves to `b94d9a9e`, so the next upstream merge starts from the correct release.
- Fast-forwarded the main checkout and ran `bun install --frozen-lockfile` successfully. Only the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md` remains as a tracked working-tree change.
- Original uncommitted audio files and planning documents are additionally preserved in the named stash `pre-upstream-merge workspace preserved; audio changes included in e7983d4c`. Their implemented audio changes are already committed; do not apply that stash over the merged code.
- Final E2E: 46 passed directly, the media-scroll check passed on its second retry, and 1 exploration-only test was skipped. The scroll check remains flaky and should be stabilized before relying on it as a strict release gate. All other checks passed without retries.
- Final packaged startup passes with isolated user data. The smoke script now clears and restores inherited ELECTRON_RUN_AS_NODE so it starts the actual desktop application.
- Candidate: `.integration/sharkord-v0.0.25/apps/desktop/release/win-unpacked/SandShark.exe`. Server release binaries are under the integration worktree's `apps/server/build/out`.
- Evidence logs are at the main checkout root: `integration-magic.log`, `integration-tests.log`, `integration-e2e-final.log`, `integration-upgrade.log`, `integration-server-build.log`, `integration-native-build.log`, `integration-package.log`, and `integration-startup.log`. These logs and build artifacts are not committed.
- Remaining release checks: real OIDC provider, deployed plugin inventory, installed desktop update/persistence workflows, old-executable rollback startup, and second-participant audio/exclusion testing. No push, publication or deployment was performed.

### Release: SandShark 1.0.30

- User authorized pushing and publishing a new release. Incorporated remote commits `113f2923` (Docker line endings) and `b8d2d48a` (client error reporting), resolving the rate-limiter configuration conflict without dropping upstream protections.
- Release source: `a8bc40f2`, tag `sandshark-v1.0.30`. Client and desktop versions are both 1.0.30; lockfile metadata matches. Main and the new tag were pushed atomically.
- Final local checks: magic passed; 1,458 server tests passed with no failures, along with the client/shared/desktop suites. Migration consistency, frozen-lockfile install and desktop security checks pass.
- GitHub full repository checks and builds passed. Independent Windows CI passed installer packaging and packaged startup.
- Release workflow: https://github.com/MMajor87/SandShark/actions/runs/35049445759 . Completed successfully; the stable release is published and verified.
- Release notes explicitly retain the unsigned-installer notice, plugin/database upgrade instructions, unverified live audio/OIDC checks and flaky media-scroll test result.

- Published release: https://github.com/MMajor87/SandShark/releases/tag/sandshark-v1.0.30 . GitHub identifies it as the latest stable release.
- Verified all four uploaded assets: Windows x64 installer, `latest.yml`, installer blockmap and `SHA256SUMS.txt`. The checksum manifest matches GitHub asset SHA256 digests; downloaded metadata/checksum files match their digests; updater metadata names version 1.0.30 and its installer.
- Release notes include the known live audio/OIDC validation limits and upgrade instructions. The user's pre-existing TODO deletion remains uncommitted.

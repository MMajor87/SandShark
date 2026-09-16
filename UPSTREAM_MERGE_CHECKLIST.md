# Sharkord v0.0.25 merge checklist

Status: planning only. No merge started.

Target: `b94d9a9e` (Sharkord v0.0.25). See [the assessment](UPSTREAM_MERGE_ASSESSMENT.md) for evidence and release links. Complete the phases in order. A checked task must have a recorded result; unresolved failures stay unchecked.

## 1. Preserve the starting point

- [ ] Record the current SandShark commit, branch, tracked changes, untracked files and deleted files.
- [ ] Preserve the uncommitted audio diagnostics, native audio exclusion and tests in a recoverable checkpoint, including untracked files. Verify the checkpoint against the working files.
- [ ] Keep the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md` separate from merge work.
- [ ] Create an isolated integration branch/worktree from that checkpoint. Keep the user's active checkout intact.
- [ ] Record baseline results for types, lint, tests, native build and packaged startup. Distinguish environment failures from code failures.
- [ ] Inventory deployed SandShark versions, installed plugins and their SDK versions, authentication settings, and database migration state.
- [ ] Create a consistent SQLite backup for upgrade testing, accounting for WAL, plus the associated uploads/configuration. Confirm the backup opens and retain an untouched copy.

Gate: the starting code and data can be restored, and existing failures are documented.

## 2. Establish the correct upstream baseline

- [ ] Pin the integration to v0.0.25 at `b94d9a9e`; do not include development-only commits in this pass.
- [ ] Verify that old baseline `fee3f6c8` and rewritten baseline `ecea4d3c` still resolve to identical tree `43645521907e394eac291f0b4bc93f686e6a3b06`.
- [ ] Preserve existing local tags. Fetch any additional upstream tag references into a separate namespace instead of replacing them.
- [ ] Regenerate the three-way merge preview against `ecea4d3c`, now including the checkpointed audio changes.
- [ ] Save the complete conflict list and assign each file to the database, server/plugins, desktop/UI, or voice phase below. The previous committed-HEAD preview found 37 conflicts; this count may change.
- [ ] Prepare the integration using the verified equivalent baseline. Document how the final merge will record upstream ancestry so future merges use the correct common history.

Gate: the preview represents changes since the actual shared content baseline, not the much older automatic merge base.

## 3. Resolve database compatibility first

- [ ] Keep SandShark's committed migrations through `0018_quiet_the_order.sql` unchanged, including its calendar tables.
- [ ] Inventory every upstream migration from 0018 through 0034: schema changes, backfills, data cleanup, index changes and required ordering.
- [ ] Map each upstream operation to a new migration after SandShark's existing history. Do not copy upstream's conflicting `0018` snapshot/journal over SandShark's.
- [ ] Merge the final schema while preserving `calendar_events` and `calendar_event_invitees`.
- [ ] Generate the migration progression and metadata with `bun run db:gen` from `apps/server`. Add necessary data migration SQL with exact `--> statement-breakpoint` separators. Do not hand-edit metadata or omit data repairs that schema generation cannot infer.
- [ ] Ensure all new entries have timestamps newer than the deployed calendar migration, `1787109319980`. Upstream 0018 through 0025 would otherwise be skipped.
- [ ] Integrate upstream `db/migrate.ts` and its startup/test wiring, including backups and foreign-key handling outside migration transactions.
- [ ] Run `bun run db:check` from `apps/server`.
- [ ] Add migration regression tests using the pre-upgrade schema and representative messages, attachments, replies, reactions, read markers, calendars and invitees.
- [ ] Verify a fresh database, an upgrade of the backup copy, and a second startup that applies nothing twice.
- [ ] Compare record counts and relationships before/after; document any intentional upstream data repairs. Confirm expected columns, indexes, calendar data and foreign-key checks.
- [ ] Verify failed migrations roll back and that the untouched backup can be restored with the old build.

Gate: both fresh installation and existing SandShark upgrades succeed without unintended data loss or skipped migrations.

## 4. Integrate shared contracts, server changes and plugins

- [ ] Merge shared types, validation, permissions and activity-log definitions, retaining calendar additions.
- [ ] Integrate upstream authentication/session invalidation, permission checks, upload protections, proxy/origin settings and related tests.
- [ ] Reconcile SandShark avatar/banner/user-update persistence fixes with the upstream routes.
- [ ] Review calendar routes against the changed user types, permission helpers and authentication behavior.
- [ ] Upgrade the plugin SDK, runtime, manifest/capability validation, shared contracts, client controller and administration UI together.
- [ ] Migrate each inventoried plugin to the new SDK or record it as incompatible before release.
- [ ] Test plugin commands, actions, HTTP routes, UI slots and per-role permission denials. Include plugin-owned files/messages where used.
- [ ] Extend seed fixtures and route tests for any behavior changed by conflict resolution, including rejection paths and side effects.

Gate: server/shared types compile, route tests pass, and plugin compatibility is accounted for.

## 5. Reconcile desktop integration and redesigned UI

- [ ] Resolve routing, connect screen, tRPC, storage and server-state conflicts while preserving saved servers/accounts and desktop credentials.
- [ ] Integrate OIDC and session invalidation; test local login, logout, expiration, reconnect and server switching.
- [ ] Verify OIDC's external-browser/callback flow fits desktop navigation and deep-link restrictions. Test enabled and disabled configurations.
- [ ] Move the avatar/banner fixes into the redesigned profile UI before accepting removal of the old manager components.
- [ ] Retain desktop/update settings, calendar navigation and SandShark branding in the new settings layout.
- [ ] Transfer desktop download behavior before removing upstream's deleted `helpers/download-file.ts` path.
- [ ] Verify notification permission handling, uploads/downloads, profile saves and persistence after restarting the desktop app.
- [ ] Preserve Electron/preload boundaries, native helper packaging, updater configuration, release scripts and SandShark versioning.

Gate: desktop-specific behavior survives the upstream UI and authentication refactors.

## 6. Reconcile voice, capture and diagnostics

- [ ] Resolve voice-provider, transport/control hooks, voice cards and device-settings conflicts explicitly.
- [ ] Keep the desktop source picker and native per-application audio capture.
- [ ] Keep whole-screen native capture that excludes SandShark's main process and children. Do not substitute upstream browser loopback for this path.
- [ ] Preserve share-audio on/off behavior, capture cleanup, transport recovery and cancellation handling.
- [ ] Add upstream cursor controls, voice diagnostics and stats-context changes to the merged implementation.
- [ ] Connect upstream debug events/warnings/errors to sanitized desktop logs; retain input levels, outbound statistics and playback-failure diagnostics.
- [ ] Run the native helper tests and client diagnostic tests.
- [ ] Test with a second participant: microphone, webcam, whole-screen share and program share, with shared audio enabled and disabled.
- [ ] While another application plays audio, play SandShark voices/notifications. Confirm the listener hears the intended application but not SandShark playback.
- [ ] Test mute/deafen, volume/output-device changes, stop/restart, source closing, picker cancellation and connection recovery. Confirm no stale tracks/helpers remain.
- [ ] Test browser capture separately from packaged Windows capture and record the observed behavior.

Gate: actual listener tests confirm useful audio and self-audio exclusion; a live track or successful helper startup alone is insufficient.

## 7. Resolve dependencies and run repository checks

- [ ] Merge package manifests, preserving desktop scripts and adding upstream client tests, OIDC dependencies and plugin exports.
- [ ] Regenerate `bun.lock` with `bun install`; review unexpected dependency/version changes.
- [ ] Run `bun run synci18n` from `packages/scripts`; fix only keys affected by the integration across supported languages, including pt-BR.
- [ ] Review all conflict resolutions, auto-merged fork files and remaining conflict markers.
- [ ] Run `bun run magic` and `bun run test` from the repository root. Resolve new failures and record any remaining blockers.
- [ ] Run `bun run db:check` from `apps/server` and upstream E2E coverage through the merged root `test:e2e` script.
- [ ] Build the server, client, Electron main process and native helper; run desktop security-boundary and packaged-startup checks.

Gate: the merged source builds and required checks pass, with reproducible commands/results recorded.

## 8. Validate the release candidate and finish integration

- [ ] Produce a local packaged Windows candidate containing the updated renderer and native helper.
- [ ] Repeat desktop login, update controls, profiles, calendars, files, plugins and live audio checks on the packaged candidate.
- [ ] Rehearse the upgrade using the database copy, including migration backup behavior and rollback to the old code plus old data backup.
- [ ] Review the final diff for lost SandShark behavior, accidental upstream branding/version replacements, secrets and unrelated changes.
- [ ] Record final upstream ancestry and the tested target commit; verify the next upstream comparison starts from v0.0.25.
- [ ] Write release notes covering SDK/plugin incompatibility, database upgrade behavior, audio changes and remaining limitations.
- [ ] Present the candidate and test evidence for the separate decision to merge/publish/deploy. Do not publish as part of this planning task.

Gate: a reviewable, tested candidate exists with a demonstrated rollback path.

## Follow-up outside the initial target

- [ ] Separately assess development commit `ac889718` for the external-audio fix after v0.0.25 integration.
- [ ] Track `7ed3eff9` (plugin unread count) and `0eea660e` (disconnect-button height) for a later update.

## Execution record

Record results here during implementation. No implementation tasks are complete yet.

| Phase | Commit/checkpoint | Checks and evidence | Remaining blockers |
| --- | --- | --- | --- |
| 1. Starting point | Pending | Pending | Not started |
| 2. Baseline | Pending | Pending | Not started |
| 3. Database | Pending | Pending | Not started |
| 4. Server/plugins | Pending | Pending | Not started |
| 5. Desktop/UI | Pending | Pending | Not started |
| 6. Voice/audio | Pending | Pending | Not started |
| 7. Repository checks | Pending | Pending | Not started |
| 8. Candidate | Pending | Pending | Not started |

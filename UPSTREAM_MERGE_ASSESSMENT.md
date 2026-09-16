# Sharkord upgrade assessment

Checked September 15, 2026. Target: Sharkord v0.0.25 (`b94d9a9e`). SandShark committed baseline: `c992a4b8`. This is an assessment, not an applied merge.

## New releases

- [v0.0.24, August 27](https://github.com/Sharkord/sharkord/releases/tag/v0.0.24): security and permission fixes, safer database migrations, session invalidation, OIDC, voice diagnostics, reconnect handling, voice UI and performance changes.
- [v0.0.25, September 4](https://github.com/Sharkord/sharkord/releases/tag/v0.0.25): breaking plugin SDK upgrade, per-role plugin capability permissions, settings redesign, moving channels between categories, screen-share cursor settings, OIDC corrections, and Brazilian Portuguese translations.

SandShark reports upstream package version 0.0.23 but already contains development work from August 7, including channel references and voice-user moves. Release notes therefore overstate the functionality that is actually missing.

## Verified comparison and merge preview

Upstream history was rewritten. Fetch updated `upstream/main` and `upstream/development` with forced-update notices; existing local tags v0.0.1 through v0.0.23 were rejected because their targets differ. Those local tags were not overwritten. New tags v0.0.24 and v0.0.25 were fetched.

The old upstream development commit `fee3f6c8` and rewritten commit `ecea4d3c` have exactly the same tree: `43645521907e394eac291f0b4bc93f686e6a3b06`. The normal merge base with SandShark is much older, so an ordinary merge would compare against the wrong practical baseline and generate unnecessary conflicts.

Using that verified equivalent baseline:

- Upstream changes 717 files between the shared content baseline and v0.0.25.
- SandShark changes 143 files relative to that baseline.
- Both change 53 of the same paths.
- `git merge-tree --write-tree --merge-base=ecea4d3c HEAD v0.0.25` reports 37 conflicting paths. It does not modify the working tree or index.

These counts concern committed HEAD. The current uncommitted capture diagnostics, native process exclusion, playback logging, and tests must also be included during integration. Preserve the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md`.

## Required integration work

| Area | Required work |
| --- | --- |
| Git ancestry | Establish the equivalence of the old and rewritten upstream baseline in an integration branch. Use the verified baseline for the initial three-way integration and record v0.0.25 as upstream ancestry when the result is validated. Do not force-replace existing release tags. |
| Database | Preserve SandShark's deployed calendar migration and tables. Adapt upstream migrations into a new ordered continuation of SandShark's migration history. Generate snapshots/journal changes with Drizzle, retain upstream data repair SQL, and adopt upstream's migration runner and backup behavior. |
| Voice and screen sharing | Reconcile `voice-provider/index.tsx`, transport hooks, controls, device settings and voice cards. Retain the desktop source picker, native per-application audio, whole-screen exclusion of SandShark, capture cleanup, transport recovery and diagnostics. Add upstream cursor controls, diagnostics and stats-context changes without replacing the desktop capture path with browser-only `getDisplayMedia`. |
| Logging | Combine upstream `logVoiceWarn`, `logVoiceError` and the voice-debug event buffer with SandShark's sanitized desktop log forwarding. Preserve the new audio input, outbound and playback diagnostics. |
| Authentication and desktop state | Resolve routing, connect screen, tRPC, storage, server actions and notification conflicts. Integrate session invalidation and OIDC while preserving desktop account/server selection and credential handling. Test OIDC browser launch and callback behavior against the desktop navigation restrictions. |
| Settings and profiles | Port SandShark's avatar/banner persistence fixes and desktop/update settings into the redesigned settings UI. Upstream deletes both `avatar-manager.tsx` and `banner-manager.tsx`; accepting those deletions without moving the fork behavior loses fixes. |
| Plugins | Upgrade server plugin runtime, shared contracts, SDK, client controller, management UI and permissions together. v0.0.25 explicitly requires plugin authors to update their plugins. Inventory installed plugins and migrate/test them before deployment. |
| Calendar and custom UI | Keep calendar routes, schema, navigation, shared activity-log additions and server hooks. Review authorization and nullable-user assumptions against the new shared/server types even where Git auto-merges. |
| Downloads and desktop packaging | Upstream deletes `helpers/download-file.ts`; transfer the desktop download behavior to the resulting download flow. Retain Electron/preload/native resources, updater, SandShark branding/versioning and release workflows. |
| Dependencies and translations | Merge package manifests, retain desktop scripts and regenerate `bun.lock`. Include upstream OIDC dependencies and SDK exports. Add translations for SandShark-specific keys to the new pt-BR locale as needed. |

### Database blocker in detail

SandShark's `0018_quiet_the_order.sql` creates `calendar_events` and `calendar_event_invitees`. Upstream's `0018_message_parent_reply_foreign_keys.sql` instead rebuilds message relationships. Both occupy journal index 18 and snapshot `0018_snapshot.json`.

This is not only a filename conflict. SandShark's calendar entry has timestamp `1787109319980`. Upstream migrations 0018 through 0025 have earlier timestamps. Drizzle applies migrations newer than the last applied timestamp, so copying upstream's journal onto an existing SandShark database can skip those required changes, including the session token-version column.

Do not edit an already deployed SandShark migration or hand-resolve snapshots/journals. Generate the merged schema progression after the existing SandShark history, adapt the upstream data changes into that progression, and validate the resulting journal with `db:check`. Keep the upstream migration runner's foreign-key handling around table rebuilds; otherwise cascades can destroy dependent data.

## Suggested order

1. Preserve the current audio changes in an isolated integration checkout, then reconcile upstream history using the identical baseline trees above.
2. Integrate the migration runner and regenerate the schema/migration continuation, preserving calendar data. Prove an upgrade of a copied existing SandShark database as well as a clean install.
3. Bring in shared contracts, server security/authentication and plugin runtime changes as a coherent set.
4. Resolve desktop routing, state, downloads, profiles and settings.
5. Reconcile voice/UI changes and the uncommitted native audio fixes; connect both diagnostic systems.
6. Regenerate the lockfile, sync touched translations, and run formatting, lint, types, unit/integration tests, migration checks and E2E tests.
7. Test a packaged Windows build: updates, login/reconnect, files, profiles, calendars, plugin permissions, screen/program audio, and exclusion of SandShark playback. Upgrade a database copy containing messages, attachments, reactions, read markers and calendar invitations and verify those records survive.

Target the tagged release first. Development currently has three additional untagged commits: `7ed3eff9` (plugin unread counts), `ac889718` (external audio streams), and `0eea660e` (disconnect-button height). Review the external-audio fix separately because it may be useful, but it is not part of v0.0.25.

## Validation limits

The equivalent baseline, changed-file overlap, migration collision, and merge conflicts were checked from fetched Git objects. No integration code was applied, no database was migrated, and no merged build has been tested. The native exclusion fix is fork-specific; upstream v0.0.25 still uses browser display capture with `restrictOwnAudio`, so it does not replace that fix.

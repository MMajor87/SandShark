# Sharkord v0.0.28 baseline record

Recorded October 26, 2026. Scope: step 1 only. No upstream merge applied.

## Source and target

- Active branch: `main`, commit `13636e068341c08a595f787d6e40a01a01a55a96` (SandShark 1.0.31).
- Preserved changes: deleted `Sharkord_Desktop_Fork_TODO.md`, native capture target changed from `net8.0-windows` to `net10.0-windows`, and the untracked integration TODO.
- Isolated branch: `integrate/sharkord-v0.0.28`, checkpoint `692c3c85`.
- Worktree: `.integration/sharkord-v0.0.28`. The active checkout and its index were not switched or staged.
- Target: `refs/upstream-integration/v0.0.28`, commit `07ab40f7bd8b5102cedb55fa04ed03d22590be6d`.
- Target tree: `5ac77b927a3252d55fda55de3015487096642405`.
- Merge base: `b94d9a9ed8a6fd98461f4520c6b3b8f2ccb601c8`, the already integrated v0.0.25 baseline. No ancestry repair is needed.
- Fetch used `--no-tags` and a dedicated tag namespace; existing local tags were not replaced.
- Release history contains v0.0.26, v0.0.27 and v0.0.28. Target package version is 0.0.28; hotkeys and thread migration 0038 are present, consistent with the release notes. Development-only desktop CI is outside this pinned target.

## Recovery and development inventory

The user selected development data as the backup scope. Installed-server and remote deployment data are outside this step's scope; their actual versions and plugin inventories are not verified.

- Recovery artifacts: `.integration/baseline-v0.0.28/` (ignored, local only).
- Local edits also saved in `local-changes.patch`; the original TODO was copied separately. Native project bytes match the checkpoint worktree, and the deleted file is absent there.
- Backup: `development-backup/`, sourced from `apps/server/data`. SQLite's online backup API was used with a read-only source connection, so committed WAL contents are included.
- Config, uploads, public files, plugins and migration assets were copied. No Bun or Sharkord server process was observed during backup. This is a local quiescent-data snapshot, not a remote-server backup.
- All 35 backup files have SHA-256 hashes recorded in `development-backup-inventory.json`; copied asset/config hashes match the source.
- SQLite `integrity_check`: `ok`; `foreign_key_check`: zero violations.
- Separate rehearsal copy: `upgrade-test-data/`. Keep `development-backup/` untouched.
- Local source package version: 0.0.25. The stored database alone does not establish the last running server version.
- Database has 18 applied migrations; latest timestamp is `1786049599269`. It predates SandShark's calendar and consolidated v0.0.25 migrations. Upgrade rehearsal must cover this older starting state.
- No local plugin manifests found. New users allowed; no server password configured; password-only-on-first-join disabled; no OIDC schema present in this database.
- Private configuration and database contents remain in ignored recovery artifacts, not tracked documentation.

## Baseline validation

- Initial sandbox attempts at `bun run test` and `bun run magic` could not start workspace subprocesses.
- Tests were retried with process execution permitted: server 1,460 pass, shared 207 pass, client 86 pass, desktop 13 pass; zero failures and each workspace logged exit code 0. Total: 1,766 passing tests. The PowerShell wrapper returned code 1 and recorded a NativeCommandError while redirecting Bun stderr, so the workspace results are the evidence rather than a successful wrapper exit. Full log: `.integration/baseline-v0.0.28/tests.log`. E2E, native builds and packaged smoke tests were not run in this phase.
- `bun run magic` in the isolated worktree stops during formatting because `prettier` is unavailable there. Dependencies have not been installed in this new worktree; type and lint stages did not run. Full validation remains required before integration completion.
- Git ownership checks in the sandbox require the invocation-scoped `-c safe.directory=C:/Projects/SandShark/.integration/sharkord-v0.0.28` for this tool-created worktree. No global Git configuration was changed.

## Merge preview

`git merge-tree --write-tree --name-only` compared checkpoint `692c3c85` with the pinned release. Exit code 1 reports conflicts; neither worktree nor index was merged. The preview wrote only Git objects and the report.

70 paths changed on both sides; 39 paths have actual textual conflicts. Auto-merging other paths does not establish semantic compatibility, especially for migrations and desktop behavior. Full preview and overlap lists are in the ignored recovery directory.

Conflicting paths:

- `apps/client/package.json`
- `apps/client/src/components/channel-view/text/renderer/helpers.ts`
- `apps/client/src/components/channel-view/text/renderer/serializer.tsx`
- `apps/client/src/components/channel-view/voice/index.tsx`
- `apps/client/src/components/channel-view/voice/voice-user-card.tsx`
- `apps/client/src/components/context-menus/channel/index.tsx`
- `apps/client/src/components/left-sidebar/index.tsx`
- `apps/client/src/components/voice-provider/hooks/use-transports.ts`
- `apps/client/src/components/voice-provider/hooks/use-voice-controls.ts`
- `apps/client/src/components/voice-provider/index.tsx`
- `apps/client/src/features/app/actions.ts`
- `apps/client/src/features/app/hooks.ts`
- `apps/client/src/features/server/hooks.ts`
- `apps/client/src/features/server/messages/actions.ts`
- `apps/client/src/helpers/browser-logger.ts`
- `apps/client/src/helpers/oidc.ts`
- `apps/client/src/helpers/storage.ts`
- `apps/client/src/i18n/locales/cs/common.json`
- `apps/client/src/i18n/locales/cs/settings.json`
- `apps/client/src/i18n/locales/cs/sidebar.json`
- `apps/client/src/i18n/locales/en/common.json`
- `apps/client/src/i18n/locales/en/settings.json`
- `apps/client/src/i18n/locales/es/common.json`
- `apps/client/src/i18n/locales/es/settings.json`
- `apps/client/src/i18n/locales/es/sidebar.json`
- `apps/client/src/i18n/locales/fr/common.json`
- `apps/client/src/i18n/locales/fr/settings.json`
- `apps/client/src/i18n/locales/fr/sidebar.json`
- `apps/client/src/i18n/locales/it/common.json`
- `apps/client/src/i18n/locales/it/settings.json`
- `apps/client/src/i18n/locales/it/sidebar.json`
- `apps/client/src/i18n/locales/pt-BR/settings.json`
- `apps/client/src/i18n/locales/ru/common.json`
- `apps/client/src/i18n/locales/ru/settings.json`
- `apps/client/src/i18n/locales/ru/sidebar.json`
- `apps/client/src/i18n/locales/zh/common.json`
- `apps/client/src/i18n/locales/zh/settings.json`
- `apps/client/src/i18n/locales/zh/sidebar.json`
- `apps/server/src/routers/users/update-user.ts`

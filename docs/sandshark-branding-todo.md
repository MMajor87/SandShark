# SandShark branding TODO

Created September 16, 2026. Client text, default artwork, and current project documentation have been updated. Manual installation/PWA cache checks and server/internal migrations remain pending. This checklist tracks the entire audit, including references intentionally retained for compatibility or attribution.

References:

- [Branding audit and proposed changes](sandshark-branding-audit.md)
- [Complete file and line inventory](sharkord-reference-inventory.md)
- [Upstream compatibility](upstream-compatibility.md)
- [Versioning policy](sandshark-versioning.md)

Use **SandShark** in visible text and `sandshark` in identifiers. Inventory line numbers are a snapshot; locate the current code before editing. Mark an item complete only after implementing and verifying it, or recording an explicit retain/defer decision with a reason in the decision log below. A completed review does not imply a rename was performed.

## 1. Scope and naming decisions

- [x] Decide whether this pass covers desktop/client branding only or also the server distribution. Record the scope below.
- [x] Choose consistent wording for remote servers: neutral "server" or "SandShark server" where accurate. Preserve user-configured server names.
- [x] Decide how the About screen acknowledges compatibility with Sharkord servers.
- [x] Confirm usable SandShark support, issue, contribution, and documentation destinations. Do not invent replacement website URLs.
- [x] Record which internal identifiers will remain compatible and which require a later migration.

## 2. Visible client text

Audit reference: [Visible labels and artwork](sandshark-branding-audit.md#visible-labels-and-artwork).

- [x] Update disconnected/missing-server title fallback in `apps/client/src/components/routing/helpers.ts`; update `components/routing/__tests__/helpers.test.ts`. Preserve connected server titles and unread counts.
- [x] Update sign-in logo alt text, footer branding, and appropriate links in `apps/client/src/screens/connect/index.tsx`; update `packages/e2e/tests/connect.pw.ts`. Default artwork replacement is tracked separately in section 4.
- [x] Update add/edit server headings, URL label, empty state, and validation copy in `apps/client/src/screens/server-connection/index.tsx`.
- [x] Update user-visible connection errors in `apps/client/src/helpers/get-file-url.ts`, `server-session.ts`, and `server-connection.ts`.
- [x] Update user-visible errors in `apps/client/src/features/app/actions.ts` and `features/server/actions.ts`.
- [x] Update linked-server errors in `apps/client/src/components/routing/desktop-deep-link-controller.tsx`; retain legacy protocol handling.
- [x] Update the welcome server-name fallback in `apps/client/src/components/dialogs/welcome-profile-setup/index.tsx`; preserve real server names and factual compatibility comments.
- [x] Apply the chosen About/compatibility wording in `apps/client/src/components/server-screens/user-settings/desktop/index.tsx`.
- [x] Update client console branding/contribution link in `apps/client/src/components/debug-info/index.tsx`.
- [x] Update the visible storage usage label used by `apps/client/src/components/server-screens/server-settings/storage/metrics.tsx`; keep the translation key/API field unless separately migrating them.
- [x] Move touched hardcoded user-facing strings into the existing i18n system; use translated errors/toasts and correct hook dependencies.

## 3. All supported translations

Review `apps/client/src/i18n/locales/<language>/{common,connect,dialogs,settings}.json`. Cover loading/crash/mobile messages, SSO, audio capture, plugin descriptions, server updates, storage labels, and fallback-icon descriptions. Include any new keys from section 2. Preserve the actual marketplace verification authority.

- [x] English (`en`).
- [x] Czech (`cs`), including inflected uses of the old name.
- [x] Spanish (`es`).
- [x] French (`fr`).
- [x] Italian (`it`).
- [x] Brazilian Portuguese (`pt-BR`).
- [x] Russian (`ru`).
- [x] Chinese (`zh`).
- [x] Run `bun run synci18n` from `packages/scripts`; resolve missing touched keys and review grammar/context across all eight languages.

## 4. Artwork and existing SandShark branding

- [x] Replace the old default artwork in `apps/client/public/logo.webp` with the intended SandShark logo. The sign-in fallback now reuses `sandshark.png`; the unused old `logo.webp` was removed.
- [x] Generate/verify `apps/client/public/icon-192.png` and `icon-512.png` from the intended artwork.
- [x] Generate/verify `apps/client/public/favicon.ico`, including small-size readability.
- [x] Check consistency with `apps/client/public/sandshark.png` and `apps/desktop/sandshark.png`.
- [x] Verify `apps/client/index.html` and `apps/client/public/manifest.json` remain correctly branded.
- [x] Verify server-customized logos, names, and favicons remain intact through `apps/server/src/http/manifest.ts` and `apps/client/src/features/app/actions.ts`.
- [ ] Verify Electron app/tray/taskbar icons, installer icon, shortcuts, app model ID, and executable/product names in `apps/desktop/src/main.ts` and `electron-builder.yml`.
- [ ] Check fresh-install and cached browser/PWA behavior so stale icons do not mask the change.

## 5. Support links, documentation, and attribution

Audit reference: [Links, documentation, and defaults](sandshark-branding-audit.md#links-documentation-and-defaults).

- [x] Update crash-report destination in `apps/client/src/components/error-boundary/global-error-boundary.tsx`.
- [x] Update applicable support/contribution links in the sign-in screen and debug console.
- [x] Update `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, and `question.yml`.
- [x] Update `.github/PULL_REQUEST_TEMPLATE.md` to the appropriate contribution guidance.
- [x] Refresh `README.md` to describe the current product and replace the broken deleted-TODO link with current documentation/checklists.
- [x] Review current-product wording and project scope in `CONTRIBUTING.md`, `ROADMAP.md`, and `AGENTS.md`.
- [x] Review `docs/upstream-compatibility.md`, `sandshark-versioning.md`, and `windows-installer.md` for consistency with the chosen scope.
- [x] Decide whether to retain upstream plugin documentation links in `apps/client/src/components/dialogs/plugin-install-confirm/index.tsx` and `packages/plugin-sdk/README.md`.
- [x] Keep marketplace provenance accurate in `packages/shared/src/plugins/marketplace.ts` and translated verification tooltips. Change registry URLs only when a replacement actually exists.
- [x] Verify the Sharkord copyright notice in `LICENSE` remains intact.
- [x] Preserve factual upstream references in `UPSTREAM_MERGE_*.md`, `apps/desktop/RELEASE_NOTES.md`, `docs/sandshark-phase-0.md`, and the `upstream` Git remote.

## 6. Server rebranding, if included in scope

If desktop-only scope is selected, record this section as deferred rather than silently treating it as implemented.

- [ ] Update server console banner in `apps/server/src/index.ts`.
- [ ] Update new-server name/description and seed profile/bio/welcome message in `apps/server/src/db/seed.ts`; do not mechanically rename credential fields.
- [ ] Update development server label in `apps/server/scripts/seed-mock.ts`.
- [ ] Decide whether to change generated `SharkordUser...` names in `apps/server/src/db/mutations/users.ts`; update login/OIDC assertions if changed.
- [ ] Plan any existing-data changes separately; preserve custom server settings, usernames, messages, and credentials. Use a new migration if required, never edit committed migrations.
- [ ] Coordinate binary filenames in `apps/server/build/build.ts` with `Dockerfile` and `docker-entrypoint.sh`.
- [ ] Coordinate build-time `SHARKORD_*` values in `apps/server/build/helpers.ts` with consumers in `apps/server/src/utils/env.ts`.
- [ ] Coordinate `.github/actions/build-sharkord/` naming and references in `.github/workflows/release.yml` and `develop-image.yml`.
- [ ] Update server container tags, image metadata, release asset names, and deployment instructions together.
- [x] Point the server update check in `apps/server/src/helpers/updater.ts` at `MMajor87/SandShark`. The desktop updater already targets that repository.
- [ ] Provide compatible server update metadata/artifacts on the latest SandShark release or implement separate server release selection. The current desktop-only latest release has no `release.json`, so the server cannot offer an update from it. See `docs/sandshark-versioning.md`.
- [ ] Verify existing desktop release naming and target in `.github/workflows/desktop-release.yml` and `apps/desktop/electron-builder.yml` remain correct.
- [ ] Test a newly initialized server and an upgraded server with customized data before distributing renamed server binaries.

## 7. Compatibility decisions and optional migrations

Audit reference: [Internal identifiers and migration work](sandshark-branding-audit.md#internal-identifiers-and-migration-work). For each item, record **retain**, **migrate**, or **defer**, with rationale. These are not prerequisites for replacing visible labels.

- [ ] Workspace namespaces/root package: review `@sharkord/{shared,ui,server,plugin-sdk,e2e,scripts}`, workspace manifests, imports, root `tsconfig.json`, script filters, and `bun.lock`. If migrating, change them together and regenerate the lockfile with Bun.
- [ ] Browser storage: review `apps/client/src/helpers/storage.ts`, all direct storage callers, per-server sessions, and `packages/e2e/tests/auto-login.pw.ts`. If migrating, preserve legacy values, avoid overwriting newer values, and test identities/logins, devices, volumes, drafts, and preferences.
- [ ] Deep links: retain/test `sharkord://` alongside `sandshark://` in Electron registration, main-process parsing, and the client deep-link controller.
- [ ] Runtime environment variables: review `apps/server/src/config.ts`, `declarations.d.ts`, `helpers/paths.ts`, `utils/env.ts`, diagnostics, E2E configuration, and tests. If adding `SANDSHARK_*`, document precedence and retain legacy aliases during transition.
- [ ] Production data directory/container volumes: review `apps/server/src/helpers/paths.ts`, `Dockerfile`, and `docker-entrypoint.sh`. If migrating, preserve database, config, uploads, backups, plugin data, permissions, and configured path overrides.
- [ ] Version header: review `X-Sharkord-Version` in `apps/server/src/http/index.ts` and health tests. Prefer an additive alias if introducing a new header.
- [ ] Metrics contract: review `sharkordUsedSpace` in shared types, server metrics, client storage UI, and tests. Test mixed-version compatibility if renamed.
- [ ] Plugin interface: review `__SHARKORD_STORE__`, `__SHARKORD_REACT*__`, `__SHARKORD_EXPOSED_LIBS__`, and `TSharkordState` across the client, shared types, and SDK. Preserve aliases and test existing compiled plugins before removing old names.
- [ ] OIDC cookies: review `sharkord_oidc_state_` and login/callback tests. If changed, account for authentication flows started before an upgrade.
- [ ] Debug tools: review `window.sharkordDebug` in server actions, transport stats, and type declarations; keep cleanup behavior consistent if adding an alias.
- [ ] Audio worklets: review matching registration/creation names in `helpers/audio-gate.ts` and both audio-worklet processors; test microphone processing if changed.
- [ ] Drag/drop MIME: review `application/x-sharkord-user-id` and every consumer; test drag/drop if changed.
- [ ] Tests/examples/internal strings: review fixture authors, temporary filename prefixes, SDK examples, and the login timing dummy string. Change only where appropriate to the selected scope; preserve the timing-defense behavior.

## 8. Verification and completion

- [ ] Cross-check every row of the audit against completed work or a recorded retain/defer decision.
- [ ] Re-scan existing tracked text files case-insensitively, including ignored-but-tracked server build sources. Use the inventory as a baseline; exclude dependencies, generated artifacts, runtime data, and secondary worktrees.
- [ ] Review every remaining reference other than package namespaces and explain intentional retention. The audit/TODO documents and historical/upstream attribution will intentionally retain the name.
- [ ] Review remaining `@sharkord/...` references against the namespace decision; verify lockfile consistency if manifests changed.
- [x] Run `bun run magic` and `bun run test` after implementation; record outcomes below. Passed for the first text pass; repeat for subsequent implementation phases.
- [ ] Run relevant E2E coverage for connection, sign-in, title/accessibility, saved sessions, and legacy links.
- [ ] Run migration-specific checks for every compatibility identifier actually changed.
- [x] Build the desktop installer with `bun run --cwd apps/desktop package` and run `bun run --cwd apps/desktop test:packaged-startup`.
- [ ] Visually review server chooser, sign-in, connected/disconnected titles, loading/error screens, settings, plugin verification text, custom server branding, tray/taskbar, installer, and PWA icons.
- [ ] Record the final build/version and manual testing result; update the inventory or document remaining intentional references.

## Decision and validation log

Add entries as work proceeds. Leave pending decisions and unperformed checks explicit.

| Date | Checklist item or identifier | Outcome: changed / retain / defer / passed / failed | Reason, files, or validation evidence |
| --- | --- | --- | --- |
| 2026-09-16 | Checklist created | recorded | Linked audit and inventory; no branding changes applied. |
| 2026-09-16 | Scope and server terminology | changed | First pass covers client text and product links. Server chooser/errors use neutral server wording; product labels use SandShark. Custom server names and logos remain intact. |
| 2026-09-16 | About copy and upstream verification | retain | About copy accurately describes compatibility with Sharkord servers. Marketplace verification still belongs to Sharkord; all eight verification tooltips retain that attribution. |
| 2026-09-16 | Internal identifiers and server distribution | defer | No package, storage, protocol, environment, API, plugin, cookie, data-path, server binary, or updater migration in this pass. Individual migration decisions remain pending in section 7. |
| 2026-09-16 | Client text and translations | changed | Updated runtime title, sign-in alt/footer, server chooser, connection/deep-link errors, welcome fallback, console heading, and 32 locale files. Added 11 translated connection keys in each of eight languages. |
| 2026-09-16 | Product support links | changed | Sign-in/console links target MMajor87/SandShark; crash reports target its issues page. Public access was not verified. Upstream plugin documentation remains unchanged. |
| 2026-09-16 | Translation sync and magic | passed | Translation sync reported all keys up to date. bun run magic passed with existing warnings. |
| 2026-09-16 | Repository tests | passed | Final full-suite run passed: client 86, shared 207, desktop 13, server 1,458. The initial run had one unchanged download-size test fail on a closed test socket; its isolated retry and the final full-suite run passed without code changes. |
| 2026-09-16 | Connection E2E | passed | All three connection-screen tests passed using installed Edge with a temporary configuration and Electron's Node runtime. Default Bun/Playwright invocation had a config-loader failure; bundled Playwright Chromium was unavailable. |
| 2026-09-16 | Remaining verification | defer | Broad visual review, artwork, packaging, installer checks, and server/migration checks are still pending. No new installer was produced for this text pass. |
| 2026-09-16 | Default artwork | changed | Reused the existing SandShark PNG on the sign-in screen. Exported 192/512 PNG icons and a favicon with 16/32/48/64/128/256 PNG frames. Checked the 192px and 32px previews, dimensions, and packaged asset equality. Corrected favicon MIME/base URL. |
| 2026-09-16 | Current documentation and templates | changed | Refreshed README, contribution scope, roadmap/agent-guide labels, issue forms, PR guidance link, and installer signing wording. Existing contribution rules remain unchanged. |
| 2026-09-16 | Support destinations | passed | GitHub API confirmed MMajor87/SandShark is public, has issues enabled, and uses main as its default branch. Removed obsolete private-for-now README wording. Template YAML and local documentation links validated. |
| 2026-09-16 | Attribution and compatibility documentation | retain | LICENSE and historical upstream notes remain unchanged. Upstream/plugin links and verification authority remain factual. Upstream compatibility and independent versioning policies still match the desktop-only scope. |
| 2026-09-16 | Artwork-pass validation | passed | bun run magic and the complete bun run test suite passed. All three connection E2E tests passed using the installed Edge browser. Server manifest/custom-logo tests passed in the full suite. |
| 2026-09-16 | Local installer | passed | Rebuilt apps/desktop/release/SandShark-1.0.30-Setup-x64.exe with the text and artwork changes. Packaged startup passed using an isolated profile; no release was published. Existing same-version local installer was replaced. |
| 2026-09-16 | Remaining manual checks | defer | Actual installation/uninstallation, desktop shortcuts/tray visual review, legacy OS deep-link activation, and cached/installed PWA refresh still need manual verification. Server distribution and internal migrations remain outside this pass. |
| 2026-09-16 | Update repository | changed / passed | Server updater now targets MMajor87/SandShark; desktop already used it. Added tests for manifest-based server versions and rejecting desktop-only releases. bun run magic passed with existing warnings; full bun run test passed, including 1,460 server tests. Focused updater tests passed again after the final lint fix. Latest release lacks server metadata/artifacts; that distribution work remains pending. |
| 2026-09-16 | Local server release manifest | passed | Existing build generated apps/server/build/out/release.json for server 0.0.25 and four matching server binaries. Build and updater metadata validation passed; independently verified every size and SHA-256 checksum. Publishing remains pending; existing 0.0.25 servers require a higher version to receive an update. |

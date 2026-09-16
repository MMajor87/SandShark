# SandShark branding audit

Track implementation in the [branding TODO checklist](sandshark-branding-todo.md).

Reviewed September 15, 2026. This is an inventory and change proposal, not an applied rename. Use the existing product spelling **SandShark** for visible text and `sandshark` for identifiers.

The main checkout contains **1,088 case-insensitive occurrences on 1,049 lines across 601 tracked text files**, excluding `bun.lock`. Of those lines, **605 contain only `@sharkord/...` package references**; **444 contain another use of the name**. The lockfile has 22 additional matching lines. Translations contain 132 matching lines in 32 files across all eight supported languages: `en`, `cs`, `es`, `fr`, `it`, `pt-BR`, `ru`, and `zh`.

The [complete inventory](sharkord-reference-inventory.md) lists every matching file and line number, and reproduces all matches other than package-namespace-only lines. The scan covers existing Git-tracked text files, including server build source that a normal ignore-aware search can miss. It excludes dependencies, generated builds/installers, runtime data, Git history, the secondary integration worktree, and the already-deleted `Sharkord_Desktop_Fork_TODO.md`. Untracked capture-fix files were also searched and contained no Sharkord references. Counts are a snapshot before adding these audit documents.

## Suggested scope

Start with a **visible-branding pass**: text, titles, default artwork, help links, and project documentation. Keep existing compatibility identifiers during that pass. A separate server/package migration is only needed if the goal is to distribute the entire server and plugin ecosystem as SandShark.

The existing [upstream compatibility document](upstream-compatibility.md) describes SandShark as a desktop adaptation, and [versioning documentation](sandshark-versioning.md) deliberately keeps the upstream server version separate. A broader rename should update those statements to match the intended product scope.

## Visible labels and artwork

| Area | References | Possible change | Considerations |
| --- | --- | --- | --- |
| Runtime window/browser title | `apps/client/src/components/routing/helpers.ts:47`; corresponding `__tests__/helpers.test.ts:102,107` | Return `SandShark` when disconnected or no server name is available. Update assertions. | Static HTML already says SandShark, but the runtime fallback still says Sharkord. Preserve actual server names when connected. |
| Sign-in screen | `apps/client/src/screens/connect/index.tsx:156,178,289,298,302`; `packages/e2e/tests/connect.pw.ts:10` | Replace default logo and alt text; update footer label and appropriate links; update the accessibility-based test. | Custom server logos should retain server-specific alt text. Keep an explicit upstream acknowledgment if desired. |
| Server chooser | `apps/client/src/screens/server-connection/index.tsx:112,166,245,250` | Change add/edit headings, empty state, URL label, and validation message to SandShark or neutral wording such as “Server URL.” | Neutral wording avoids implying that a compatible upstream server must itself be renamed. Move touched hardcoded strings into i18n. |
| Connection errors and deep-link errors | `apps/client/src/helpers/{get-file-url,server-session,server-connection}.ts`; `features/{app,server}/actions.ts`; `components/routing/desktop-deep-link-controller.tsx:133,146` | Replace “Sharkord server” with “server” or the selected product wording. | These are user-visible exceptions/toasts, not just developer comments. Use existing translation patterns. |
| Translated UI | `apps/client/src/i18n/locales/*/{common,connect,dialogs,settings}.json` | Update loading, crash, mobile warning, audio capture, SSO, plugin, update, storage, and default-icon descriptions across all eight languages. | Review grammatical forms such as Czech “Sharkordu”; simple string replacement can leave incorrect grammar. Run `bun run synci18n` from `packages/scripts` and review only touched translations. |
| Storage usage label | `settings.json` key `diskSharkordUsed`; `components/server-screens/server-settings/storage/metrics.tsx:41,44` | Change the translated value to “SandShark Used” or “Application storage.” | The translation key and API field `sharkordUsedSpace` can stay unchanged. Their spelling is not displayed. |
| Welcome fallback | `apps/client/src/components/dialogs/welcome-profile-setup/index.tsx:171` | Change fallback `serverName` from Sharkord to SandShark or a neutral fallback. | Do not replace a server name supplied by its administrator. The compatibility comment at line 120 refers to actual older Sharkord servers and should remain factual. |
| Desktop about/help copy | `apps/client/src/components/server-screens/user-settings/desktop/index.tsx:198,322` | Decide whether to retain “compatible Sharkord servers” as an interoperability statement or use neutral wording. | This is currently an intentional description of compatibility, not necessarily leftover branding. |
| Developer-facing console branding | `apps/client/src/components/debug-info/index.tsx:7,21`; `apps/server/src/index.ts:35` | Change client console heading/contribution destination. Change server banner only if branding the server too. | Keep the client and server scopes clear. |
| Image assets | `apps/client/public/logo.webp`, `icon-192.png`, `icon-512.png`, `favicon.ico`; `sandshark.png`; `apps/desktop/sandshark.png` | Generate consistent favicon/PWA sizes and fallback logo from the existing SandShark artwork. | Visually inspected `logo.webp` and `icon-192.png`: both show the older gray shark. `sandshark.png` shows the distinct teal SandShark design. The 512 icon and ICO need visual verification during conversion. |
| Dynamic PWA/server branding | `apps/server/src/http/manifest.ts`; `apps/client/src/features/app/actions.ts:86,155` | Refresh bundled fallback icons, while preserving server-configured names/logos. | The server manifest uses persisted server settings. Client code can also fetch a server favicon. Replacing local files alone will not override branding from an existing remote server. |

## Links, documentation, and defaults

| Area | References | Possible change | Considerations |
| --- | --- | --- | --- |
| Bug reporting and contribution links | `components/error-boundary/global-error-boundary.tsx:23`; `screens/connect/index.tsx`; `components/debug-info/index.tsx`; `.github/ISSUE_TEMPLATE/*`; `.github/PULL_REQUEST_TEMPLATE.md` | Route SandShark bug reports and contribution links to the fork's repository where appropriate. | Local configuration identifies `MMajor87/SandShark` as the fork. Public accessibility and issue availability were not checked; do not invent a SandShark website. |
| Plugin documentation and marketplace | `components/dialogs/plugin-install-confirm/index.tsx:92,97`; `packages/plugin-sdk/README.md`; `packages/shared/src/plugins/marketplace.ts:8` | Retain upstream documentation and registry if still using them. Change only when replacement resources exist. | The translated “verified by Sharkord” tooltip describes the current registry's verification authority. Do not relabel it “verified by SandShark” unless SandShark actually owns that review process. |
| Project documentation | `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `AGENTS.md`, `.github` templates | Update current product identity, support process, and project scope. | README still describes an initial project shell and links to the deleted TODO. Replace that stale link with current documentation. |
| New-server defaults | `apps/server/src/db/seed.ts:50,52,152,156,164`; `apps/server/scripts/seed-mock.ts:241` | Change default server name/description, seed profile/bio/welcome message, and development server label if branding the server. | Seed changes affect newly initialized databases. Existing names/messages need an explicit migration or administrator action; never overwrite customized data indiscriminately. `password: 'sharkord'` is a credential field, not a display label, and should not be mechanically renamed. |
| Generated usernames | `apps/server/src/db/mutations/users.ts:43`; login and OIDC tests | Optionally change `SharkordUser...` to `SandSharkUser...` or `User...`. | Affects newly generated names only; preserve existing user identities and update test expectations. |

## Internal identifiers and migration work

| Identifier | Where used | If renamed | Recommendation for a labeling pass |
| --- | --- | --- | --- |
| `@sharkord/shared`, `@sharkord/ui`, `@sharkord/server`, `@sharkord/plugin-sdk`, `@sharkord/e2e`, `@sharkord/scripts`; root `sharkord` | Workspace manifests, imports, root `tsconfig.json`, root script filters, `bun.lock` | Update manifests/imports/aliases/filter arguments together; regenerate lockfile with Bun; rebuild and typecheck all workspaces. Public plugin-sdk consumers need a compatibility plan. | Leave unchanged initially. This is most of the raw search volume and is invisible to users. |
| `sharkord-*` browser storage keys | `apps/client/src/helpers/storage.ts`; storage/session consumers; `packages/e2e/tests/auto-login.pw.ts` | Add fallback reads and migrate old local/session values without overwriting newer values. Check direct storage access and per-server sessions, not only the enum declarations. | Retain existing keys. Blind renaming can make identities, remembered logins, device choices, volumes, drafts, and preferences appear lost. |
| `sharkord://` | `apps/desktop/src/main.ts:90,1254`, `electron-builder.yml:32`, `desktop-deep-link-controller.tsx:50`, `docs/windows-installer.md` | Update registration and parsing on both sides, plus link tests and documentation. | Keep it as a legacy alias; `sandshark://` already exists. |
| `SHARKORD_*` runtime environment variables | `apps/server/src/config.ts:264`, `declarations.d.ts`, `helpers/paths.ts`, `utils/env.ts`; E2E setup | Add `SANDSHARK_*` names with documented precedence and support old names during transition. Update config tests, declarations, deployment examples, and diagnostics. | Keep current names unless making a server configuration migration. |
| `SHARKORD_*` build-time variables | `apps/server/build/helpers.ts:159` and `src/utils/env.ts` | Rename injected constants and their consumers in the same change. Update build tests and release checks. | Handle with server packaging work. |
| Production data folder `sharkord` | `apps/server/src/helpers/paths.ts:25`; `Dockerfile`; `docker-entrypoint.sh` | Plan detection/migration of the existing database, config, uploads, backups, and plugin data. Update container mounts and permissions. | Keep existing paths. Merely changing the folder name can start an apparently empty server. |
| Server binaries/container identity | `apps/server/build/build.ts:84`; `.github/actions/build-sharkord/action.yml`; `.github/workflows/{release,develop-image}.yml`; `Dockerfile`; `docker-entrypoint.sh` | Rename artifacts, executable paths, action folder/references, image tags/metadata, release uploads, and deployment instructions together. | Separate project from desktop labeling. Existing container users need a documented transition. |
| Server updater repository | `apps/server/src/helpers/updater.ts:19,20` | Point at a server release channel with compatible artifacts/metadata, or explicitly disable server auto-update until one exists. | Important if distributing a renamed server: it currently checks `Sharkord/sharkord`, independently of the SandShark desktop updater. Changing its visible name alone does not change update provenance. |
| HTTP header `X-Sharkord-Version` | `apps/server/src/http/index.ts:113`; health tests | Optionally emit `X-SandShark-Version` alongside the old header. Update tests and confirm consumers before removal. | Preserve compatibility. |
| Metrics field `sharkordUsedSpace` | `packages/shared/src/statics/metrics.ts`; server `utils/metrics.ts`; client storage metrics and server tests | Update shared contract, server producer, client consumer, and tests; consider dual fields/versioning for mixed-version peers. | Change only its UI label initially. |
| Plugin globals/types | `helpers/exposes.ts`, `vite-env.d.ts`, `features/server/plugins/plugin-store.ts`; `packages/plugin-sdk/src/{client,index}.ts`; shared plugin types | Add aliases before replacing `__SHARKORD_STORE__`, `__SHARKORD_REACT*__`, `__SHARKORD_EXPOSED_LIBS__`, or exported `TSharkordState`. Test already-built plugins. | Preserve the existing plugin interface. Documentation examples named `TSharkord` can remain or be updated separately. |
| OIDC cookie prefix | `apps/server/src/http/oidc/common.ts:13`; OIDC tests | Coordinate login/callback readers and writers; account for authentication attempts started before an upgrade. | No visible-branding benefit; retain it. |
| Debug global | `window.sharkordDebug` in server actions, transport stats, and `vite-env.d.ts` | Add a `sandsharkDebug` alias if desired; update cleanup and support instructions. | Optional developer tooling cleanup. |
| Audio worklet names | `helpers/audio-gate.ts`; both `audio-worklets/*-processor.js` files | Rename registration and creation names together. | Internal only; unnecessary for labeling. |
| Drag/drop MIME | `components/left-sidebar/helpers.ts:3`: `application/x-sharkord-user-id` | Update every drag source/drop consumer together. | Internal only; retain unless doing a comprehensive identifier rename. |
| Test fixtures, temporary prefixes, timing dummy string | Server tests, E2E plugin manifest, `http/login.ts:55`, SDK examples | Rename fixtures/assertions only when the associated behavior changes. | These are not UI branding. The dummy-password string is a timing-defense input, not a product label. |

## Already using SandShark

- `apps/desktop/package.json`: `@sandshark/desktop` and desktop description.
- `apps/desktop/electron-builder.yml`: product/executable/installer/shortcut names, `com.sandshark.desktop`, and `MMajor87/SandShark` publish target.
- `apps/desktop/src/main.ts`: app name, app model ID, tray/icon references, and many desktop-specific messages.
- `apps/client/index.html`: initial document title.
- `apps/client/public/manifest.json`: static PWA name and short name.
- `.github/workflows/desktop-release.yml`: SandShark desktop release workflow and tag prefix.
- Desktop server profiles, server sessions, push-to-talk, and some notification preferences already use `sandshark-*` keys.

## References to retain

Keep the existing Sharkord copyright attribution in `LICENSE`. Keep factual upstream repository references, the `upstream` Git remote, upstream release/merge history, and compatibility documentation where they identify the original project. Rebranding the fork should not rewrite historical facts or imply that upstream plugins were reviewed by SandShark.

## Suggested implementation order and verification

1. Update current-product text, runtime title, default artwork, support links, and all affected translations. Preserve custom server branding. Update UI/title/accessibility tests.
2. Update README, contribution/support templates, and roadmap wording; repair the deleted-TODO link. Keep upstream credits explicit.
3. If server rebranding is desired, coordinate new-server defaults with binary/container names, server releases, and the server updater. Test both a fresh database and an existing customized installation.
4. Treat storage keys, data directories, environment variables, API fields, and plugin globals as separate compatibility migrations. Add legacy-upgrade tests before switching names.
5. Run `bun run magic`, `bun run test`, translation sync, the relevant E2E tests, desktop packaging/startup checks, and a UI review covering disconnected/connected titles, sign-in, server chooser, loading/error screens, settings, plugin verification text, tray/installer/PWA icons, and old deep links.

Only these audit documents were added for this request. No branding, settings, release channels, or runtime behavior was changed. No tests were rerun for this documentation-only inventory.

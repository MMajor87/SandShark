# SandShark refactor and improvement plan

Reviewed October 26, 2026; Phase 3 implementation updated October 27. Status: Phases 1 through 3 code implemented in `.integration/sharkord-v0.0.28`, now on `refactor/phase-three`. Live release verification remains open. See [PHASE_ONE_REPORT.md](PHASE_ONE_REPORT.md), [PHASE_TWO_REPORT.md](PHASE_TWO_REPORT.md) and [PHASE_THREE_REPORT.md](PHASE_THREE_REPORT.md).

## Baseline and scope

This review targets the completed v0.0.28 integration at `b355c87a`, in `.integration/sharkord-v0.0.28`, rather than the older root `main` checkout at `13636e06`. Source paths below are relative to that integration checkout. Start implementation from the integrated branch so that fixes are not overwritten by its eventual merge.

The review used source inspection, existing validation records, 53 open Sharkord issues and five open PRs returned by GitHub. No new runtime reproduction or security exploit testing was performed. The prior 2,119 passing tests and 53 passing E2E tests establish a useful baseline, but do not cover the gaps below. The external write-up linked from issue #889 was inaccessible; that finding relies on the public issue and local source, not an assumed reading of the report.

Keep changes small and independently reviewable. Preserve upstream ancestry, existing platform adapters, native audio behavior, calendar data and migration history. Avoid a framework replacement, a generic service container, broad renames or dependency upgrades bundled with refactors. Create/reference an issue before a PR, and target `development`, as required by CONTRIBUTING.md.

## Findings needing attention

| Priority | Finding and evidence | Recommended action |
| --- | --- | --- |
| P0 | **File download authorization needs a security decision and regression tests.** `apps/server/src/http/public.ts:29` and `http/index.ts:87` serve non-orphan files without checking a requesting user's channel/DM access. With signing disabled, knowing the URL is enough. With signing enabled, `helpers/files-crypto.ts:5` binds a token to file ID and expiry, not a user or current membership. This matches the area reported in [#889](https://github.com/Sharkord/sharkord/issues/889). | Treat private attachments separately from intentionally public assets. Reproduce with local fixtures; establish the intended bearer-link policy, permission-revocation behavior and cache policy before changing delivery. Signed URLs alone do not provide current membership checks. This is a confirmed code path, not a claim about exploitation of a deployed server. |
| P1 | **Desktop build SDK mismatch.** Native capture targets `net10.0-windows`; `desktop-ci.yml:28`, `desktop-release.yml:40` and `desktop-signing.yml:24` explicitly install .NET 8. | Pin a compatible SDK consistently, preferably with one `global.json` consumed by workflows. Validate on a clean Windows runner; local success with SDK 10 does not prove CI reproducibility. A hosted runner may happen to have another SDK, so failure is environment-dependent. |
| P1 | **Voice controls can remain busy after a disconnected-client exception.** `use-voice-controls.ts:72,131,215,266` sets busy refs before calling `getTRPCClient()` outside `try`; `lib/trpc.ts:118` throws when disconnected. | Move client acquisition into the guarded path, guarantee `finally` resets each flag, and test retry after the client becomes available. Preserve optimistic-state rollback and local mute behavior. |
| P1 | **Permission loss can prevent reporting capture shutdown.** `routers/voice/update-state.ts` drops webcam/screen fields regardless of whether the request starts or stops capture. Client failed-start handlers reset UI without always releasing capture. | Review [#869](https://github.com/Sharkord/sharkord/issues/869) and [PR #886](https://github.com/Sharkord/sharkord/pull/886). Permit safe stop transitions, release local tracks on failure, and enforce revocation on the server so a non-cooperating client cannot keep publishing. Do not assume the proposed client-side fix alone fully enforces permissions. |
| P1 | **Calendar writes are not atomic.** `routers/calendar/index.ts:120` inserts an event, then invitees in a separate statement. | Put the writes in one synchronous Drizzle transaction with `.get()`/`.run()`. Test rollback when invite creation fails. |
| P1 | **Calendar listing is unbounded and filters in JavaScript.** `routers/calendar/index.ts:41` loads all events before checking creator/invitation visibility. Routes also lack rate limiting and all three procedures live in one file. | Move visibility into SQL, use bounded date windows/cursor pagination and check query plans before adding indexes. Split procedures by action; explicitly define who may create/invite instead of inventing an arbitrary permission. Add rate limiting to writes and bounded reads as appropriate. |
| P1 | **Calendar route coverage is missing from the searched server tests.** Migration tests cover data preservation, not route behavior. | Add seeded cases for organizer, direct invite, role invite, stranger, invalid targets, duplicate targets, invalid times, owner-only deletion, cascades and transaction rollback. Return NOT_FOUND for events invisible to the caller to avoid existence disclosure. |
| P1 | **Signed media expires with no refresh route in the reviewed code.** `helpers/get-file-url.ts:31` formats stored tokens; `routers/files/index.ts` exposes deletion only. | Address [#852](https://github.com/Sharkord/sharkord/issues/852) and [#832](https://github.com/Sharkord/sharkord/issues/832) after the access policy is fixed. Refresh authorized files in bounded batches on expiry/reconnect/resume; update emoji rendering as well as attachments. Reproduce expiry locally before calling the complete bug confirmed. |
| P2 | **Runtime diagnostic logs have no visible retention bound.** `apps/desktop/src/main.ts:123,189` synchronously appends logs; media verbosity is enabled at startup around line 167. | Add bounded rotation and opt-in verbose diagnostics. Keep redaction and useful error logs. Measure event-loop impact before replacing all file I/O. Cleaning repository logs does not solve runtime growth. |
| P2 | **IPC security verification checks source strings and counts.** `scripts/verify-security-boundary.mjs` compares total handler and guard occurrences. `main.ts:1374` validates the owning window but does not explicitly inspect the sender frame. | Add behavioral sender/payload/navigation tests and consider an explicit main-frame/allowed-URL check. A string count cannot establish that every handler is guarded. This is a verification weakness, not evidence of an exploitable renderer bypass. |
| P2 | **Desktop API types are duplicated.** `desktop/src/desktop-api.ts` and `client/src/vite-env.d.ts` both describe the bridge. | Reuse a browser-safe, type-only contract with no Electron/Node runtime imports. Choose the smallest existing workspace location that fits both builds; do not add a package solely for this. |
| P2 | **Old notification mutation helpers remain unused.** Repository search found `isChannelNotificationsMuted` and `toggleChannelNotificationsMuted` only in their defining file. | Remove unused exports after reference checks; retain the Redux path and per-profile persistence tests. Avoid two ways to mutate the same preference. |
| P2 | **Manual release checks remain open and artifacts are unsigned.** See the integration report. | Complete real-provider SSO, two-participant audio/exclusion, background PTT, server switching, installed update and plugin compatibility checks. Define signing/release policy before distribution. |

## Refactor sequence

### Phase 1: correctness and reproducible releases

- [x] R1: Add local private-file access regression cases, agree the asset access policy, and fix the authorization gap. Cover anonymous requests, wrong channel, non-member DM, revoked access, expired signatures, intentionally public logo, range requests and cache behavior. Preserve encoded filenames and desktop downloads.
- [ ] R2: SDK/workflow alignment implemented and local native clean plus Windows packaging passed. Hosted clean Windows CI verification remains pending.
- [x] R3: Make release validation and packaging operate on the same resolved commit. In manual `desktop-release.yml`, the package job checks out `inputs.tag` while the reusable CI workflow checks out the triggering ref by default. Pass the target ref into validation and record its SHA, rather than validating one revision and publishing another.
- [x] R4: Fix voice busy-flag cleanup and safe capture-stop transitions. Add tests before extracting voice code.
- [x] R5: Add calendar route coverage and atomic creation. Keep pagination/API changes in a following commit so behavior changes remain reviewable.

Implementation status: R1, R3, R4 and R5 are implemented with regression coverage. R2 remains unchecked until a hosted clean Windows run passes. Browser reliability and live release checks remain open; implementation checkmarks do not mean release approval.

Exit criteria: relevant tests reproduce each old failure and pass with the fix; permissions are enforced server-side; clean Windows CI builds the intended revision; preserved development backup still exists. Complete these before new feature work.

### Phase 2: separate Electron responsibilities

`apps/desktop/src/main.ts` is roughly 2,300 lines and owns persistence, logging, updates, downloads, tray/window state, global input, capture, permissions and IPC. The reason to split it is independent responsibilities and testability, not a line-count target.

- [x] R6: Extract diagnostic logging/retention and preference persistence first. Keep startup order and failure handling unchanged; use atomic replacement for preference/secret files where appropriate.
- [x] R7: Extract updater lifecycle and download handling separately, with explicit registration/disposal functions. Test repeated initialization, window closure, cancellation and duplicate events.
- [x] R8: Extract native input/PTT and application-audio child-process ownership. Each module owns its listeners/processes and releases them on quit, reload and failure.
- [x] R9: Keep main as startup orchestration; group IPC registration by the module that owns the operation, retaining explicit sender and payload checks. Update security tests alongside extraction so the current source-text checker does not become misleading.
- [x] R10: Consolidate the desktop bridge type contract, then typecheck client/preload/main together.

Implementation status: R6-R10 are implemented in focused local commits. All 2,164 repository tests, static IPC checks, Windows packaging, and real packaged preload/IPC smoke checks passed. Background PTT, audible capture and installed-update acceptance remain manual release checks; Phase 1 browser reliability and hosted Windows CI gates remain open.

Exit criteria: packaged startup and desktop security checks pass; no duplicate IPC handlers/listeners; background PTT, capture stop and update/download behavior remain unchanged. Land one responsibility at a time with no new behavior mixed into extraction.

### Phase 3: make voice lifecycle testable

The roughly 1,850-line `components/voice-provider/index.tsx` already has useful hooks. Extend those seams. Upstream has the same concern in [#642](https://github.com/Sharkord/sharkord/issues/642).

- [x] R11: Document ownership of tracks, producers, consumers, audio contexts/worklets, native capture processes and subscriptions. Add tests for partial startup failure, repeated cleanup and late async completion after leaving/switching servers.
- [x] R12: Extract microphone processing and desktop screen-capture orchestration into focused local hooks. Keep mediasoup transport ownership in `use-transports` and browser-safe desktop access in `platform`.
- [x] R13: Consolidate session teardown/recovery around existing connection status and cleanup hooks. Introduce a session-generation guard only where tests demonstrate stale async completions; do not add a state-machine library by default.
- [x] R14: Reproduce [#849](https://github.com/Sharkord/sharkord/issues/849) with a lost WebSocket session and surviving/stale transport state. Existing SandShark transport recovery rebuilds transports, so [#552](https://github.com/Sharkord/sharkord/issues/552)'s older claim of no reconnect logic is not accurate for this branch. Distinguish transport recovery from rejoining a server-side voice session that no longer exists.
- [x] R15: Define what recovery restores. Preserve mute/deafen and device choice; do not silently restart screen capture without an explicit policy. Verify permission loss and kick/ban cannot trigger rejoin loops.

Implementation: ownership and recovery policy are documented in [DEVELOPMENT.md](DEVELOPMENT.md#voice-resource-ownership-and-recovery). Regression tests reproduce missing server membership with stale transports and reject late capture/transport completions. R14 is a deterministic reproduction of the failure class, not confirmation of the reporter's exact live network/browser conditions. R15 policy and automated rejection/no-rejoin cases are implemented.

- [ ] Phase 3 live exit gate: real two-participant tests under disconnect/reconnect, sleep/resume, permission loss, device removal and repeated capture start/stop. Confirm audible send/receive, mute/deafen and device preservation, no automatic screen restart and no rejoin loops. Browser mocks cannot establish audible correctness. See [PHASE_THREE_REPORT.md](PHASE_THREE_REPORT.md).

### Phase 4: calendar and client maintenance

- [ ] R16: Split calendar routes into `get-events.ts`, `create-event.ts`, `delete-event.ts`; compose only in `index.ts`. Move reusable reads to `db/queries`; keep domain writes and their required side effects together. Preserve existing organizer/invite semantics unless explicitly changed.
- [ ] R17: Add SQL visibility filtering and bounded pagination, then update the calendar client. Assess existing indexes before generating a new migration. Never rewrite migrations 0018-0020.
- [ ] R18: Remove confirmed dead notification helpers, resolve touched hook dependency/lint warnings and add server-profile-switch regression cases. Run Knip as an audit; review its findings before deleting exports or dependencies.
- [ ] R19: Update `docs/upstream-compatibility.md` to describe pinned release integration and actual branch policy. Its current `merge upstream/development` instructions differ from the release-pinned approach just used. Replace the generic roadmap placeholders with this prioritized backlog.
- [ ] R20: Add a bounded test-artifact retention workflow with dry-run output and explicit exclusions for development data/backups. Preserve final validation evidence until release verification.

## Upstream issue shortlist

Statuses below reflect the October 26 GitHub query. Open issues are proposals/reports, not proof that SandShark reproduces each bug. Recheck linked PR state and review changes before adopting; none of these open PRs is an approved backport merely because it claims passing tests.

| Priority | Issue / existing work | SandShark decision and acceptance criteria |
| --- | --- | --- |
| P0 | [#889: file access report](https://github.com/Sharkord/sharkord/issues/889) | Investigate/fix first using local fixtures; enforce the agreed private-asset policy. No open matching PR was present in the five-PR snapshot. |
| P1 | [#869: camera permission revocation](https://github.com/Sharkord/sharkord/issues/869), [open PR #886](https://github.com/Sharkord/sharkord/pull/886) | Review and adapt promptly. Include screen sharing, failure cleanup and authoritative server enforcement; verify capture indicator and remote producer both stop. |
| P1 | [#852: expiring signed media](https://github.com/Sharkord/sharkord/issues/852), [#832: emoji expiry](https://github.com/Sharkord/sharkord/issues/832) | Implement after file authorization. Test an already-open conversation across expiry, sleep/resume, permission revocation and server switching. The issue links a contributor branch, not a merged fix. |
| P1 | [#849: reconnect desync](https://github.com/Sharkord/sharkord/issues/849), [#642: VoiceProvider refactor](https://github.com/Sharkord/sharkord/issues/642) | Align with Phase 3; preserve SandShark's existing recovery improvements and prove which remaining failures reproduce. |
| P2 | [#830: profile upload permissions](https://github.com/Sharkord/sharkord/issues/830), [open PR #887](https://github.com/Sharkord/sharkord/pull/887) | Good focused fix. Local generic upload still requires UPLOAD_FILES. Separate profile-image intent while enforcing actual image validation, ownership, size limits and downstream attachment permissions. Profile uploads must not bypass message restrictions. |
| P2 | [#888: push-to-mute](https://github.com/Sharkord/sharkord/issues/888) | Best desktop-specific feature candidate. Reuse native press/release handling; restore prior mute state rather than unconditionally unmuting. Respect server mute, deafen, focus loss, rebind and disconnect. |
| P2 | [#530: live device switching](https://github.com/Sharkord/sharkord/issues/530) | High user value after lifecycle cleanup. Replace tracks without leaving the channel, release old devices, preserve processing/mute state and recover gracefully when the new device fails. |
| P2 | [#749: mute stream audio by default](https://github.com/Sharkord/sharkord/issues/749) | Small opt-in preference candidate. Distinguish stream audio from participant voice and preserve explicit per-user volume choices; verify existing volume selectors first. |
| P2 | [#785: RTL text rendering](https://github.com/Sharkord/sharkord/issues/785) | Focused accessibility improvement: mixed-direction messages/editor content, links, mentions and code blocks. Test real Persian/Arabic and mixed Latin samples without a wholesale layout rewrite. |
| P2/P3 | [#49: account self-deletion](https://github.com/Sharkord/sharkord/issues/49), [open PR #891](https://github.com/Sharkord/sharkord/pull/891) | Review upstream implementation rather than duplicate it. Audit reauthentication for SSO, owner protection, sessions, plugin side effects and SandShark calendar foreign keys/ownership before adoption. |
| P3 | [#867: generated avatars](https://github.com/Sharkord/sharkord/issues/867), [open PR #877](https://github.com/Sharkord/sharkord/pull/877) | Cosmetic; defer behind reliability. Evaluate whether a new dependency improves enough over existing initials to justify it. |
| Track | [#880: upstream desktop](https://github.com/Sharkord/sharkord/issues/880), [draft PR #885](https://github.com/Sharkord/sharkord/pull/885) | Compare adapter, version compatibility and hotkey designs. Do not wholesale replace SandShark's working Windows capture/updater implementation or run two native input systems. |

Defer [P2P screen sharing #848](https://github.com/Sharkord/sharkord/issues/848): it introduces a second media topology and fallback complexity. Defer [password-locked channels #890](https://github.com/Sharkord/sharkord/issues/890): it adds another access-grant model before existing file authorization is resolved. Keep [incoming webhooks #293](https://github.com/Sharkord/sharkord/issues/293) plugin-first unless core demand is clear. [Mobile push #871](https://github.com/Sharkord/sharkord/issues/871) is outside the Windows desktop focus. Screen-share performance reports [#752](https://github.com/Sharkord/sharkord/issues/752), [#795](https://github.com/Sharkord/sharkord/issues/795) and [#519](https://github.com/Sharkord/sharkord/issues/519) belong in the live capture test matrix; do not apply speculative Chromium flags without reproducing the failure.

## Validation and delivery

For behavior changes, add meaningful regression tests using existing fixtures/helpers. For new/changed routes, cover authorization, validation, settings gates, persistence and promised side effects. Run targeted tests while iterating, then `bun run magic`, `bun run test`, appropriate E2E and desktop package/security checks before each release candidate. Run translation synchronization for touched strings and database consistency/backup upgrade checks for any new migration.

Pure extractions should preserve observable behavior and pass existing tests. Do not write tests that merely restate code structure. Record the exact tested commit, platform and manual gaps. Resolve the current integration's live release gates before claiming production readiness.

Recommended first batch: R1 file authorization, R2/R3 reproducible release checks, R4 voice cleanup and R5 calendar safety. Then extract Electron responsibilities and voice lifecycle in separate changes. Add push-to-mute and live device switching once those boundaries are stable.

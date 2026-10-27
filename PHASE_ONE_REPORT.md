# Phase 1 implementation and validation

October 26, 2026. Code commit: `1f2274a5` on local branch `fix/phase-one`, based on integrated Sharkord v0.0.28 at `b355c87a`. Worktree: `.integration/sharkord-v0.0.28`. No push, publication, deployment or root-checkout merge was performed.

## Implemented

- R1: private attachments require a separately signed media credential plus current channel visibility or DM membership. Anonymous callers, unrelated channels and non-member DMs receive 404. Bans, token-version changes and permission revocation are checked on each request. Private responses use `private, no-store`; range delivery, encoded names, downloads and existing file-signature validation remain covered.
- R2: `global.json` pins .NET 10.0.403 with latest-patch roll-forward. Desktop CI, release and signing consume it. Packaging explicitly uses Node 22 because Electron Builder's icon converter stalled under Bun's Node shim. A native clean and local Windows package build passed. A hosted clean-runner build has not been performed, so R2's final validation remains open.
- R3: release jobs resolve the requested revision once, pass its SHA to reusable CI and packaging, and include `BUILD_COMMIT.txt` in release assets. These workflow changes were parsed and reviewed locally, not executed on GitHub.
- R4: disconnected-client errors release voice-control busy flags; failed capture starts release resources; safe stop/mute transitions remain allowed after permission loss. Permission publishers close revoked producers server-side, and producer creation rechecks access after asynchronous creation. Client state follows authoritative stop events. Regression tests cover these paths, including the producer-creation race.
- R5: calendar event and invitation creation is one synchronous transaction. Seeded tests cover visibility, authorization, input bounds, duplicate and invalid invite targets, rollback, deletion ownership and cascades. Calendar pagination, rate limiting and route splitting remain later-phase work.

## Attachment policy and compatibility

Deploy the patched client and server together. Older clients cannot fetch private attachments from the patched server. Logo, avatar, banner and emoji references intentionally classify a file as a public asset; existing signed-URL requirements still apply except for the logo. A file also referenced by a public asset is treated as public.

The media credential is a seven-day, read-only bearer credential for the user's currently accessible attachments, not a per-file ticket. It is separate from API login credentials and cannot authenticate an API session. The client keeps it in memory and binds it to the current server/session. Join/reconnect renews it; there is no automatic refresh for an uninterrupted session longer than seven days. Copied attachment URLs contain this credential and must be treated as credentials. Logout clears client access but does not independently revoke a copied token; server token-version revocation does. Existing signed-file expiry refresh remains deferred.

## Validation

- `bun run magic`: passed, existing lint warnings only.
- `bun run test`: 2,147 passed, zero failures (desktop 15, shared 216, client 156, server 1,760).
- Frozen-lockfile installation, desktop security check, database migration consistency and translation synchronization passed. No schema migrations or new translations were needed.
- Server build passed for Windows x64, Linux x64, Linux arm64 and macOS arm64. These are build results, not runtime verification on all platforms.
- Windows native clean, final desktop package and isolated-profile packaged startup smoke test passed.
- Two complete E2E runs each had 52 passed, one failed and one intentionally skipped. The first failed on a thread reply hover control; the second passed that case but failed the external-media bottom-scroll assertion (340 px from bottom versus a 120 px threshold). This is not a clean browser-suite result. The media fixture uses external image/video hosts. No test thresholds or assertions were weakened.
- Focused traced browser repetition: 32 passed and one failed across three repetitions of the scroll/thread files. The media-scroll case reproduced at 289 px from bottom; all repeated thread cases passed. Failure trace is retained under `packages/e2e/test-results/scroll-position.pw.ts-a-ch-15a2c--the-bottom-and-stays-there-chromium-repeat1/trace.zip`. Root cause is not established; browser release validation remains open.
- Preserved development backup: all 35 recorded file hashes verified unchanged. Tests used isolated data; no development database reset or migration was performed.

Evidence is retained in root `.integration/phase-one-*.log`, including `phase-one-tests-final.log`, `phase-one-magic-final.log`, `phase-one-package-final.log`, `phase-one-server-build.log`, `phase-one-packaged-startup-final.log`, `phase-one-e2e.log`, `phase-one-e2e-final.log` and `phase-one-e2e-repeat.log`.

## Artifacts and remaining release checks

Unsigned desktop candidate: `.integration/sharkord-v0.0.28/apps/desktop/release/SandShark-1.1.1-Setup-x64.exe`.

SHA256: `2F896085E3033AA56E74530FC4C2F1193693A979E5B90B2E14C3718147B7A614`.

Matching server builds are in `.integration/sharkord-v0.0.28/apps/server/build/out`. The server package version remains upstream 0.0.28; identify this patched build by commit, not that version alone. Previous 1.1.0 installer artifacts remain available.

Before release, complete hosted Windows CI, browser failure diagnosis, two-participant camera/screen permission-revocation and capture-indicator checks, real-provider SSO, application audio/exclusion, background push-to-talk, server switching, installed updater and plugin compatibility checks. Decide signing policy before distribution. This candidate is not marked production-ready.

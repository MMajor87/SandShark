# Upstream Compatibility

SandShark follows the upstream Sharkord client where possible. Desktop behavior
is added through small platform adapters and the Electron main/preload process,
so upstream client changes remain easy to review and merge.

## Code Boundaries

- Electron lifecycle, IPC, window management, updates, tray behavior, and
  native input handling belong in `apps/desktop`.
- Browser-safe platform detection and capability adapters belong in
  `apps/client/src/platform`.
- Shared types and helpers belong in `packages/shared` only when they are
  useful to both the browser and desktop clients.
- The renderer must not import Electron or Node APIs directly.

The desktop-specific renderer integrations are intentionally kept at existing
client seams: routing, settings, notifications, downloads, media capture,
storage, and voice controls. New desktop behavior should use those seams
instead of broad changes to upstream feature code.

## Significant Client Changes

The following behavior changes are desktop-specific and should be reviewed
when synchronizing with upstream:

- Desktop server selection and persisted server sessions in
  `apps/client/src/screens/server-connection` and
  `apps/client/src/helpers/server-session.ts`.
- Desktop routing, deep links, downloads, notifications, and platform
  detection under `apps/client/src/components/routing` and
  `apps/client/src/platform`.
- Desktop media capture and push-to-talk integration under
  `apps/client/src/components/voice-provider` and
  `apps/client/src/helpers/push-to-talk.ts`.
- Desktop settings and window behavior under
  `apps/client/src/components/server-screens/user-settings`.
- Electron lifecycle and native integrations under `apps/desktop/src`.

Avoid formatting-only changes and large renames while syncing upstream. Keep
each desktop adaptation focused and document a new integration here when it
changes browser-visible behavior.

## Pinned release integration and branch policy

SandShark integrates reviewed Sharkord release commits. Do not merge the moving
`upstream/development` branch as an upgrade shortcut. Record both the release tag
and its resolved commit in the integration notes before merging. Tags may not be
present locally; fetch the selected tag explicitly and verify its target.

The current baseline is Sharkord 0.0.28, integrated by merge `00063c66` and validated
at `b355c87a`. Phase branches extend that integrated history: `refactor/phase-one`,
`refactor/phase-two`, `refactor/phase-three` and `refactor/phase-four`. They are local
review branches in `.integration/sharkord-v0.0.28`; the older root checkout is not
the source of the latest candidate. Do not replace its uncommitted changes.

For the next upgrade:

1. Select a released upstream version and inspect its release notes, diff and
   migrations against the last pinned commit. Resolve the tag to a commit and
   retain that value in the review notes. This document does not claim a latest
   upstream release.
2. Start a clean integration branch/worktree from the current integrated SandShark
   branch, not the older root `main` and not an upstream-only checkout.
3. Back up the intended deployment baseline and verify hashes. Preserve development
   data, desktop preferences/secrets, calendar data and existing migration history.
4. Merge the reviewed release commit with upstream ancestry intact. Resolve each
   conflict at its existing platform/domain seam; do not blindly prefer one side.
5. Review the complete diff and test both the client/server contract and desktop
   adaptations. Generate any new migration with Drizzle; never edit committed
   migrations, including SandShark's 0018-0020.
6. Run the checks below and record the exact source commit, package hash, failures
   and live acceptance gaps. A packaged smoke test does not prove audible media.
7. Follow CONTRIBUTING.md: create/reference the required issue before opening a PR,
   and target `main`. Publishing, installation and deployment are separate
   actions; local integration work does not perform them automatically.

Do not place deployment addresses, credentials, secrets or runtime logs in tracked
documentation. Read the phase reports for the current release gates.

## SandShark calendar contract

The calendar is a SandShark extension. Phase 4 changes `calendar.getAll` to accept
`{ limit?, cursor?: { startsAt, id } }` and return `{ events, nextCursor }`, with at
most 50 events per page. Deploy the updated calendar client and compatible server
together. An older array-returning calendar endpoint is not compatible with this
client contract. Upstream-only servers do not gain calendar support from installing
the desktop client.

Visibility is evaluated in SQL for the organizer, direct invitees and current role
members. No new global calendar permission or organizer override is introduced.
An invisible event now produces the same deletion response as a missing event.
The list preserves chronological history as well as future invitations; pagination
does not silently remove past events.

The existing `calendar_events_starts_at_idx` orders by start time with SQLite's
integer-primary-key rowid as the tie breaker. Existing `(event_id, user_id)` and
`(event_id, role_id)` unique indexes support correlated invitation checks, and the
`user_roles(user_id, role_id)` primary key supports membership lookup. No additional
index or migration is needed for this query shape. A SQLite EXPLAIN QUERY PLAN
check against the committed schema confirmed an indexed start-time search, indexed
invitation and membership lookups, and no temporary sorting tree. Reassess against
production data before adding indexes or caches.

## Regression checks

Run `bun run magic`, `bun run test`, `bun run --cwd apps/server db:check`, and
`bun run --cwd apps/desktop check:security`. Run Playwright separately from the
server suite: both start mediasoup on UDP 40000 by default. Use isolated E2E fixture
data, never development data. Build the native helper, desktop main and renderer,
then verify the packaged application through the isolated-profile startup script.

For release readiness, also test two real voice participants, disconnect/reconnect,
sleep/resume, permission loss, device removal, camera/screen capture, application
audio, background PTT, downloads and installed updating. Keep final validation
evidence protected until those gates are verified; see the test-artifact workflow
in DEVELOPMENT.md.

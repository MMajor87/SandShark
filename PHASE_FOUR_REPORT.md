# Phase four implementation report

Branch: `refactor/phase-four`, based on Phase 3 `6c345fd1`. Implementation commit: `338d1c25`. Report finalized October 28, 2026.

## Changes

- R16: calendar procedures now have individual files; the router index only composes them. Reusable reads live in database queries and creation retains a synchronous transaction with cascading deletion.
- R17: SQL evaluates organizer, direct-invite and current-role visibility. Cursor pagination orders by start time and ID, returns at most 50 events, and the translated client supports loading subsequent pages and retrying failures. All eight languages include calendar strings.
- R18: removed only the two confirmed unused notification helpers. Saved-token reads and login completion reject a different selected server profile; regression tests cover isolation and delayed secret operations. Knip findings were reviewed, including test/preload/plugin fixture false positives; dependencies were not blindly removed.
- R19: upstream compatibility now documents pinned release integration, the actual integration branch workflow, calendar contract compatibility and outstanding release gates. The roadmap prioritizes the existing backlog.
- R20: managed test-run retention defaults to dry-run, retains five eligible runs and fourteen days, and caps deletion at twenty runs per invocation. Pending release verification, `.keep`, links, data, backups, binaries and existing `.integration` evidence remain protected. Apply-mode tests operate only on temporary fixtures; no existing project artifacts were deleted.

## Compatibility

`calendar.getAll` now returns `{ events, nextCursor }` instead of an array. Update the SandShark client and server together. Any authenticated member can still organize an event, and only its organizer can delete it. Hidden events now return NOT_FOUND on deletion, avoiding an existence leak. Default read limit is 60 requests per minute; create and delete each allow 20 per minute. Timestamps must fit JavaScript's valid date range.

No migration was added or rewritten. A SQLite query-plan check using the committed schema used the existing start-time, invitation and role-membership indexes without a temporary sort. This verifies the query shape, not production-scale latency.

## Validation

- `bun run magic`: passed formatting, type checks and lint. Existing lint warnings remain; no touched-hook dependency warnings.
- `bun run test`: 2,212 passed, zero failures (server 1,767, client 192, shared 216, desktop 33, scripts 4).
- Playwright Chromium, one worker: 54 passed, one existing mocked test skipped. Calendar pagination, login/session and media-scroll cases passed.
- `bun run synci18n`: all translations up to date.
- `bun run db:check`: passed. Migrations 0018-0020 unchanged.
- Desktop production main/renderer build and static security verification: passed. Existing large renderer chunk warnings remain. No new installer was packaged for this implementation request.
- Artifact retention: four safety tests passed, including apply mode on disposable fixtures; project dry-run returned no eligible runs.
- Preserved development backup: all 35 recorded SHA-256 hashes match.
- Knip audit completed with findings, not a clean result. Confirmed notification dead exports were removed; broader findings remain for separate review.

Evidence is retained under the parent `.integration` directory as `phase-four-*.log`. The browser suite ran after the server suite to avoid their shared UDP port. Validation covered the implementation now recorded as `338d1c25`; subsequent changes are report/TODO documentation only.

## Remaining release gates

The earlier media-scroll browser failure did not reproduce in this run; no media-scroll fix was made, so its intermittent reliability history remains tracked. Hosted clean Windows CI, real-provider SSO, two-participant audible voice/capture, sleep/resume, background PTT, installed updating and signing remain release checks. This implementation does not certify those manual scenarios. Existing release installers and the development backup remain preserved. No release was published or installed.

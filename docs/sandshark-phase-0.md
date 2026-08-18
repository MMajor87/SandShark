# SandShark Phase 0 Notes

## Project Identity

- Project name: SandShark
- Repository: https://github.com/MMajor87/SandShark
- Visibility: private
- Desktop branch: `feature/desktop-client`
- Upstream repository: https://github.com/Sharkord/sharkord
- Upstream baseline branch: `development`
- Upstream baseline commit: `ecea4d3c831e29ab1ad936dd350fc28f6a7e7269`

## Repository Strategy

SandShark is maintained as a private repository with `Sharkord/sharkord` configured as the `upstream` remote. This keeps the project private while preserving a clean upstream baseline for future merges.

## Development Test Server

Use this Sharkord server for development and integration testing:

https://redacted.invalid/

## Phase 0 Verification Log

- Confirmed upstream default branch is `development`.
- Added `upstream` remote for `https://github.com/Sharkord/sharkord.git`.
- Created `feature/desktop-client` from `upstream/development`.
- Recorded the starting upstream commit for future merge and audit work.
- Installed Bun `1.3.14` locally for Sharkord development.
- Ran `bun install` successfully.
- Ran `bun run build` in `apps/server` successfully.
- Ran `bun run build` in `apps/client` successfully.
- Ran `bun run test` from the repository root successfully.
- Smoke-started the server with `bun run dev` in `apps/server`.
- Verified `http://127.0.0.1:4991/manifest.json` returned HTTP 200.
- Smoke-started the browser client with `bun run dev -- --host 127.0.0.1` in `apps/client`.
- Verified `http://127.0.0.1:5173/` returned HTTP 200.

## Manual Verification Still Needed

The following Phase 0 items require browser interaction, user accounts, or media hardware and were not completed by command-line smoke testing:

- Confirm browser client login/connect flow against the local server.
- Confirm text chat works.
- Confirm voice chat works.
- Confirm webcam works.
- Confirm screen sharing works.

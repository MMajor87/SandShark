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

## Upstream Merge Procedure

Run this from a clean working tree on the desktop development branch. Keep
local desktop work committed or stashed before starting the merge.

```bash
git fetch upstream
git checkout development
git merge upstream/development
```

If conflicts occur:

1. Resolve only the affected files, preserving the platform boundary above.
2. Run `git diff --check` and inspect the complete merge diff.
3. Confirm no upstream server address, credentials, local paths, or runtime
   logs were added to tracked files.
4. Commit the merge, then merge or rebase the updated development branch into
   the desktop branch according to the repository's normal branch policy.

## Regression Checks

Run these checks after an upstream merge:

```bash
bun install --frozen-lockfile
bun run --cwd packages/shared check-types
bun run --cwd apps/client check-types
bun run --cwd apps/desktop check-types
git diff --check
```

For connection, routing, or media validation, use the authorized development
server supplied out-of-band. Do not write its address into this repository or
its documentation.

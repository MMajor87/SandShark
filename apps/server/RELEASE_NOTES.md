# SandShark Server 0.1.0

First independently versioned SandShark server release, based on Sharkord 0.0.28
and the SandShark phase-four changes.

- Includes calendar pagination, visibility checks, bounded inputs and rate limits.
- Includes the integrated authentication, media access and voice permission fixes.
- Selects stable `sandshark-server-v*` releases independently of desktop releases.
- Keeps server version changes separate from desktop, client and plugin SDK versions.

## Compatibility and upgrade

Use SandShark Desktop 1.1.2 from the phase-four branch or a subsequent compatible
release. The calendar API returns `{ events, nextCursor }`; older clients expecting
an array must be upgraded with the server. The bundled web client is built from the
same commit as the server.

Stop the server and back up its entire data directory before replacing the binary.
Migrations run automatically at startup. To roll back after a migration, restore
both the previous binary and its data backup. Do not run an older binary against
the migrated database.

Existing servers whose updater uses GitHub's repository-wide latest release need
one manual upgrade to this build. Subsequent server updates select server tags.
Docker installations update by replacing the container and retaining the data volume.

Assets support Linux x64/arm64, Windows x64, and macOS arm64. The `sharkord-*`
filenames and configuration identifiers are retained for compatibility.
`release.json` includes SHA-256 checksums; `BUILD_COMMIT.txt` identifies the source.

The versioned container image is `ghcr.io/mmajor87/sandshark-server:0.1.0`.
The release workflow publishes this image but does not move a `latest` image tag.

## Publication checks

The workflow builds a draft after repository checks and E2E tests succeed. Before
publishing it, verify the paired desktop/server calendar, a real two-user voice
session, reconnect and capture, and backup/upgrade on the intended deployment.
Keep the GitHub release's **Set as latest release** option disabled so older desktop
updaters continue to find the desktop installer. Windows binaries are unsigned.

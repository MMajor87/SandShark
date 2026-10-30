# SandShark Server 0.1.1

- Adds account self deletion with password confirmation. Deleting an account removes its calendar events and invitations.
- Includes fixes for private media access after permission changes, profile image uploads, and voice capture teardown.
- Builds the bundled web client from the same source revision as the server.

## Compatibility and upgrade

Use SandShark Desktop 1.1.3 with this server. Stop the server and back up its entire data directory before upgrading. Migrations run automatically at startup. To roll back after a migration, restore both the previous binary and its data backup.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, plus the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.1.1`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

# SandShark Server 0.1.0

First independently versioned SandShark server release, based on Sharkord 0.0.28
and the SandShark phase-four changes.

- Includes calendar pagination, visibility checks, bounded inputs and rate limits.
- Includes the integrated authentication, media access and voice permission fixes.
- Selects stable `sandshark-server-v*` releases independently of desktop releases.
- Keeps server version changes separate from desktop, client and plugin SDK versions.

## Compatibility and upgrade

Use SandShark Desktop 1.1.2 or a subsequent compatible release. The calendar API returns `{ events, nextCursor }`; older clients expecting
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

## Release verification

- Full local suite: 2,228 passed. Hosted CI, Windows desktop CI and server release
  workflow passed. Hosted browser tests: 54 passed, one existing mocked test skipped.
- The exact downloadable Windows binary passed its SHA-256 check and reported
  server version 0.1.0 after startup.
- Two isolated Chromium users passed calendar pagination, two-way audio with
  nonzero decoded audio energy, mute/unmute, repeated screen sharing, camera video,
  capture track teardown, server restart, explicit voice rejoin and disconnect.
  Remote video frames were decoded through the real mediasoup SFU.
- A disposable 0.0.25 database upgraded successfully. Users, messages and calendar
  entries were preserved; SQLite integrity and foreign-key checks passed. Migration
  0020 applied once, and restarting did not change the migrated data. Restoring the
  full backup allowed the 0.0.25 binary to boot with the original data and schema.
- Uploaded binary sizes and SHA-256 digests match release.json. Anonymous GHCR
  manifest access confirms Linux amd64 and arm64 images for tag 0.1.0.

Media checks used synthetic microphone/camera input and a generated screen stream
on Windows loopback. Physical device capture, application/system audio capture,
WAN traversal, sleep/resume and Linux/macOS runtime behavior were not exercised in
this release check. No existing deployment or user data was used. Windows binaries
are unsigned. Back up your own deployment before upgrading.

The desktop release remains GitHub's Latest release for compatibility with older
installed desktop updaters.

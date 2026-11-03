# SandShark Server 0.3.0

- Adds a soundboard. Admins upload short sounds (MP3, OGG, WAV or WebM, up to 1 MB and 10 seconds, at most 50 per server) and people in a voice channel play them for everyone in it.
- Adds two role permissions: "Use the soundboard", on for the default role, and "Manage soundboard". On first start, roles that can send voice reactions get "Use the soundboard" and roles that can manage emojis get "Manage soundboard".
- Playing a sound needs the right to speak in the channel and is rate limited.

## Compatibility and upgrade

Use SandShark Desktop 1.2.0 with this server. Upgrade the server first: Desktop 1.2.0 cannot connect to an older server, while Desktop 1.1.7 keeps working with this one, without the soundboard. Stop the server and back up its entire data directory before upgrading. Migrations run automatically at startup. No configuration changes are needed.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, plus the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.3.0`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

# SandShark Server 0.2.0

- Renames the server's remaining old project identifiers to SandShark.
- Removes the plugin marketplace and the install and update plugin routes. To add a plugin, copy its folder into the `plugins` folder in the server's data directory.

## Upgrade steps

- Environment variables are now `SANDSHARK_*`, for example `SANDSHARK_HOST`, `SANDSHARK_PORT`, `SANDSHARK_WEBRTC_ANNOUNCED_ADDRESS`, `SANDSHARK_OIDC_CLIENT_SECRET` and `SANDSHARK_DATA_PATH`. The old names are no longer read, so rename them in your Docker or service configuration before upgrading.
- The default data folder is now `sandshark` (for example `/home/bun/.config/sandshark` in Docker). On first start the server moves the old folder to the new name. If the old folder cannot be moved, the server keeps using it and logs a warning.
- Docker: change the volume mount to `-v sandshark-data:/home/bun/.config/sandshark`. A volume still mounted at the old path keeps working but cannot be moved from inside the container.
- Release binaries are now named `sandshark-linux-x64`, `sandshark-linux-arm64`, `sandshark-windows-x64.exe` and `sandshark-macos-arm64`. Update any install scripts that download them by name.
- The version header is now `X-SandShark-Version`.

## Compatibility and upgrade

Use SandShark Desktop 1.1.7 with this server, and upgrade both together: the storage usage metric and the plugin routes changed on both sides. Stop the server and back up its entire data directory before upgrading. Migrations run automatically at startup. Plugins built against the older plugin SDK need rebuilding against `@sandshark/plugin-sdk`.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, plus the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.2.0`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

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

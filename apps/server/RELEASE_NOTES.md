# SandShark Server 0.6.1

- Updates the web client the server serves to browsers to SandShark 1.6.0: an Appearance tab with light, dark or system theme and an accent color, the open view highlighted in the sidebar and in settings, grouped settings menus, X posts sized to fit with no scrollbar and shown in the client's theme, and no more brief freeze when the window takes focus. See the desktop release notes for the details.
- The server itself is unchanged from 0.6.0.

## Compatibility and upgrade

Use SandShark Desktop 1.6.0 with this server. Desktop 1.5.0 and 1.4.0 keep working with it. There are no database migrations and no configuration changes. Back up the server's data before upgrading, as always.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, the Windows setup, the Linux install script, and the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.6.1`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

# SandShark Server 0.6.0

- **Windows service install.** `sandshark-server-0.6.0-setup-x64.exe` installs the server as a Windows service, so it starts with the computer and runs without anyone signed in. It runs as the built-in LocalService account and is restarted after a crash or an update. The installer can add the firewall rules, and adds Start Menu shortcuts to the monitor and to start, stop and restart the server. A tray icon shows the server's state. See [the Windows server install](https://github.com/MMajor87/SandShark/blob/main/docs/windows-server-install.md).
- **Linux service install.** `sandshark-install-linux.sh` installs this release as a hardened systemd service on x64 and arm64, running as its own `sandshark` user. See [the Linux server install](https://github.com/MMajor87/SandShark/blob/main/docs/linux-server-install.md).
- **Server monitor.** Every server serves a status page at `http://localhost:4991/monitor` to its own machine. It shows whether the server is up, its version, uptime, memory and CPU, who is online, the active voice channels, the hosted bots and the end of its log. Scripts can read the same data from `/monitor/status`. It has no login, so it is never served to other machines or through a reverse proxy. Set `SANDSHARK_MONITOR=false` to turn it off. See [the server monitor](https://github.com/MMajor87/SandShark/blob/main/docs/server-monitor.md).
- **Updates in Docker.** **Update Server** now works in Docker. The new version is installed into the data volume, and the container's restart policy starts it. Pulling an image that is at least as new takes over again. `SANDSHARK_AUTOUPDATE=true` now applies in Docker too.
- Under the systemd install, the server replaces its own binary when it updates and systemd restarts it.

## Compatibility and upgrade

Use SandShark Desktop 1.5.0 with this server. Desktop 1.4.0 keeps working with it, and Desktop 1.5.0 works with Server 0.5.0. Back up the server's data before upgrading. This release has no database migrations, and no configuration changes are needed.

Docker servers need a restart policy, such as `--restart unless-stopped`, to come back after **Update Server**. Without one, start the container again yourself. After such an update the container runs the newer version whatever its image tag says, and the Updates screen shows which version is running.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, the Windows setup, the Linux install script, and the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.6.0`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

# SandShark Server 0.5.0

- Hosted bots can be written in Python. A folder with no JavaScript entry point runs from `main.py`, or else `bot.py`, and its `requirements.txt` (or else `pyproject.toml`) is installed with pip into a `.venv` in the bot's folder. discord.py and its forks, hikari, and bots that use `requests`, `httpx` or `websockets` directly are pointed at this server. This needs Python 3 with its `venv` module on the server; the Docker image does not include Python.
- Hosted JavaScript bots can run on Node.js instead of Bun, set per bot under **Runtime**, for packages with native add-ons that Bun cannot load. This needs Node.js 20 or newer on the server; the Docker image does not include Node.js.
- A running hosted bot shows its memory and CPU use next to its status, on Linux servers, which includes the Docker image.
- **Start from a ping bot** writes a small discord.js bot with a `/ping` command into a hosted bot that has no code yet, to try hosting without a bot of your own.
- Starting, stopping and restarting a hosted bot, changing its code, source, runtime or variables, and installing its dependencies are now recorded in the activity log.

## Compatibility and upgrade

Use SandShark Desktop 1.4.0 with this server. Upgrade the server first: Desktop 1.3.0 keeps working with this server, without the new hosting controls. Stop the server and back up its entire data directory before upgrading. Migrations run automatically at startup. No configuration changes are needed.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, plus the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.5.0`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

# SandShark Server 0.4.0

- Adds bot accounts and a Discord compatible bot API (REST v10 and the gateway). A bot written with discord.js or discord.py runs against SandShark by pointing it at this server, with no code changes. See [the bots guide](https://github.com/MMajor87/SandShark/blob/main/docs/bots.md) for what is supported.
- Bots can register slash commands and answer them with replies, deferred and ephemeral answers, embeds, buttons, select menus, modals and autocomplete.
- Adds bot hosting, off by default. With it turned on, people with the new "Host bots" permission can give a bot's code to the server, as a zip or a public GitHub repository, and the server runs it, restarts it when it crashes and shows its log. An unmodified Discord bot works as is: its Discord traffic is pointed at this server, and every other connection to Discord is refused. Hosted code runs as the server's own user, with no sandbox, so only run code you trust.
- Each bot gets a compatibility report of the Discord calls it made that SandShark does not support yet.
- Adds two role permissions, both given to the owner role only: "Manage bots" and "Host bots".
- Calendar events can now be edited, and invitees can answer going, maybe or can't go.
- Fixes the screen share button flipping back to "Start screen share" while sharing, when the camera was turned on just before.

## Compatibility and upgrade

Use SandShark Desktop 1.3.0 with this server. Upgrade the server first: Desktop 1.3.0 cannot connect to an older server, while Desktop 1.2.0 keeps working with this one, without the bot features. Stop the server and back up its entire data directory before upgrading. Migrations run automatically at startup. No configuration changes are needed. Bot hosting stays off until an owner turns it on in Server settings, Bots.

The release publishes Linux x64/arm64, Windows x64, and macOS arm64 binaries, plus the versioned Docker image `ghcr.io/mmajor87/sandshark-server:0.4.0`. The workflow does not move a `latest` image tag. The desktop release remains GitHub's Latest release for desktop updater compatibility.

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

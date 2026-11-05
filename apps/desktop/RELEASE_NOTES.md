# SandShark 1.6.0

- Adds an **Appearance** tab to user settings. Choose a light, dark or system theme (the system theme now follows Windows while the app is open), and one of nine accent colors.
- The open view stands out in the sidebar: direct messages, threads, the calendar or the selected channel get the accent color, with a bar on the left edge.
- The user and server settings menus are grouped under headings, the open page is highlighted the same way, and settings follow the chosen theme instead of always being dark. **Delete account** moves to the end of the account group and is shown in red.
- X posts in messages are sized to the post, so there is no scrollbar inside them, and open in the app's light or dark theme.
- Fixes a brief freeze when the window takes focus, for example when clicking its title bar: every image and video in loaded channels was being fetched again.

## Upgrade notes

This version works with SandShark Server 0.5.0 and later. Desktop 1.5.0 updates itself to this version. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.5.0

- On a server that runs in Docker, the Updates screen in server settings explains that **Update Server** installs the new version into the data volume and restarts the container, and shows how to update by hand instead.

## Upgrade notes

This version works with SandShark Server 0.5.0 and 0.6.0. Desktop 1.4.0 updates itself to this version. The Windows installer does not deploy a server; the server has its own Windows setup from Server 0.6.0. This installer remains unsigned.

# SandShark 1.4.0

- The bot Hosting panel gets a **Runtime** choice for JavaScript bots (Bun or Node.js), memory and CPU use for a running bot, and a **Start from a ping bot** button for a bot that has no code yet.
- Python bots can be hosted, on servers that have Python installed.

## Upgrade notes

This version is meant for SandShark Server 0.5.0, so upgrade the server first: on Server 0.4.0 the new hosting controls fail. Desktop 1.3.0 updates itself to this version. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.3.0

- Adds bots. Create and manage them from the new Bots tab in server settings. Bots show with a Bot badge, their slash commands appear in the message box's `/` menu, and their answers can carry embeds, buttons, select menus and forms. Answers only you can see are shown below the channel until you dismiss them.
- Adds a Hosting panel for each bot, for servers that run bots themselves: start, stop and restart, upload its code or point it at a GitHub repository, set its variables, and follow its log and compatibility report.
- Puts the calendar in the sidebar, next to direct messages and threads, with a badge for unanswered invitations. Answer going, maybe or can't go, and edit events you organize.
- Adds right click menus to messages (reply, reply in thread, copy text or link, pin, edit, delete), to members and voice users (direct message and moderation), and to direct messages (close). Text fields get a native cut, copy, paste and spellcheck menu. A right click release no longer picks the menu item under the pointer.
- Upgrades Electron from 39 to 45.

## Upgrade notes

This version needs SandShark Server 0.4.0 and shows as disconnected on an older server, so upgrade the server before installing it. Desktop 1.2.0 updates itself to this version. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.2.0

- Adds a soundboard. Play a server's sounds from the new soundboard button in the voice controls; everyone in the voice channel hears them and sees the sound's emoji on your voice card. Set how loud sounds play for you, or turn them off, under Notifications in your settings.
- Adds a Soundboard tab to server settings for admins to upload, rename, preview and delete sounds and choose their emoji.
- Fixes automatic updates. SandShark now checks for updates when it starts and asks before installing a new version; earlier versions never checked.

## Upgrade notes

Install this version manually: versions up to 1.1.7 cannot update themselves, so this one release has to be downloaded from GitHub. Automatic updates work from this version on.

This version needs SandShark Server 0.3.0 and shows as disconnected on an older server, so upgrade the server before installing it. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.1.7

- Renames the remaining old project identifiers to SandShark. Saved servers, logins and settings carry over automatically on first start.
- Removes the plugin marketplace. Server admins install plugins by copying them into the server's plugins folder.
- Drops the legacy deep link scheme; links use `sandshark://`.
- Removes the Bridge docs link from the hotkey settings.

## Upgrade notes

Upgrade the paired SandShark server to 0.2.0 at the same time: the storage usage metric and the plugin routes changed on both sides. Plugins built against the older plugin SDK need rebuilding. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.1.6

- Stops screen share audio from ever falling back to whole system capture, which could include SandShark's own voice playback.
- Shares SandShark's own windows as video only, since their audio would carry the voice call.
- Keeps sharing video when application audio cannot start, and tells the sharer when screen audio stops mid share.
- Supports application audio capture on Windows 10 version 2004 and later.
- Keeps screen share audio in sync with the video and smooths out short audio dropouts.
- Logs which processes each audio capture includes, to help diagnose audio leaking into a share.

## Upgrade notes

No server changes. Keep the paired SandShark server on 0.1.1. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.1.5

- Checks for updates when SandShark starts and asks before downloading a new version.
- Asks to restart once an update has downloaded, or installs it the next time SandShark closes.
- Manual checks from Desktop settings keep showing their result in settings without a prompt.

## Upgrade notes

No server changes. Keep the paired SandShark server on 0.1.1. The Windows installer does not deploy a server. This installer remains unsigned. Clients on 1.1.4 or earlier update to this version silently; the prompt appears from the following update onward.

# SandShark 1.1.4

- Adds a server rail on the left of the desktop client for switching between saved servers, with an add server button.
- Moves search, the member list toggle and voice controls into each channel header, and keeps them available in narrow windows.
- Groups the member list into online and offline sections.
- Refreshes the dark theme with layered surfaces and fixes light scrollbars appearing in the dark app on Windows light themes.

## Upgrade notes

No server changes. Keep the paired SandShark server on 0.1.1. The Windows installer does not deploy a server. This installer remains unsigned.

# SandShark 1.1.3

- Adds account self deletion with password confirmation and removes the user's calendar events and invitations.
- Improves desktop updater behavior so the auto install preference is respected.
- Fixes mixed direction message text rendering and makes incoming screen share audio muted by default.
- Allows active voice devices to be changed without rejoining and strengthens reconnect, capture, and media access handling.

## Upgrade notes

Upgrade the paired SandShark server to 0.1.1. The Windows installer does not deploy a server. Back up server data before upgrading. This installer remains unsigned.

# SandShark 1.1.2

- Separates desktop logging, persistence, updates, downloads, native input and capture ownership, with bounded diagnostic logs and behavioral IPC tests.
- Improves voice teardown and recovery, rejecting stale capture/transport completion after leaving or switching servers. Recovery preserves mute/deafen and device preferences without automatically restarting screen sharing.
- Adds SQL-filtered calendar pagination, translated calendar controls in all eight languages, and organizer/invitation access regression coverage.
- Prevents delayed saved-login operations from installing a token into another selected server profile.
- Adds safe, dry-run-first test-artifact retention and updates the integration roadmap.

## Upgrade notes

Upgrade the paired SandShark server and client together. Calendar listing now returns paginated results and is incompatible with the older array-returning endpoint. The source tag includes the compatible server; this Windows installer does not deploy a server. Back up server data before upgrading. Existing migrations are preserved, with no new migration in phase four.

## Validation and limitations

The implementation passed 2,212 repository tests, 54 browser tests (one skipped), formatting, lint, type checks, translation synchronization, database consistency checks and production builds. The previously intermittent media-scroll test passed this run; no media-scroll fix is claimed.

This Windows installer is unsigned. Real-provider SSO, live two-participant audio/capture, sleep/resume, background PTT and installed updating still require manual acceptance.

# SandShark 1.1.1

- Protects message attachments with current channel and DM access checks, including permission revocation. The paired Phase 1 server and client are required for authenticated attachment URLs.
- Fixes voice controls remaining busy during reconnect and releases camera/screen capture after failed startup or permission revocation.
- Makes calendar event/invitation creation atomic and adds route regression coverage.
- Pins the native build SDK and validates/packages the same resolved release commit.

Private attachment URLs now carry a read-only media credential. Treat them as credentials; do not publish them. File signatures alone no longer grant private attachment access. Logos, profile images and emoji retain their existing asset policy. Revoking a user session or banning the user invalidates their media credential.

This installer remains unsigned. Live two-participant capture, real-provider SSO and installed updater validation remain release gates.

# SandShark 1.1.0

- Integrates Sharkord v0.0.28 security fixes, role mentions, thread following, channel notification settings, voice reactions and plugin SDK extensions.
- Adds configurable browser hotkeys while retaining native desktop push-to-talk and capture controls.
- Preserves per-server notification preferences and supports invites in desktop SSO login.
- Preserves calendars and upgrades existing databases through migration 0020.
- Improves Windows file moves when antivirus or indexing temporarily locks a file.

## Validation and upgrade

Automated validation passed: 2,119 unit/integration tests, 53 browser E2E tests (one intentional skip), formatting, lint, types, builds and packaged Windows startup. A development backup passed upgrade, repeat migration and rollback rehearsals.

Upgrade the server to the bundled v0.0.28 integration before using this client. Older server combinations have not been verified. Back up the database, uploads, configuration and plugin data first. Rollback requires the previous server build and its pre-upgrade backup.

Live multi-participant voice, real identity-provider login, installed updater flows and third-party plugin compatibility remain release checks. This Windows installer is unsigned.

# SandShark 1.0.31

- Shows minimized fullscreen applications in the stream source picker and restores the selected window for capture.
- Updates client labels, translations, default icons, and support links to SandShark while preserving custom server branding.
- Enables automatic update downloads by default. Existing saved preferences are preserved; downloaded updates install when the app exits.
- Points the bundled server updater at the SandShark repository. Server updates still require matching server release assets.

## Validation

Formatting, lint, type checks, and the full test suite passed. The capture and branding changes also passed native capture checks, connection E2E tests, and packaged startup checks before this version bump.

This Windows installer is unsigned.

## Previous release: 1.0.30

- Integrates Sharkord v0.0.25, including the redesigned settings, plugin framework, authentication/session protections, voice statistics and screen-share cursor controls.
- Preserves SandShark's calendars, saved servers, desktop settings, downloads and profile fixes.
- Adds native whole-screen audio capture excluding the SandShark process tree, plus capture levels, outbound audio statistics and playback-error diagnostics.
- Adds desktop OIDC login and retains server-side client error reporting.
- Fixes browser auto-login compatibility and retains the username after logout while clearing credentials.

## Upgrade notes

Back up the server database, uploads, configuration and plugin data before upgrading. The merged server preserves SandShark's calendar migration and applies upstream database changes in a new migration. Existing plugins must be checked against the v0.0.25 SDK. Database rollback requires the previous build and its pre-upgrade database backup.

## Validation and limitations

The merge passed unit tests, builds, a database-copy upgrade rehearsal and packaged startup. The browser suite passed with one media-scroll check requiring retries. Real identity-provider login and second-participant audio/exclusion checks remain unverified; the new diagnostics help investigate those paths, but audible correctness is not yet confirmed.

This Windows installer is unsigned. Verify its SHA256 checksum before installation.

# SandShark Desktop Fork - Development TODO

## Project Goal

Create a Windows desktop client, SandShark, that reuses the existing React/TypeScript frontend while adding desktop-native functionality through Electron.

The desktop client should:

- Reuse as much of the existing Sharkord web UI as possible
- Continue using the existing Sharkord server
- Support text chat, voice, video, and screen sharing
- Package the frontend locally instead of loading the UI from the server
- Allow users to connect to self-hosted Sharkord servers
- Provide Windows-native features such as:
  - System tray support
  - Native notifications
  - Global push-to-talk
  - Start with Windows
  - Minimize to tray
  - Taskbar indicators
  - Desktop screen/window capture
  - Automatic updates
- Preserve the browser client as a supported frontend
- Keep desktop-specific code isolated from the shared web client wherever possible

---

# Phase 0 - Fork and Development Environment

Status: In progress. SandShark is using a private repository with `Sharkord/sharkord` configured as `upstream`, rather than a public GitHub fork, so the project can remain private for now.

## Repository Setup

- [x] Fork `Sharkord/sharkord`
- [x] Clone the fork locally
- [x] Confirm the `development` branch is the correct baseline
- [x] Add the upstream Sharkord repository as a Git remote

Example:

```bash
git remote add upstream https://github.com/Sharkord/sharkord.git
```

- [x] Confirm remotes

```bash
git remote -v
```

- [x] Create a dedicated desktop-development branch

Example:

```bash
git checkout -b feature/desktop-client
```

- [x] Confirm the existing Sharkord project builds successfully before making changes
- [x] Confirm the existing server starts successfully
- [x] Confirm the existing browser client starts successfully
- [ ] Confirm the existing browser client connects to the local server
- [ ] Confirm text chat works
- [ ] Confirm voice chat works
- [ ] Confirm webcam works
- [ ] Confirm screen sharing works
- [x] Document the baseline Sharkord version/commit used to start the fork

---

# Phase 1 - Understand Existing Client Architecture

## Client Audit

- [x] Document the structure of `apps/client`
- [x] Identify the main React application entry point
- [x] Identify routing logic
- [x] Identify login/authentication flow
- [x] Identify server URL handling
- [x] Identify WebSocket initialization
- [x] Identify tRPC client initialization
- [x] Identify mediasoup initialization
- [x] Identify voice-provider architecture
- [x] Identify device-provider architecture
- [x] Identify screen-sharing logic
- [x] Identify notification handling
- [x] Identify persistent storage usage

## Browser API Audit

Search the client for direct usage of:

- [x] `window`
- [x] `document`
- [x] `navigator`
- [x] `navigator.mediaDevices`
- [x] `getUserMedia`
- [x] `getDisplayMedia`
- [x] `localStorage`
- [x] `sessionStorage`
- [x] `Notification`
- [x] `Clipboard`
- [x] `AudioContext`
- [x] `AudioWorklet`
- [x] File picker APIs
- [x] Drag-and-drop file APIs
- [x] Browser download APIs
- [x] Browser URL handling
- [x] Browser history APIs

## Desktop Compatibility Classification

For each browser-specific API, classify it as:

- [x] Works unchanged in Electron
- [x] Requires Electron configuration
- [x] Should be replaced by Electron functionality
- [x] Requires a compatibility wrapper
- [x] Requires further investigation

Created:

```text
docs/desktop-browser-api-audit.md
```

---

# Phase 2 - Add Electron Application

## Application Structure

Create a desktop application alongside the existing server and client.

Target structure:

```text
apps/
├── client/
├── desktop/
└── server/
```

- [x] Create `apps/desktop`
- [x] Create desktop `package.json`
- [x] Add Electron as a development dependency
- [x] Add Electron build tooling
- [x] Add TypeScript configuration
- [x] Add development scripts
- [x] Add production build scripts

Suggested files:

```text
apps/desktop/
├── src/
│   ├── main.ts
│   ├── preload.ts
│   ├── ipc/
│   ├── services/
│   └── windows/
├── assets/
├── package.json
└── tsconfig.json
```

---

# Phase 3 - Basic Electron Window

## Main Process

- [x] Create Electron `main.ts`
- [x] Initialize Electron application
- [x] Create the main `BrowserWindow`
- [x] Configure initial window size
- [x] Configure minimum window size
- [x] Set the application name
- [x] Set Windows application icon
- [x] Configure window background
- [x] Handle application startup
- [x] Handle application shutdown
- [x] Handle second-instance behavior

## Development Mode

- [x] Launch the Vite development server
- [x] Load the development URL in Electron
- [x] Enable DevTools during development
- [x] Configure hot reload
- [ ] Confirm React changes appear without restarting Electron

Desired development flow:

```text
bun run desktop:dev
```

Should launch:

```text
Vite Client
+
Electron
```

---

# Phase 4 - Production Client Bundling

## Bundle React UI Locally

- [x] Build `apps/client` through Vite
- [x] Load the resulting static files through Electron
- [x] Do not require the Sharkord server to serve the UI
- [x] Verify bundled React assets resolve correctly
- [x] Verify fonts load
- [x] Verify icons load
- [x] Verify images load
- [x] Verify localization resources load

Production architecture:

```text
SandShark.exe
        │
        ▼
Packaged React UI
        │
        ▼
User-selected Sharkord server
```

- [ ] Confirm desktop UI launches without internet access
- [ ] Confirm desktop UI can connect to a LAN-hosted Sharkord server

---

# Phase 5 - Separate Client UI from Server Address

## Server Connection Configuration

The packaged UI should not assume it was loaded from the Sharkord server.

- [x] Find places where API URLs are derived from `window.location`
- [x] Find places where WebSocket URLs are derived from `window.location`
- [x] Find places where mediasoup endpoints depend on page URL
- [x] Abstract server location behind a server configuration service

Create something similar to:

```text
ServerConnectionConfig
├── httpUrl
├── websocketUrl
├── displayName
└── serverId
```

- [x] Allow users to manually enter a Sharkord server URL
- [x] Validate the URL
- [x] Test connectivity
- [x] Detect whether the endpoint is actually a Sharkord server
- [x] Provide useful connection-error messages
- [x] Store the selected server locally
- [x] Automatically reconnect on future launches

---

# Phase 6 - Desktop Environment Abstraction

Avoid placing Electron checks throughout the entire React project.

Create a desktop abstraction layer.

Possible location:

```text
apps/client/src/platform/
```

Example:

```text
platform/
├── environment.ts
├── notifications.ts
├── storage.ts
├── desktop.ts
└── media.ts
```

## Environment Detection

- [x] Add `isDesktopClient()`
- [x] Add `isBrowserClient()`
- [x] Add desktop version detection
- [x] Add OS detection where needed

Example:

```ts
if (isDesktopClient()) {
    // desktop behavior
}
```

Rather than:

```ts
if ((window as any).electronStuff) {
}
```

---

# Phase 7 - Secure Preload Bridge

Do not expose Electron or Node APIs directly to the React renderer.

## Security Configuration

- [x] Enable `contextIsolation`
- [x] Disable `nodeIntegration`
- [x] Configure secure preload script
- [x] Restrict navigation
- [x] Block unexpected external page loading
- [x] Validate IPC input
- [x] Audit desktop API exposure

## Desktop API

Expose a small typed API through preload.

Example:

```ts
window.sharkordDesktop
```

Possible API:

```ts
interface SharkordDesktopAPI {
    getVersion(): Promise<string>;

    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;

    showNotification(options: DesktopNotification): Promise<void>;

    setPushToTalkHotkey(key: string): Promise<void>;
    clearPushToTalkHotkey(): Promise<void>;

    setLaunchOnStartup(enabled: boolean): Promise<void>;

    openExternal(url: string): Promise<void>;
}
```

- [x] Create shared TypeScript definitions
- [x] Add React-side type declaration
- [x] Add IPC handlers
- [x] Add preload implementation
- [x] Add error handling

---

# Phase 8 - Authentication and Session Persistence

## Existing Authentication

- [x] Determine how Sharkord currently stores authentication state
- [x] Determine whether authentication relies on cookies
- [x] Determine whether tokens are stored in browser storage
- [x] Confirm authentication works when UI is loaded from a local Electron origin

## Desktop Session Handling

- [x] Preserve login between desktop launches
- [x] Support logout
- [x] Clear credentials on logout
- [x] Handle expired authentication
- [x] Handle server-side session revocation
- [x] Ensure authentication data does not leak between servers

---

# Phase 9 - Multi-Server Foundation

Optional for the first release, but design the architecture to support it.

## Server Profiles

Create local server profiles.

Each server should store:

```text
ServerProfile
├── id
├── displayName
├── url
├── icon
├── lastConnected
└── preferences
```

- [x] Add server profile storage
- [x] Add server selection screen
- [x] Add "Add Server" dialog
- [x] Add "Remove Server" action
- [x] Add "Edit Server" action
- [x] Add reconnect option
- [x] Track last-connected server

## Future Multi-Server Support

- [x] Design auth storage per server
- [x] Design notification routing per server
- [x] Design unread counts per server
- [x] Design server switching without app restart
- [x] Consider maintaining background connections

---

# Phase 10 - Voice Chat Validation

Voice is a critical milestone.

## Microphone

- [x] Detect available microphones
- [x] Select microphone
- [x] Remember selected microphone
- [x] Test microphone
- [x] Mute/unmute
- [x] Verify audio gate
- [x] Verify noise suppression
- [x] Verify audio worklets
- [x] Verify permission handling

## Output Audio

- [x] Detect output devices
- [x] Select output device where supported
- [x] Test speaker output
- [x] Verify per-user volume
- [x] Verify deafen
- [x] Verify mute behavior

## mediasoup

- [x] Verify router capability negotiation
- [x] Verify producer creation
- [x] Verify consumer creation
- [x] Verify transport reconnection
- [x] Verify voice-channel switching
- [x] Verify disconnect/reconnect behavior
- [x] Verify multiple simultaneous remote speakers

---

# Phase 11 - Webcam Support

- [x] Detect webcams
- [x] Select webcam
- [x] Remember webcam
- [x] Test webcam
- [x] Start webcam stream
- [x] Stop webcam stream
- [x] Confirm remote webcam rendering
- [x] Verify codec selection
- [x] Verify simulcast
- [x] Verify quality switching
- [x] Verify camera permission handling

---

# Phase 12 - Screen Sharing

This should receive extensive Windows testing.

## Existing Browser Screen Sharing

- [x] Test current `getDisplayMedia()` behavior inside Electron
- [x] Test sharing entire displays
- [x] Test sharing application windows
- [x] Test sharing browser-like Electron window
- [x] Test multiple-monitor systems

## Native Electron Screen Selection

Investigate replacing browser screen selection with Electron's desktop capture APIs.

- [x] Enumerate available displays
- [x] Enumerate available windows
- [x] Display thumbnails
- [x] Allow user to select source
- [x] Start capture using selected source
- [x] Feed stream into existing Sharkord mediasoup pipeline

## Screen Audio

- [x] Investigate Windows system-audio capture
- [x] Test shared-window audio
- [x] Test full-display audio
- [x] Document limitations
- [x] Add graceful fallback when audio cannot be captured

---

# Phase 13 - Global Push-to-Talk

One of the strongest reasons for having a desktop client.

- [x] Add configurable push-to-talk key
- [x] Register global shortcut
- [x] Detect key press while SandShark is unfocused
- [x] Detect key release
- [x] Connect shortcut state to existing microphone controls
- [x] Provide visual PTT indicator
- [x] Prevent stuck microphone state
- [x] Unregister shortcut when disabled
- [x] Re-register shortcut when preference changes
- [x] Handle invalid/reserved shortcuts
- [x] Store preference locally

## Advanced PTT

- [x] Support mouse buttons if practical
- [x] Support modifier combinations
- [x] Support push-to-mute
- [x] Support PTT activation delay
- [x] Support release delay

---

# Phase 14 - System Tray

## Tray Icon

- [x] Add SandShark tray icon
- [x] Show tray icon while application is running
- [x] Left-click opens SandShark
- [x] Right-click opens context menu

Suggested tray menu:

```text
Open SandShark
----------------
Mute Microphone
Deafen
----------------
Current Server
----------------
Quit
```

- [x] Reflect mute status in tray
- [x] Reflect deafened status
- [x] Update tooltip with current server
- [x] Optionally show unread count

---

# Phase 15 - Window Behavior

## Close Behavior

Add setting:

```text
When closing SandShark:
( ) Exit application
( ) Minimize to system tray
```

- [x] Intercept close event
- [x] Hide window when minimizing to tray
- [x] Restore from tray
- [x] Avoid creating duplicate windows

## Minimize Behavior

- [x] Add optional minimize-to-tray
- [x] Persist setting

## Startup Behavior

- [x] Restore previous window size
- [x] Restore previous window position
- [x] Ensure window remains visible if monitor layout changes
- [x] Optional start minimized

---

# Phase 16 - Start With Windows

- [x] Add "Start SandShark with Windows" preference
- [x] Configure Electron login item settings
- [x] Support start minimized
- [ ] Verify startup behavior after Windows reboot
- [ ] Verify uninstall removes startup registration

---

# Phase 17 - Native Notifications

## Notification Bridge

- [x] Detect incoming messages requiring notifications
- [x] Route desktop notifications through Electron
- [x] Include sender name
- [x] Include server name
- [x] Include channel name
- [x] Include message preview
- [x] Support notification icons

## Notification Interaction

- [x] Clicking notification opens SandShark
- [x] Switch to correct server
- [x] Navigate to correct channel
- [x] Scroll to relevant message if possible

## Notification Preferences

- [x] All messages
- [x] Mentions only
- [x] Direct messages
- [x] Muted channels
- [x] Do not notify while SandShark is focused

---

# Phase 18 - Taskbar Integration

- [x] Show unread indicator
- [x] Show mention count
- [x] Flash taskbar icon on important notification
- [x] Clear indicator when messages are read

Potential future enhancement:

- [ ] Windows taskbar jump list
- [ ] Quick mute/deafen controls

---

# Phase 19 - External Link Handling

Prevent arbitrary sites from replacing the SandShark renderer.

- [x] Intercept external navigation
- [x] Open HTTP/HTTPS links in the user's normal browser
- [x] Restrict Electron navigation to packaged SandShark UI
- [x] Validate URLs
- [x] Block dangerous protocols
- [x] Permit explicit Sharkord deep links

---

# Phase 20 - Deep Linking

Create a custom protocol such as:

```text
sharkord://
```

Possible links:

```text
sharkord://server/chat.example.com
sharkord://channel/123
sharkord://invite/abcdef
```

- [x] Register protocol on Windows
- [x] Handle protocol when application is closed
- [x] Handle protocol while application is already running
- [x] Validate incoming URL
- [x] Add server if necessary
- [x] Navigate to requested destination

---

# Phase 21 - File Uploads and Downloads

## Uploads

- [ ] Verify drag-and-drop file uploads
- [ ] Verify image uploads
- [ ] Verify large-file uploads
- [ ] Verify clipboard image uploads
- [ ] Verify file-picker uploads

## Downloads

- [x] Replace browser download behavior where appropriate
- [x] Allow user to choose download folder
- [x] Show download progress
- [x] Open downloaded file
- [x] Open containing folder
- [x] Sanitize filenames

---

# Phase 22 - Clipboard Integration

- [ ] Verify normal text copy/paste
- [ ] Verify rich-text copy/paste
- [ ] Verify image paste
- [x] Add desktop clipboard bridge only where needed
- [x] Prevent unnecessary clipboard permissions

---

# Phase 23 - Desktop Settings Section

Create a desktop-only settings category.

Example:

```text
Settings
├── Account
├── Appearance
├── Voice & Video
├── Notifications
└── Desktop
```

Desktop settings:

- [x] Start with Windows
- [x] Start minimized
- [x] Minimize to tray
- [x] Close to tray
- [x] Enable native notifications
- [x] Global push-to-talk
- [x] Push-to-talk shortcut
- [x] Enable hardware acceleration
- [x] Check for updates
- [x] Current desktop version

Only display this section when:

```ts
isDesktopClient()
```

---

# Phase 24 - Local Desktop Configuration

Choose a local configuration system.

Store:

- [x] Server profiles
- [x] Desktop preferences
- [x] Window dimensions
- [x] Window position
- [x] Last-selected server
- [x] Push-to-talk shortcut
- [x] Update preferences
- [x] Notification preferences

Do not store passwords in plaintext.

Investigate:

- [x] Electron safe storage
- [ ] Windows Credential Manager
- [x] Existing Sharkord token storage

---

# Phase 25 - Application Branding

If the fork will have a distinct name:

- [x] Choose fork name
- [x] Choose application executable name
- [x] Create application icon
- [x] Create installer icon
- [x] Create tray icon
- [x] Update application title
- [x] Update About dialog
- [x] Update package metadata

With SandShark branding:

- [x] Review upstream trademark/branding expectations
- [x] Clearly identify fork where appropriate

---

# Phase 26 - Windows Installer

## Packaging

Investigate:

- [x] electron-builder
- [ ] electron-forge

Choose one packaging system.

Build:

- [x] Windows x64 installer
- [ ] Windows ARM64 installer if desired
- [ ] Portable version if desired

## Installer

- [ ] Install application
- [x] Add Start Menu shortcut
- [x] Optional desktop shortcut
- [x] Register custom URL protocol
- [x] Register startup behavior
- [x] Clean uninstall
- [x] Preserve or optionally remove user settings

---

# Phase 27 - Code Signing

Unsigned Electron applications will trigger Windows warnings.

- [x] Research Windows code-signing certificate
- [x] Configure executable signing
- [x] Configure installer signing
- [ ] Verify signatures
- [x] Integrate signing into CI

Future:

- [ ] Consider Microsoft Store packaging

---

# Phase 28 - Automatic Updates

## Update System

- [x] Choose update mechanism
- [x] Create release feed
- [x] Add update check
- [x] Download update
- [x] Notify user
- [x] Install update after restart

Settings:

```text
Automatically check for updates: Yes/No
Automatically download updates: Yes/No
```

- [x] Support manual "Check for Updates"
- [x] Display current version
- [x] Display available version
- [x] Handle update failures safely

---

# Phase 29 - GitHub Actions / CI

## Desktop Build Pipeline

- [x] Add Windows build workflow
- [x] Install Bun
- [x] Install dependencies
- [x] Build shared packages
- [x] Build React client
- [x] Build Electron main process
- [x] Package Windows application
- [x] Upload installer artifact

## Release Pipeline

- [x] Create builds when GitHub release is created
- [x] Sign executable
- [x] Sign installer
- [x] Upload installer
- [ ] Upload portable build if supported
- [x] Generate checksums
- [x] Publish update metadata

---

# Phase 30 - Upstream Sharkord Compatibility

Keeping the fork maintainable is important.

## Minimize Core Changes

Prefer:

```text
Existing SandShark client
        +
Small platform abstraction
        +
Desktop application
```

Avoid heavily rewriting:

```text
apps/client
```

unless necessary.

- [x] Keep desktop code primarily inside `apps/desktop`
- [x] Keep shared platform interfaces small
- [x] Document every significant modification to upstream client behavior
- [x] Avoid unnecessary formatting-only changes
- [x] Avoid renaming large sections of upstream code

## Upstream Merge Procedure

Periodically:

```bash
git fetch upstream
git checkout development
git merge upstream/development
```

Then merge into desktop branch.

- [x] Document merge procedure
- [ ] Resolve conflicts
- [ ] Run browser-client regression tests
- [ ] Run desktop-client regression tests

---

# Phase 31 - Browser Regression Testing

The web client should continue functioning.

After major desktop changes verify:

- [x] Browser login
- [x] Browser text chat
- [x] Browser voice chat
- [x] Browser webcam
- [x] Browser screen sharing
- [x] Browser file uploads
- [x] Browser notifications
- [x] Mobile browser layout if supported

Desktop functionality should be gated behind platform detection.

---

# Phase 32 - Desktop Functional Testing

## Windows Versions

Test at minimum:

- [ ] Windows 11

Optional:

- [ ] Windows 10 if still targeted

## Hardware

Test:

- [x] Single monitor
- [x] Multiple monitors
- [x] Laptop microphone
- [x] USB microphone
- [x] Bluetooth headset
- [x] USB headset
- [x] Webcam
- [x] Integrated GPU
- [x] Dedicated GPU

## Networking

Test:

- [ ] Localhost Sharkord server
- [ ] LAN Sharkord server
- [ ] Remote HTTPS server
- [ ] Reverse-proxied server
- [ ] High latency connection
- [ ] Temporary connection loss
- [ ] Server restart while client is open

---

# Phase 33 - Voice Stress Testing

Test rooms with:

- [x] 2 users
- [ ] 5 users
- [ ] 10 users
- [ ] More users if practical

Monitor:

- [ ] CPU usage
- [ ] Memory usage
- [ ] Network traffic
- [ ] Audio latency
- [ ] Audio dropouts
- [ ] mediasoup reconnect behavior

---

# Phase 34 - Screen Share Stress Testing

Test:

- [ ] 720p
- [ ] 1080p
- [ ] 1440p
- [ ] 4K if supported

Test:

- [x] 30 FPS
- [x] 60 FPS

Test content:

- [ ] Desktop
- [ ] Browser
- [ ] Game
- [ ] Video
- [ ] Static application
- [ ] Multiple monitors

Monitor:

- [ ] CPU
- [ ] GPU
- [ ] bitrate
- [ ] frame rate
- [ ] latency

---

# Phase 35 - Hardware Acceleration

Electron relies heavily on Chromium GPU acceleration.

- [ ] Test with hardware acceleration enabled
- [ ] Test NVIDIA GPUs
- [ ] Test AMD GPUs
- [ ] Test Intel integrated graphics
- [ ] Add troubleshooting option to disable GPU acceleration

Possible launch option:

```text
--disable-gpu
```

Add setting if needed:

```text
Use hardware acceleration
```

Require restart after changing.

---

# Phase 36 - Logging and Diagnostics

Desktop users need usable diagnostics.

- [x] Create desktop log location
- [x] Log application startup
- [x] Log Electron version
- [x] Log desktop-client version
- [x] Log server connection events
- [x] Log WebSocket reconnects
- [x] Log mediasoup connection errors
- [x] Log screen-share failures
- [x] Log update failures

Add:

```text
Settings > Desktop > Open Log Folder
```

- [x] Ensure authentication tokens are not logged
- [x] Ensure message contents are not unnecessarily logged

---

# Phase 37 - Crash Handling

- [x] Detect renderer crashes
- [x] Detect GPU-process crashes
- [x] Offer reload
- [x] Preserve logs
- [x] Recover cleanly where possible
- [x] Avoid restart loops

Optional:

- [ ] Crash reporting
- [ ] User-controlled diagnostics submission

---

# Phase 38 - Security Review

Electron adds significant security responsibility.

Verify:

- [x] `nodeIntegration` is disabled
- [x] `contextIsolation` is enabled
- [x] Preload exposes minimal APIs
- [x] IPC inputs are validated
- [x] External URLs open outside Electron
- [x] Remote content cannot execute Node APIs
- [ ] Navigation is restricted
- [ ] Permissions are explicitly handled
- [ ] File URLs are controlled
- [ ] Authentication tokens are protected
- [ ] Server profiles cannot inject JavaScript
- [ ] Deep links are sanitized
- [ ] Update packages are verified

---

# Phase 39 - Desktop MVP

The first usable desktop release does not need every feature.

## MVP Requirements

The application is considered a functional desktop MVP when:

- [ ] Windows application launches
- [ ] Existing React Sharkord UI loads locally
- [ ] User can enter server URL
- [ ] User can log in
- [ ] User can send and receive text messages
- [ ] User can upload files
- [ ] Voice chat works
- [ ] Microphone selection works
- [ ] Speaker output works
- [ ] Webcam works
- [ ] Screen sharing works
- [ ] Login persists
- [ ] Server URL persists
- [ ] Application can be installed through a Windows installer

At this point the desktop client is functionally equivalent to the browser client.

---

# Phase 40 - Desktop Feature Release

After MVP, implement the features that make the application meaningfully better than the browser.

## Desktop V1

- [ ] System tray
- [ ] Close to tray
- [ ] Start with Windows
- [ ] Native notifications
- [ ] Notification click navigation
- [ ] Global push-to-talk
- [ ] Desktop settings page
- [ ] External-link handling
- [ ] Automatic updates
- [ ] Signed installer

---

# Phase 41 - Multi-Server Release

## Server Manager

- [ ] Multiple saved Sharkord servers
- [ ] Server icons
- [ ] Server names
- [ ] Independent login sessions
- [ ] Per-server unread counts
- [ ] Per-server notification settings
- [ ] Fast server switching

Possible interface:

```text
┌────┬─────────────────────────────┐
│ 🦈 │                             │
│    │     Current SandShark       │
│ F  │                             │
│    │     # general               │
│ W  │     # gaming                │
│    │     🔊 Lobby                │
│ H  │                             │
│    │                             │
│ +  │                             │
└────┴─────────────────────────────┘
```

---

# Phase 42 - Future Desktop Enhancements

These are not required for the initial fork.

## Rich Presence

- [ ] Current voice channel
- [ ] Current server
- [ ] Windows presence integration where appropriate

## Overlay

Investigate game overlay support.

- [ ] Push-to-talk indicator
- [ ] Current speakers
- [ ] Mute/deafen state

This should be treated as a separate major project.

## Audio Enhancements

- [ ] Push-to-mute
- [ ] Automatic gain control settings
- [ ] Noise suppression presets
- [ ] Echo cancellation controls
- [ ] Device-specific preferences

## Screen Sharing Enhancements

- [ ] Native source picker
- [ ] Application-only capture
- [ ] System-audio sharing
- [ ] Source preview
- [ ] Preferred capture resolution
- [ ] Preferred frame rate

## User Experience

- [ ] Keyboard shortcuts
- [ ] Quick switcher
- [ ] Global mute/deafen shortcuts
- [ ] Notification sound preferences
- [ ] Unread taskbar count

---

# Recommended Implementation Order

## Milestone 1 - Electron Proof of Concept

- [ ] Create `apps/desktop`
- [ ] Start Electron
- [ ] Load SandShark through Vite
- [ ] Display existing UI

**Deliverable:**

```text
SandShark UI running inside a Windows Electron window.
```

---

## Milestone 2 - Packaged UI

- [ ] Build React application
- [ ] Package it inside Electron
- [ ] Connect to external Sharkord server

**Deliverable:**

```text
Desktop client no longer depends on the browser or server-hosted UI.
```

---

## Milestone 3 - Full SandShark Compatibility

- [ ] Login
- [ ] Text chat
- [ ] Uploads
- [ ] Voice
- [ ] Webcam
- [ ] Screen sharing

**Deliverable:**

```text
Desktop client can replace the browser client for normal use.
```

---

## Milestone 4 - Desktop Integration

- [ ] Tray
- [ ] Native notifications
- [ ] Start with Windows
- [ ] Close to tray
- [ ] Push-to-talk

**Deliverable:**

```text
Desktop client provides functionality unavailable to the browser client.
```

---

## Milestone 5 - Distribution

- [ ] Windows installer
- [ ] Application signing
- [ ] Automatic updates
- [ ] GitHub release workflow

**Deliverable:**

```text
Non-technical users can install and update SandShark.
```

---

## Milestone 6 - Multi-Server Client

- [ ] Saved server profiles
- [ ] Independent sessions
- [ ] Server switching
- [ ] Per-server notifications
- [ ] Per-server unread state

**Deliverable:**

```text
One SandShark installation can act as a client for multiple
independent self-hosted Sharkord communities.
```

---

# Definition of Done for Initial Stable Release

A desktop release can be considered stable when:

- [ ] Windows installer works reliably
- [ ] Client launches without requiring a browser
- [ ] User can connect to an arbitrary compatible Sharkord server
- [ ] Authentication persists
- [ ] Text messaging works
- [ ] Voice works
- [ ] Webcam works
- [ ] Screen sharing works
- [ ] File upload/download works
- [ ] Push-to-talk works outside the application
- [ ] Tray behavior works
- [ ] Native notifications work
- [ ] Start-with-Windows works
- [ ] Updates work
- [ ] Browser Sharkord client remains functional
- [ ] No Node.js APIs are exposed directly to remote content
- [ ] Desktop configuration survives upgrades
- [ ] Application has been tested on multiple Windows systems
- [ ] Major crashes and connection failures produce useful logs

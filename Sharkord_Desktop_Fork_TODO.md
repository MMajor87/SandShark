# Sharkord Desktop Fork - Development TODO

## Project Goal

Create a Windows desktop client for Sharkord that reuses the existing React/TypeScript frontend while adding desktop-native functionality through Electron.

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

- [ ] Document the structure of `apps/client`
- [ ] Identify the main React application entry point
- [ ] Identify routing logic
- [ ] Identify login/authentication flow
- [ ] Identify server URL handling
- [ ] Identify WebSocket initialization
- [ ] Identify tRPC client initialization
- [ ] Identify mediasoup initialization
- [ ] Identify voice-provider architecture
- [ ] Identify device-provider architecture
- [ ] Identify screen-sharing logic
- [ ] Identify notification handling
- [ ] Identify persistent storage usage

## Browser API Audit

Search the client for direct usage of:

- [ ] `window`
- [ ] `document`
- [ ] `navigator`
- [ ] `navigator.mediaDevices`
- [ ] `getUserMedia`
- [ ] `getDisplayMedia`
- [ ] `localStorage`
- [ ] `sessionStorage`
- [ ] `Notification`
- [ ] `Clipboard`
- [ ] `AudioContext`
- [ ] `AudioWorklet`
- [ ] File picker APIs
- [ ] Drag-and-drop file APIs
- [ ] Browser download APIs
- [ ] Browser URL handling
- [ ] Browser history APIs

## Desktop Compatibility Classification

For each browser-specific API, classify it as:

- [ ] Works unchanged in Electron
- [ ] Requires Electron configuration
- [ ] Should be replaced by Electron functionality
- [ ] Requires a compatibility wrapper
- [ ] Requires further investigation

Create a document such as:

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

- [ ] Create `apps/desktop`
- [ ] Create desktop `package.json`
- [ ] Add Electron as a development dependency
- [ ] Add Electron build tooling
- [ ] Add TypeScript configuration
- [ ] Add development scripts
- [ ] Add production build scripts

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

- [ ] Create Electron `main.ts`
- [ ] Initialize Electron application
- [ ] Create the main `BrowserWindow`
- [ ] Configure initial window size
- [ ] Configure minimum window size
- [ ] Set the application name
- [ ] Set Windows application icon
- [ ] Configure window background
- [ ] Handle application startup
- [ ] Handle application shutdown
- [ ] Handle second-instance behavior

## Development Mode

- [ ] Launch the Vite development server
- [ ] Load the development URL in Electron
- [ ] Enable DevTools during development
- [ ] Configure hot reload
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

- [ ] Build `apps/client` through Vite
- [ ] Load the resulting static files through Electron
- [ ] Do not require the Sharkord server to serve the UI
- [ ] Verify bundled React assets resolve correctly
- [ ] Verify fonts load
- [ ] Verify icons load
- [ ] Verify images load
- [ ] Verify localization resources load

Production architecture:

```text
Sharkord Desktop.exe
        │
        ▼
Packaged React UI
        │
        ▼
User-selected Sharkord Server
```

- [ ] Confirm desktop UI launches without internet access
- [ ] Confirm desktop UI can connect to a LAN-hosted Sharkord server

---

# Phase 5 - Separate Client UI from Server Address

## Server Connection Configuration

The packaged UI should not assume it was loaded from the Sharkord server.

- [ ] Find places where API URLs are derived from `window.location`
- [ ] Find places where WebSocket URLs are derived from `window.location`
- [ ] Find places where mediasoup endpoints depend on page URL
- [ ] Abstract server location behind a server configuration service

Create something similar to:

```text
ServerConnectionConfig
├── httpUrl
├── websocketUrl
├── displayName
└── serverId
```

- [ ] Allow users to manually enter a Sharkord server URL
- [ ] Validate the URL
- [ ] Test connectivity
- [ ] Detect whether the endpoint is actually a Sharkord server
- [ ] Provide useful connection-error messages
- [ ] Store the selected server locally
- [ ] Automatically reconnect on future launches

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

- [ ] Add `isDesktopClient()`
- [ ] Add `isBrowserClient()`
- [ ] Add desktop version detection
- [ ] Add OS detection where needed

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

- [ ] Enable `contextIsolation`
- [ ] Disable `nodeIntegration`
- [ ] Configure secure preload script
- [ ] Restrict navigation
- [ ] Block unexpected external page loading
- [ ] Validate IPC input
- [ ] Audit desktop API exposure

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

- [ ] Create shared TypeScript definitions
- [ ] Add React-side type declaration
- [ ] Add IPC handlers
- [ ] Add preload implementation
- [ ] Add error handling

---

# Phase 8 - Authentication and Session Persistence

## Existing Authentication

- [ ] Determine how Sharkord currently stores authentication state
- [ ] Determine whether authentication relies on cookies
- [ ] Determine whether tokens are stored in browser storage
- [ ] Confirm authentication works when UI is loaded from a local Electron origin

## Desktop Session Handling

- [ ] Preserve login between desktop launches
- [ ] Support logout
- [ ] Clear credentials on logout
- [ ] Handle expired authentication
- [ ] Handle server-side session revocation
- [ ] Ensure authentication data does not leak between servers

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

- [ ] Add server profile storage
- [ ] Add server selection screen
- [ ] Add "Add Server" dialog
- [ ] Add "Remove Server" action
- [ ] Add "Edit Server" action
- [ ] Add reconnect option
- [ ] Track last-connected server

## Future Multi-Server Support

- [ ] Design auth storage per server
- [ ] Design notification routing per server
- [ ] Design unread counts per server
- [ ] Design server switching without app restart
- [ ] Consider maintaining background connections

---

# Phase 10 - Voice Chat Validation

Voice is a critical milestone.

## Microphone

- [ ] Detect available microphones
- [ ] Select microphone
- [ ] Remember selected microphone
- [ ] Test microphone
- [ ] Mute/unmute
- [ ] Verify audio gate
- [ ] Verify noise suppression
- [ ] Verify audio worklets
- [ ] Verify permission handling

## Output Audio

- [ ] Detect output devices
- [ ] Select output device where supported
- [ ] Test speaker output
- [ ] Verify per-user volume
- [ ] Verify deafen
- [ ] Verify mute behavior

## mediasoup

- [ ] Verify router capability negotiation
- [ ] Verify producer creation
- [ ] Verify consumer creation
- [ ] Verify transport reconnection
- [ ] Verify voice-channel switching
- [ ] Verify disconnect/reconnect behavior
- [ ] Verify multiple simultaneous remote speakers

---

# Phase 11 - Webcam Support

- [ ] Detect webcams
- [ ] Select webcam
- [ ] Remember webcam
- [ ] Test webcam
- [ ] Start webcam stream
- [ ] Stop webcam stream
- [ ] Confirm remote webcam rendering
- [ ] Verify codec selection
- [ ] Verify simulcast
- [ ] Verify quality switching
- [ ] Verify camera permission handling

---

# Phase 12 - Screen Sharing

This should receive extensive Windows testing.

## Existing Browser Screen Sharing

- [ ] Test current `getDisplayMedia()` behavior inside Electron
- [ ] Test sharing entire displays
- [ ] Test sharing application windows
- [ ] Test sharing browser-like Electron window
- [ ] Test multiple-monitor systems

## Native Electron Screen Selection

Investigate replacing browser screen selection with Electron's desktop capture APIs.

- [ ] Enumerate available displays
- [ ] Enumerate available windows
- [ ] Display thumbnails
- [ ] Allow user to select source
- [ ] Start capture using selected source
- [ ] Feed stream into existing Sharkord mediasoup pipeline

## Screen Audio

- [ ] Investigate Windows system-audio capture
- [ ] Test shared-window audio
- [ ] Test full-display audio
- [ ] Document limitations
- [ ] Add graceful fallback when audio cannot be captured

---

# Phase 13 - Global Push-to-Talk

One of the strongest reasons for having a desktop client.

- [ ] Add configurable push-to-talk key
- [ ] Register global shortcut
- [ ] Detect key press while Sharkord is unfocused
- [ ] Detect key release
- [ ] Connect shortcut state to existing microphone controls
- [ ] Provide visual PTT indicator
- [ ] Prevent stuck microphone state
- [ ] Unregister shortcut when disabled
- [ ] Re-register shortcut when preference changes
- [ ] Handle invalid/reserved shortcuts
- [ ] Store preference locally

## Advanced PTT

- [ ] Support mouse buttons if practical
- [ ] Support modifier combinations
- [ ] Support push-to-mute
- [ ] Support PTT activation delay
- [ ] Support release delay

---

# Phase 14 - System Tray

## Tray Icon

- [ ] Add Sharkord tray icon
- [ ] Show tray icon while application is running
- [ ] Left-click opens Sharkord
- [ ] Right-click opens context menu

Suggested tray menu:

```text
Open Sharkord
----------------
Mute Microphone
Deafen
----------------
Current Server
----------------
Quit
```

- [ ] Reflect mute status in tray
- [ ] Reflect deafened status
- [ ] Update tooltip with current server
- [ ] Optionally show unread count

---

# Phase 15 - Window Behavior

## Close Behavior

Add setting:

```text
When closing Sharkord:
( ) Exit application
( ) Minimize to system tray
```

- [ ] Intercept close event
- [ ] Hide window when minimizing to tray
- [ ] Restore from tray
- [ ] Avoid creating duplicate windows

## Minimize Behavior

- [ ] Add optional minimize-to-tray
- [ ] Persist setting

## Startup Behavior

- [ ] Restore previous window size
- [ ] Restore previous window position
- [ ] Ensure window remains visible if monitor layout changes
- [ ] Optional start minimized

---

# Phase 16 - Start With Windows

- [ ] Add "Start Sharkord with Windows" preference
- [ ] Configure Electron login item settings
- [ ] Support start minimized
- [ ] Verify startup behavior after Windows reboot
- [ ] Verify uninstall removes startup registration

---

# Phase 17 - Native Notifications

## Notification Bridge

- [ ] Detect incoming messages requiring notifications
- [ ] Route desktop notifications through Electron
- [ ] Include sender name
- [ ] Include server name
- [ ] Include channel name
- [ ] Include message preview
- [ ] Support notification icons

## Notification Interaction

- [ ] Clicking notification opens Sharkord
- [ ] Switch to correct server
- [ ] Navigate to correct channel
- [ ] Scroll to relevant message if possible

## Notification Preferences

- [ ] All messages
- [ ] Mentions only
- [ ] Direct messages
- [ ] Muted channels
- [ ] Do not notify while Sharkord is focused

---

# Phase 18 - Taskbar Integration

- [ ] Show unread indicator
- [ ] Show mention count
- [ ] Flash taskbar icon on important notification
- [ ] Clear indicator when messages are read

Potential future enhancement:

- [ ] Windows taskbar jump list
- [ ] Quick mute/deafen controls

---

# Phase 19 - External Link Handling

Prevent arbitrary sites from replacing the Sharkord renderer.

- [ ] Intercept external navigation
- [ ] Open HTTP/HTTPS links in the user's normal browser
- [ ] Restrict Electron navigation to packaged Sharkord UI
- [ ] Validate URLs
- [ ] Block dangerous protocols
- [ ] Permit explicit Sharkord deep links

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

- [ ] Register protocol on Windows
- [ ] Handle protocol when application is closed
- [ ] Handle protocol while application is already running
- [ ] Validate incoming URL
- [ ] Add server if necessary
- [ ] Navigate to requested destination

---

# Phase 21 - File Uploads and Downloads

## Uploads

- [ ] Verify drag-and-drop file uploads
- [ ] Verify image uploads
- [ ] Verify large-file uploads
- [ ] Verify clipboard image uploads
- [ ] Verify file-picker uploads

## Downloads

- [ ] Replace browser download behavior where appropriate
- [ ] Allow user to choose download folder
- [ ] Show download progress
- [ ] Open downloaded file
- [ ] Open containing folder
- [ ] Sanitize filenames

---

# Phase 22 - Clipboard Integration

- [ ] Verify normal text copy/paste
- [ ] Verify rich-text copy/paste
- [ ] Verify image paste
- [ ] Add desktop clipboard bridge only where needed
- [ ] Prevent unnecessary clipboard permissions

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

- [ ] Start with Windows
- [ ] Start minimized
- [ ] Minimize to tray
- [ ] Close to tray
- [ ] Enable native notifications
- [ ] Global push-to-talk
- [ ] Push-to-talk shortcut
- [ ] Enable hardware acceleration
- [ ] Check for updates
- [ ] Current desktop version

Only display this section when:

```ts
isDesktopClient()
```

---

# Phase 24 - Local Desktop Configuration

Choose a local configuration system.

Store:

- [ ] Server profiles
- [ ] Desktop preferences
- [ ] Window dimensions
- [ ] Window position
- [ ] Last-selected server
- [ ] Push-to-talk shortcut
- [ ] Update preferences
- [ ] Notification preferences

Do not store passwords in plaintext.

Investigate:

- [ ] Electron safe storage
- [ ] Windows Credential Manager
- [ ] Existing Sharkord token storage

---

# Phase 25 - Application Branding

If the fork will have a distinct name:

- [ ] Choose fork name
- [ ] Choose application executable name
- [ ] Create application icon
- [ ] Create installer icon
- [ ] Create tray icon
- [ ] Update application title
- [ ] Update About dialog
- [ ] Update package metadata

If retaining Sharkord branding:

- [ ] Review upstream trademark/branding expectations
- [ ] Clearly identify fork where appropriate

---

# Phase 26 - Windows Installer

## Packaging

Investigate:

- [ ] electron-builder
- [ ] electron-forge

Choose one packaging system.

Build:

- [ ] Windows x64 installer
- [ ] Windows ARM64 installer if desired
- [ ] Portable version if desired

## Installer

- [ ] Install application
- [ ] Add Start Menu shortcut
- [ ] Optional desktop shortcut
- [ ] Register custom URL protocol
- [ ] Register startup behavior
- [ ] Clean uninstall
- [ ] Preserve or optionally remove user settings

---

# Phase 27 - Code Signing

Unsigned Electron applications will trigger Windows warnings.

- [ ] Research Windows code-signing certificate
- [ ] Configure executable signing
- [ ] Configure installer signing
- [ ] Verify signatures
- [ ] Integrate signing into CI

Future:

- [ ] Consider Microsoft Store packaging

---

# Phase 28 - Automatic Updates

## Update System

- [ ] Choose update mechanism
- [ ] Create release feed
- [ ] Add update check
- [ ] Download update
- [ ] Notify user
- [ ] Install update after restart

Settings:

```text
Automatically check for updates: Yes/No
Automatically download updates: Yes/No
```

- [ ] Support manual "Check for Updates"
- [ ] Display current version
- [ ] Display available version
- [ ] Handle update failures safely

---

# Phase 29 - GitHub Actions / CI

## Desktop Build Pipeline

- [ ] Add Windows build workflow
- [ ] Install Bun
- [ ] Install dependencies
- [ ] Build shared packages
- [ ] Build React client
- [ ] Build Electron main process
- [ ] Package Windows application
- [ ] Upload installer artifact

## Release Pipeline

- [ ] Create builds when GitHub release is created
- [ ] Sign executable
- [ ] Sign installer
- [ ] Upload installer
- [ ] Upload portable build if supported
- [ ] Generate checksums
- [ ] Publish update metadata

---

# Phase 30 - Upstream Sharkord Compatibility

Keeping the fork maintainable is important.

## Minimize Core Changes

Prefer:

```text
Existing Sharkord client
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

- [ ] Keep desktop code primarily inside `apps/desktop`
- [ ] Keep shared platform interfaces small
- [ ] Document every significant modification to upstream client behavior
- [ ] Avoid unnecessary formatting-only changes
- [ ] Avoid renaming large sections of upstream code

## Upstream Merge Procedure

Periodically:

```bash
git fetch upstream
git checkout development
git merge upstream/development
```

Then merge into desktop branch.

- [ ] Document merge procedure
- [ ] Resolve conflicts
- [ ] Run browser-client regression tests
- [ ] Run desktop-client regression tests

---

# Phase 31 - Browser Regression Testing

The web client should continue functioning.

After major desktop changes verify:

- [ ] Browser login
- [ ] Browser text chat
- [ ] Browser voice chat
- [ ] Browser webcam
- [ ] Browser screen sharing
- [ ] Browser file uploads
- [ ] Browser notifications
- [ ] Mobile browser layout if supported

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

- [ ] Single monitor
- [ ] Multiple monitors
- [ ] Laptop microphone
- [ ] USB microphone
- [ ] Bluetooth headset
- [ ] USB headset
- [ ] Webcam
- [ ] Integrated GPU
- [ ] Dedicated GPU

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

- [ ] 2 users
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

- [ ] 30 FPS
- [ ] 60 FPS

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

- [ ] Create desktop log location
- [ ] Log application startup
- [ ] Log Electron version
- [ ] Log desktop-client version
- [ ] Log server connection events
- [ ] Log WebSocket reconnects
- [ ] Log mediasoup connection errors
- [ ] Log screen-share failures
- [ ] Log update failures

Add:

```text
Settings > Desktop > Open Log Folder
```

- [ ] Ensure authentication tokens are not logged
- [ ] Ensure message contents are not unnecessarily logged

---

# Phase 37 - Crash Handling

- [ ] Detect renderer crashes
- [ ] Detect GPU-process crashes
- [ ] Offer reload
- [ ] Preserve logs
- [ ] Recover cleanly where possible
- [ ] Avoid restart loops

Optional:

- [ ] Crash reporting
- [ ] User-controlled diagnostics submission

---

# Phase 38 - Security Review

Electron adds significant security responsibility.

Verify:

- [ ] `nodeIntegration` is disabled
- [ ] `contextIsolation` is enabled
- [ ] Preload exposes minimal APIs
- [ ] IPC inputs are validated
- [ ] External URLs open outside Electron
- [ ] Remote content cannot execute Node APIs
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
│    │     Current Sharkord        │
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
- [ ] Load Sharkord through Vite
- [ ] Display existing UI

**Deliverable:**

```text
Sharkord UI running inside a Windows Electron window.
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

## Milestone 3 - Full Sharkord Compatibility

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
Non-technical users can install and update Sharkord Desktop.
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
One Sharkord Desktop installation can act as a client for multiple
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

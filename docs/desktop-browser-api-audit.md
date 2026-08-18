# SandShark Desktop Browser API Audit

This audit covers `apps/client` at the Phase 0 upstream baseline (`ecea4d3c831e29ab1ad936dd350fc28f6a7e7269`). It identifies browser-facing integration points that the Electron shell must preserve or replace.

## Client Structure

- `src/main.tsx` is the React entry point. It initializes i18n and renders the Redux store, device, dialog, screen, routing, plugin, and theme providers.
- `src/components/routing/index.tsx` is state-based routing, not URL routing. It selects the loading, connect, disconnected, or connected server view from Redux state.
- `src/screens/connect/index.tsx` owns the login form. It POSTs credentials to `/login`, stores the returned token in `sessionStorage`, then calls `connect()`.
- `src/features/server/actions.ts` coordinates the initial handshake and server-state subscription setup.
- `src/lib/trpc.ts` initializes the single tRPC-over-WebSocket client. It derives `ws` or `wss` from `window.location.protocol`, sends the session token as connection parameters, and resets state when the socket closes.
- `src/helpers/get-file-url.ts` derives the HTTP and WebSocket host from the renderer URL. Development mode is hard-coded to `localhost:4991`.
- `src/components/devices-provider/index.tsx` enumerates media devices, reacts to device changes, and persists selected devices/settings.
- `src/components/voice-provider/index.tsx` is the mediasoup integration boundary. It creates a `mediasoup-client` `Device`, delegates transport lifecycle to `hooks/use-transports.ts`, and owns microphone, webcam, screen-share, and remote-stream state.
- `src/components/voice-provider/hooks/use-voice-events.ts` translates tRPC subscriptions into mediasoup consumer changes. `hooks/use-voice-controls.ts` synchronizes mic, speaker, webcam, and screen-share state with the server.

## Browser API Classification

| API or capability | Current locations | Electron classification | Desktop direction |
| --- | --- | --- | --- |
| `window` | Routing, hotkeys, layout, audio, plugin/debug helpers | Works unchanged | Preserve renderer access; keep context isolation enabled and expose only explicit preload APIs later. |
| `document` | React mount, titles, listeners, portal, fullscreen/PiP, downloads | Works unchanged | Preserve DOM APIs in the renderer. |
| `navigator` | i18n, permissions, clipboard, media-device discovery | Works unchanged | Chromium renderer support is expected; validate on the supported Electron version. |
| `navigator.mediaDevices` | Device provider, voice provider, device tests | Requires Electron configuration | Ensure secure renderer context and test Windows permission prompts/device labels. |
| `getUserMedia()` | Mic/webcam production and settings tests | Requires Electron configuration | Keep existing constraints; validate microphone and camera permissions in Phase 10/11. |
| `getDisplayMedia()` | `voice-provider/index.tsx` screen-share flow | Requires further investigation | Start with Chromium behavior, then evaluate Electron `desktopCapturer` only if source-selection or audio limits require it. |
| `localStorage` | `helpers/storage.ts`, theme, UI state, device settings, auto-login token | Works unchanged | Existing keys are global to an Electron profile; Phase 9 should scope persisted state by server. |
| `sessionStorage` | Auth token in `helpers/storage.ts` | Works unchanged | Token survives renderer lifetime only; desktop auth persistence needs a Phase 8 design. |
| `Notification` | Notification helper and message actions | Should be replaced by Electron functionality | Route desktop notifications through the main process in Phase 17 for reliable native behavior and click routing. |
| Clipboard | `navigator.clipboard` for invite/error copy; paste event for uploads | Works unchanged | Keep renderer use initially; add an IPC wrapper only if permission or background-window behavior requires it. |
| `AudioContext` / `AudioWorklet` | Sounds, meters, noise gate, DTLN/RNNoise helpers | Requires Electron configuration | Chromium support is expected; verify worklet loading and autoplay/user-gesture behavior in Phase 10. |
| File picker APIs | Hidden `<input type=file>` in upload hook; dynamic input in `use-file-picker.ts` | Works unchanged | Preserve current renderer picker; Electron dialog integration is optional. |
| Drag-and-drop file APIs | `use-upload-files.ts` paste, `dragover`, and `drop` handlers | Works unchanged | Verify Windows Explorer drag-and-drop in Phase 21. |
| Browser download APIs | `helpers/download-file.ts` creates an anchor and object URL | Should be replaced by Electron functionality | Move downloads to Electron session/download handling for destination choice, progress, and reveal-in-folder support. |
| Browser URL handling | `helpers/get-file-url.ts`, connect invite query parameter | Requires a compatibility wrapper | The renderer must retain the selected Sharkord server origin while packaged UI loads from an app URL. Replace direct `window.location` server derivation with a desktop-aware server-origin helper in Phase 6. |
| Browser history APIs | No direct `history`, `pushState`, `replaceState`, or `popstate` usage | Works unchanged | No migration required. |
| External windows | `window.open()` for server-activity and connect-screen links | Should be replaced by Electron functionality | Intercept and open approved HTTP/HTTPS URLs with `shell.openExternal`; block renderer navigation in Phase 19. |
| Fullscreen / Picture-in-Picture | Voice view hooks | Requires further investigation | Validate Electron Chromium behavior after the basic window exists; preserve current fallback behavior. |

## Authentication and Server Origin

The web client assumes its own origin is the Sharkord server. Login is an HTTP POST to `${origin}/login`; the tRPC client opens `${wsProtocol}://${host}` and passes the session token in WebSocket connection parameters. A packaged Electron renderer cannot make that assumption, so Phase 6 must introduce an explicit active-server origin with both HTTP and WebSocket forms. The existing `getUrlFromServer()` and `getHostFromServer()` functions are the intended migration seam.

## Test Server Routing Check

Tested on 2026-08-18 against the SandShark development server:

- `GET <authorized-development-server>/` returned `200 OK` and the client HTML.
- `GET <authorized-development-server>/manifest.json` returned `200 OK` with `application/manifest+json`.
- `GET <authorized-development-server>/login` returned `404 Not Found`, as expected because the client invokes `/login` with `POST`.

Interactive login and WebSocket authentication were not exercised because no interactive browser attachment is available in this environment. They remain manual integration checks and should use this same test server.

## Phase 2 Implications

The Electron main process should begin with a hardened `BrowserWindow` and a minimal preload bridge. The existing renderer client should remain web-compatible. Desktop-specific behavior should be introduced behind narrowly scoped helpers, beginning with active-server origin resolution and external-link handling rather than broad Node access in the renderer.

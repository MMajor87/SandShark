# Development

## Requirements

- [Bun](https://bun.sh/)
- Node.js 22 for Windows desktop packaging (use real Node, not Bun's Node shim).
- .NET SDK selected by `global.json` for native Windows audio capture.
- [Tmux](https://github.com/tmux/tmux) (optional)

## Setup

1. Clone the repository.
2. Run `bun install`.
3. Start the app:
   - With tmux: `./start.sh`
   - Without tmux: run `bun dev` in both `apps/client` and `apps/server`

Development data is stored in `apps/server/data`, including the database and uploaded files.
Delete that folder if you want a clean reset.

## Mock data

To start from a server that looks used rather than empty, stop the dev server and run:

```bash
cd apps/server
bun run seed:mock
```

It **wipes `apps/server/data`** and rebuilds it: users, roles, categories, text and voice
channels, a private channel, messages spread over weeks with replies, threads, reactions and
pins, plus a few direct messages. Log in as `admin` with `password123`; every mock user shares
that password, and `useToken("dev")` still claims ownership.

It also creates a `#counting` channel holding 10,000 messages numbered `0` to `9999`, oldest
first, so scrolling, pagination and jump-to-message can be checked against a message that says
exactly where you are. Authors and timestamps alternate between runs of the same person seconds
apart, which the client draws as one group, and switches or longer gaps, which it draws
separately.

`--size small|medium|large` changes the volume (large is 25k messages, for pagination and
search), `--seed <number>` changes the cast, and `--counting <n>` resizes the numbered channel
(`0` skips it). The same seed always produces the same server.

## Testing

To run tests, use the following command:

```bash
bun run test
```

(if you only run `bun test` it's gonna fail, you NEED to run `bun run test`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## Desktop ownership

`apps/desktop/src/main.ts` configures the app before readiness, creates the services,
registers IPC, and disposes services on quit. Keep that startup order explicit.

| Module | Owns |
| --- | --- |
| `preferences.ts`, `atomic-json.ts` | Settings, encrypted secret persistence, atomic JSON replacement |
| `diagnostics.ts`, `log-retention.ts`, `log-details.ts` | Diagnostic output, rotation, redaction |
| `desktop-updater.ts` | Lazy updater initialization, status and listener disposal |
| `desktop-downloads.ts` | Pending/active downloads, save dialogs, completed-file lookup |
| `push-to-talk.ts` | Native input listeners and held-key state |
| `application-audio.ts` | Native helper from spawn through startup, streaming and shutdown |
| `desktop-capture.ts` | Capture selection and Electron permission handlers |
| `desktop-window.ts` | Window/tray behavior, navigation, deep links and crash recovery |
| `desktop-ipc.ts`, `trusted-renderer.ts` | Owned IPC registration and trusted main-frame validation |

Each operation's owner registers its IPC and validates its payload. All registration
goes through `createDesktopIpc`, which validates the sender before dispatch. Dispose
native resources on renderer reload/crash/closure as well as app quit. Do not stop
capture for subframe navigation. Repeated registration and cleanup must be safe.

The browser-safe bridge contract is declared once in
`packages/shared/desktop-api.d.ts`; both client and desktop import it as types only.
Do not add Electron or Node runtime imports to that contract.

Run desktop lifecycle tests and the static security inventory with
`bun run --cwd apps/desktop test` and `bun run --cwd apps/desktop check:security`.
The packaged startup script uses an isolated profile and now verifies real
renderer/preload/IPC round trips. It does not verify audible capture, background
hotkeys, or an installed update; those remain live acceptance checks.

Application and capture diagnostic logs rotate at 5 MiB and retain two archives.
Chromium's media log rotates only before startup because Chromium owns its active
file, so its size is not bounded during a single long session. Preferences and
secrets use temporary files in the destination directory followed by replacement;
failed writes retain the previous file. Encryption still uses Electron safeStorage.

## Voice resource ownership and recovery

`VoiceProvider` composes the owners below. No state-machine library or dependency
was added. Session identity is the current voice channel plus the active tRPC
client and connected state. Each acquisition also belongs to a cancellable local
operation, so completion after leave, replacement or unmount releases its own
resource instead of installing it into a newer call.

| Owner | Resources and release |
| --- | --- |
| `hooks/use-voice-session.ts` | Initialization, transport recovery, connection status and the ordered teardown. Cancel pending work before stopping stats, microphone, webcam, screen, local/remote/external streams and transports. Clear capability refs last. Leave, disconnected/server change and unmount use the same cleanup. |
| `hooks/use-microphone.ts` | Raw microphone stream, noise-gate context/node/output, suppression contexts/output and audio producer. Register resources as acquired. Release late streams/producers immediately. Worklet loaders close contexts if startup fails before returning ownership. |
| Webcam in `index.tsx` | Camera stream and video producer. Cancel before clearing UI/ref state; a late producer is closed without replacing the current one. |
| `hooks/use-screen-capture.ts` | Picker request, display stream, screen/audio producers and process-audio track. Cancel the picker and pending acquisition on stop. Recovery never reopens the picker. |
| `process-audio-capture.ts` | Application-audio context, worklet, destination track, PCM subscription, diagnostics timer and native capture ID. Startup failure and idempotent stop release them. A capture-ID-scoped IPC stop cannot kill a replacement helper. The main process still owns helper spawn/exit and renderer-lifetime cleanup. |
| `hooks/use-transports.ts` | Send/receive transports and consumer map. Increment generation before closing them. Old callbacks cannot clear replacement transports; late consumers close without publishing remote streams. Await the initial producer enumeration before declaring startup complete. |
| `hooks/use-local-streams.ts` | React stream state and producer refs. Stable cleanup reads the latest rendered streams; capture owners also release resources acquired before another render. |
| `hooks/use-voice-events.ts` | Four voice subscriptions, removed on effect cleanup. The existing cleanup flag rejects callbacks after unsubscribe; asynchronous consumers additionally check transport/session ownership. |
| `hooks/use-transport-stats.ts`, `screen-audio-diagnostics.ts` | Stats polling. Session teardown stops transport monitoring; closing the screen-audio producer removes its timer/listeners and ignores pending stats results. |

Recovery policy:

- An ICE failure while the same server-side voice session is valid rebuilds
  transports, receivers and microphone. Existing mute/deafen state and selected
  devices remain. Camera and screen sharing turn off and require a new user action.
- A lost WebSocket session clears local voice membership before server reconnect
  backoff. Reconnecting the server does not automatically join voice. Select a
  voice channel again. This handles the stale connected UI described in upstream
  [#849](https://github.com/Sharkord/sharkord/issues/849).
- Recovery validates server membership before rebuilding. A missing session,
  revoked access or another recovery error clears local membership and stops.
  There is no voice rejoin retry loop. Server kick/ban/removal follows teardown.
- Microphone acquisition failure retains the existing listen-only behavior.
  Camera/screen startup failures roll back their enable state. Stale responses
  cannot roll back mute/deafen or capture state in a replacement session.

Deterministic coverage is in `voice-lifecycle.test.ts`, `voice-operation.test.ts`,
`process-audio-capture.test.ts`, the suppression worklet startup tests and desktop
`application-audio.test.ts`. The hook harness uses server rendering to exercise
callbacks and refs; it does not run React effects, native devices or actual WebRTC.
It reproduces missing-session rejection with surviving transports, not the
reporter's exact network/browser environment.

Before release, run two actual participants through: transient ICE failure with
WebSocket intact; WebSocket loss/server restart; sleep/resume; kick/ban and channel
permission removal; selected-device removal; and repeated camera/screen/native
audio start/stop, including leaving while a picker or permission prompt is open.
Check audible send/receive, unchanged mute/deafen/device choice, no silent capture
restart, no rejoin loops, and no leftover native helper, tracks or subscriptions.

## Test-artifact retention workflow

Keep disposable test runs under `.artifacts/test-runs/<run-name>/`, with a `run.json`
manifest containing an ISO `createdAt` and `releaseVerification` set to
`not-required`, `pending` or `complete`. Mark final candidate evidence `pending`
until its release checks are verified. A `.keep` marker also protects a run.
Only a maintainer completing those checks should change `pending` to `complete`.

From `packages/scripts`, run `bun run artifacts:prune` to print the dry-run JSON
plan. Review the paths, then use `bun run artifacts:prune --apply` to apply it.
The command retains at least five eligible runs and all runs newer than 14 days;
it removes no more than 20 old runs per invocation. It does not collect or move
artifacts automatically. Redirect ordinary test output into a named run directory
and write its manifest when the run finishes; use `pending` for release evidence.

Only that managed root is scanned. Missing/invalid manifests, pending release
verification, `.keep`, directory links/junctions, databases, installers and data/
backup directories are preserved. The command rejects linked artifact roots and
rechecks absolute targets before deletion. `.integration`, development data,
development backups, earlier installers and existing phase validation logs are
outside its deletion scope. Current Playwright output directories are also outside
scope; copy desired disposable reports into a managed run after testing ends.
No existing validation evidence is deleted when introducing this workflow.

Do not run server integration tests concurrently with Playwright: both normally
bind mediasoup UDP 40000. Use sequential suites or separately configured ports.

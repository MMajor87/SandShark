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

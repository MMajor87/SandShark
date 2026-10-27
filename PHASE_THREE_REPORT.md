# Phase 3 implementation and validation

October 27, 2026. Implemented in `.integration/sharkord-v0.0.28` on local branch
`refactor/phase-three`, based on Phase 2 at `4734e0b0`. Code commit: `e3ea7444`.
The root checkout and its pre-existing changes were preserved. No push, PR,
publication, installation or deployment was performed.

## Completed implementation

| TODO | Result |
| --- | --- |
| R11 | Documented resource ownership in DEVELOPMENT.md. Added regressions for late capture/transport/consumer completion, partial startup failure and repeated cleanup. Native-audio cleanup targets its capture ID, so an old operation cannot stop a replacement helper. Application-audio failure paths release their context, output track, worklet, subscription and timer. Suppression worklet failures close their context and stop any acquired output track. |
| R12 | Extracted microphone processing and screen capture into local hooks. Transport ownership remains in `use-transports`; desktop bridge access goes through `platform/desktop`. Webcam ownership remains local to VoiceProvider. |
| R13 | Consolidated initialization, cleanup and recovery in `use-voice-session`. Local acquisition owners and transport generations reject demonstrated stale asynchronous completions. Old events cannot clear replacement transport refs. Initial producer enumeration is awaited, and transport startup errors now propagate to session cleanup. |
| R14 | Reproduced the failure class in a deterministic hook harness: stale transports coexist with missing server membership, recovery is rejected, and local membership is cleared without a rejoin loop. WebSocket loss now clears voice state before server reconnect backoff. This is not a live reproduction of the exact Safari/network conditions reported in upstream #849. |
| R15 | Valid transport recovery rebuilds receivers and microphone while retaining mute/deafen and device choices. Camera and screen capture stay off until explicitly restarted. Missing membership, permission/ban rejection or failed recovery clears local voice state. A lost WebSocket requires an explicit voice join after the server reconnects. |

The ownership table, teardown order, recovery policy and live acceptance matrix are
in [DEVELOPMENT.md](DEVELOPMENT.md#voice-resource-ownership-and-recovery).
[REFACTOR_PLAN.md](REFACTOR_PLAN.md) marks R11-R15 implementation complete and keeps
the Phase 3 live exit gate unchecked.

No dependencies, server endpoints, schema/migrations, native C# code or translation
keys were added. Existing user-facing strings moved with the extraction. Microphone
acquisition failure retains the previous listen-only behavior. Full logout, terminal
auth failure and switching servers retain their existing reset semantics.

## Validation

- `bun run magic`: passed, with four existing Fast Refresh lint warnings and no errors.
- `bun run test`: 2,197 passed, zero failures (desktop 33, shared 216, client 188, server 1,760). This adds 33 passing cases over Phase 2.
- Desktop static security inventory: passed, 39 uniquely owned IPC channels.
- Native helper, main and renderer builds and NSIS packaging passed. Vite retains its existing large-chunk warning.
- Final packaged startup passed with a temporary profile; actual renderer/preload/guarded IPC round trips were verified.
- All 35 preserved development-backup SHA256 entries still match. Development data was not reset or migrated.

Browser regression rerun: **52 passed, one skipped, one failed**. The remaining
failure is `scroll-position.pw.ts:63`, "a channel full of media opens at the bottom
and stays there", also recorded in Phase 1. It remains an unresolved release gate.
An earlier run had two navigation/login timeouts; neither recurred on fresh
fixtures with source editing stopped. Do not treat the suite as fully green.
The final suppression cleanup adjustment was separately type-checked/unit-tested
and included in the packaged smoke test; browser specs do not exercise live audio.

One intermediate workspace run failed because it overlapped the E2E server:
mediasoup could not bind UDP 40000, causing downstream HTTP test failures. Keep
those suites sequential; this is separate from the browser media-scroll failure.

Final evidence is retained in root `.integration/phase-three-magic-final.log`,
`phase-three-tests-verified.log`, `phase-three-e2e-final.log`,
`phase-three-security.log`, `phase-three-native-build.log`,
`phase-three-build-final.log`, `phase-three-package-final.log` and
`phase-three-packaged-startup-final.log`. Intermediate failure logs are preserved.

## Candidate and remaining release gates

Unsigned local candidate, version 1.1.1 for internal validation only:
`.integration/phase-three-desktop-release/SandShark-1.1.1-Setup-x64.exe`.

SHA256: `6B222B11A0DFFE3BC57FB2201CB5D3BD942FE2B88844D35727ADA73FB93ED8DC`.

The separate output directory preserves earlier phase candidates. This is not a
published update; identify it by the code commit and installer hash.

Real two-participant voice tests remain required: ICE failure with WebSocket
intact, WebSocket loss/server restart, sleep/resume, kick/ban/permission removal,
selected-device removal and repeated camera/screen/native-audio start/stop.
Verify audible send/receive, mute/deafen/device preservation, explicit capture
restart, no rejoin loops and no residual helper or media resources.

The deterministic hook harness uses server rendering and does not execute React
effects, real WebRTC, OS pickers or physical devices. Automated tests cannot
establish audible correctness. Existing signing, clean hosted Windows CI,
real-provider SSO and other prior-phase release gates remain open.

# Desktop Voice Validation

## Device and processing coverage

- `DevicesProvider` enumerates microphone and output devices, reacts to device changes, resolves removed selections to an available default, and persists the selected IDs in `DEVICES_SETTINGS`.
- The Devices settings screen requests microphone permission, shows a live microphone level, and runs a loopback test using the selected microphone and speaker.
- The loopback path uses `HTMLAudioElement.setSinkId()` where the Electron runtime supports it. Unsupported runtimes continue with the system default output.
- Microphone constraints carry the selected input, echo cancellation, automatic gain control, and standard browser noise suppression settings.
- The live and test paths both apply the noise gate AudioWorklet when available, expose its availability to the settings UI, and fall back safely if initialization fails.
- RNNoise and DTLN processing are applied through the existing audio-worklet chain; failures retain an unprocessed microphone track rather than aborting voice.
- Deafen sets every remote audio element to muted. Per-user, screen-share, and external-stream volume controls persist independently and can be muted/restored.

## mediasoup lifecycle coverage

- A `mediasoup-client` device is loaded from the router RTP capabilities before send and receive transports are created.
- Producer and consumer transport setup now throws initialization errors to the voice entry point instead of silently continuing without media.
- Existing producers are consumed after a transport is established, and producer events consume newly arriving remote streams. Remote streams are stored by user and stream kind, so simultaneous speakers remain independent.
- Switching or leaving a voice channel closes producers, consumers, transports, local tracks, remote streams, and transport-stat monitoring.
- A failed send or receive transport triggers a bounded in-channel recovery: SandShark rebuilds the mediasoup device/transports, re-consumes active producers, restarts the microphone path, and resumes monitoring. Two failed recovery attempts surface a failed voice state instead of retrying forever.

## Manual acceptance pass

Use the authorized test server for an authenticated, two-user smoke test:

`<authorized-development-server>`

1. On each desktop client, select a microphone and speaker, save settings, grant microphone permission, then confirm the loopback test and meter respond.
2. Join the same voice channel with two accounts. Confirm both microphones, mute/deafen behavior, per-user volume, and two simultaneous remote speakers.
3. Switch one client to another voice channel and back, then briefly interrupt its network connection. Confirm remote audio resumes after transport recovery or that a clear failed state is shown.

The automated checks for this phase are static/type/build validation. The manual pass intentionally requires authorized accounts and real audio devices; it is not performed by creating data on the shared test server.

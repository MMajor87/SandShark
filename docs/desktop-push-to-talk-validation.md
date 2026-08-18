# Desktop Push-to-Talk Validation

## Implementation

- Push-to-talk preferences are stored locally in `sandshark-push-to-talk-settings` and include an enabled state plus the selected key.
- The Devices settings screen lets desktop users enable push-to-talk and capture a supported key. The default is Space while the feature remains disabled until explicitly enabled.
- The Electron main process owns the global input hook. It receives native keydown and keyup events even while SandShark is unfocused, then forwards only the active/inactive state through the context-isolated preload bridge.
- The renderer does not receive Node or native input-hook access. IPC accepts only validated integer key codes from the trusted main window.
- Holding the configured key temporarily unmutes a previously muted microphone. Releasing it restores that mute state. Deafen, disconnect, disabled preferences, and provider unmounting clear the active indicator and prevent a held state from persisting.
- The active PTT indicator appears beside the voice controls while transmitting.

## Advanced controls

- Key capture records Control, Shift, Alt, and Meta modifiers with the selected keyboard key. The native hook requires the same modifier state before activating PTT.
- Mouse buttons one through five can be captured and used as the global hold input, with optional modifier chords.
- Push-to-mute temporarily mutes an otherwise unmuted microphone and restores its original state on release.
- Activation and release delays are independently configurable from 0 to 1000 ms in 25 ms steps. Delays are applied in the renderer after the main process reports the raw native hold state, so key and mouse release remains immediate and reliable at the input boundary.

## Packaging

`uiohook-napi` is a runtime dependency and is unpacked from the Electron ASAR archive so its Windows native binding can load in packaged builds.

## Manual Windows acceptance pass

Use an authenticated desktop client connected to:

`<authorized-development-server>`

1. Enable push-to-talk, choose Space or a letter key, join a voice channel muted, then hold/release the key while SandShark is focused and while another application is focused.
2. Confirm the active indicator appears only while held, remote users hear audio only while held, and release restores the prior mute state.
3. Disable PTT while holding the key, leave a voice channel while holding it, and reconnect after an interrupted network connection. Confirm the microphone never remains unexpectedly unmuted.
4. Test a modifier chord and a mouse side button. Confirm the configured input works only when the required modifiers are held.
5. Test Push to Mute and nonzero activation/release delays. Disable or reconfigure PTT while held and confirm the microphone returns to its original state.

The global hook is currently scoped to Windows.

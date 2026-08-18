# Desktop Screen Share Validation

## Capture flow

- Browser builds retain the existing `getDisplayMedia()` flow.
- The desktop client exposes a narrow preload API that lists Electron `desktopCapturer` sources from the trusted main window only.
- The renderer presents display and application-window thumbnails in a native-client picker. Selecting a source passes its opaque Electron source ID to `getUserMedia()` and then into the existing screen-share mediasoup producer.
- The capture API returns at most 64 sources and only source metadata plus thumbnail data URLs. Electron and Node APIs remain unavailable to the renderer.
- Electron media permission is granted only to the trusted SandShark renderer window. Operating-system privacy permissions still apply.

## Media behavior

- Display and window capture honor the selected screen resolution and frame-rate preferences.
- Screen-share video continues through the existing codec selection, simulcast fallback, producer lifecycle, remote rendering, quality controls, and transport stats paths.
- System audio is requested only when the local Share System Audio preference is enabled. If Electron or Windows does not return an audio track for a selected source, SandShark keeps the video share running and reports the video-only fallback.
- Screen/window audio availability varies by Electron, Chromium, Windows version, source type, driver, and operating-system privacy policy. Window capture should be treated as video-first; system audio is not guaranteed.

## Manual Windows acceptance pass

Use authenticated desktop clients against the authorized server:

`<authorized-development-server>`

1. Open the picker and confirm all connected displays, a separate application window, and the SandShark window appear with current thumbnails.
2. Share each source type, including every display on a multi-monitor machine, and confirm remote video renders and stops when capture ends.
3. Enable Share System Audio and test a full-display share and a window share. Confirm video remains available when no audio track is supplied.
4. Verify the remote screen-share quality control and reconnect behavior while a display is active.

The automated coverage for this phase is type/lint/build validation plus a read-only server reachability check. The hardware, multi-monitor, and audio portions require a real Windows desktop with authorized accounts, so SandShark does not create accounts or test data on the shared server.

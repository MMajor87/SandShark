# Desktop settings validation

The Desktop settings tab is visible only in SandShark desktop builds. It centralizes window and tray behavior, Windows startup, native notification delivery, global push-to-talk and its shortcut, hardware acceleration, and the current desktop version.

Hardware acceleration is stored in the desktop process before Chromium starts. Changing it updates the next launch preference and explicitly requires a restart. Update delivery is not configured yet; its button reports that state until the dedicated update phase supplies a release feed.

Manual Windows validation:

1. Confirm the Desktop tab is not present in a browser session and appears in SandShark.
2. Change startup, minimized, tray, and close behavior, restart, and confirm the settings persist.
3. Toggle native notifications and global push-to-talk; exercise the selected shortcut while SandShark is unfocused.
4. Toggle hardware acceleration, restart SandShark, and confirm the selected renderer mode is retained.
5. Confirm the displayed version matches the packaged desktop version and the update button clearly reports that updates are not configured.

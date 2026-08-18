# Desktop notification validation

Phase 17 routes desktop notifications through Electron while retaining the
existing message, mention, direct-message, reply, and per-channel mute
preferences.

Manual validation with authenticated accounts on the shared test server:

1. Open SandShark, connect to the test server, and enable one notification
   preference in User Settings > Notifications.
2. Minimize or hide SandShark, then send a qualifying message from another
   account. Confirm the Windows notification shows the SandShark icon, server,
   sender, channel or DM context, and message preview.
3. Click the notification. Confirm SandShark restores, the relevant saved
   server profile is selected, and the message channel opens with the message
   highlighted when it is available in the loaded channel history.
4. Confirm no desktop notification appears while SandShark is focused.
5. Use a channel context menu to mute notifications, repeat the message test,
   and confirm that channel produces no notification. Unmute and confirm
   notifications resume.

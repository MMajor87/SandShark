# Windows startup validation

Phase 16 uses Electron's Windows login-item API with the SandShark executable
path and a fixed `--sandshark-start-minimized` launch argument.

Manual validation on an installed Windows build:

1. In User Settings > Others, enable **Start SandShark with Windows**.
2. Confirm the setting remains enabled after restarting SandShark.
3. Sign out of Windows or reboot, then sign in and confirm SandShark starts in
   the system tray without opening its main window.
4. Disable the setting and repeat the sign-in check; SandShark must not start.
5. Enable the setting again, uninstall SandShark, then verify its startup
   registration no longer appears in Windows startup apps and it does not run
   at the next sign-in.

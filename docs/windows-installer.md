# Windows installer

SandShark uses electron-builder with an NSIS x64 installer. The package output is named `SandShark-<version>-Setup-x64.exe` and installs the `SandShark.exe` desktop client.

The installer creates Start Menu and desktop shortcuts, registers both `sandshark://` and legacy `sharkord://` protocols, and preserves the Electron user-data directory on uninstall. SandShark's Windows startup preference is registered by the application itself through Electron's login-item API.

The installer is intentionally unsigned until the code-signing phase. Build it with:

```powershell
bun run --cwd apps/desktop package
```

Manual validation on Windows:

1. Install the generated x64 setup executable and confirm Start Menu and desktop shortcuts launch `SandShark.exe`.
2. Open a `sandshark://` and a `sharkord://` link after installation.
3. Enable Start with Windows, reinstall or restart, and confirm the login-item setting still works.
4. Uninstall, confirm the app is removed, and verify that user settings are preserved unless manually removed.

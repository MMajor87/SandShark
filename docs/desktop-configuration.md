# Desktop configuration

SandShark uses scoped local configuration rather than a single catch-all store:

- Server profiles, active server selection, push-to-talk, and notification preferences remain in the desktop renderer's local storage.
- Window geometry and tray behavior are stored in `window-state.json` under Electron `userData`.
- Hardware acceleration is stored in `desktop-preferences.json` and read before Chromium starts.
- Desktop auto-login tokens are stored separately in `desktop-secrets.json`, encrypted with Electron `safeStorage` and the operating system's data-protection service. The renderer never receives the encrypted file contents.

The desktop token migration removes legacy plaintext `autoLoginToken` values from server-session local storage on first use. When `safeStorage` is unavailable, SandShark does not persist a desktop auto-login token. Passwords are not saved by the desktop client.

Update preferences remain pending because SandShark does not have an update feed yet. Windows Credential Manager was evaluated but is not needed while Electron safeStorage provides OS-backed encryption for the single persisted secret category.

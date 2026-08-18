# Multi-Server Foundation

## Server profiles

SandShark stores desktop server profiles in `sandshark-server-profiles`. Each profile includes:

- Stable server ID, URL, WebSocket URL, display name, and icon fallback.
- Last-connected timestamp for default ordering and reconnect selection.
- A reserved preferences object for profile-local settings.
- The active profile ID in `sandshark-active-server-profile-id`.

The legacy single-server connection is migrated when the profile store is first read.

## Server switching

Switching closes the active WebSocket and resets only in-memory server state. It does not erase the selected profile's session. Selecting a profile then reloads its server info and starts the existing auto-login flow.

Removing a profile clears its server-scoped session record before removing the profile.

## Future behavior

- Authentication remains keyed by server ID; a URL whose reported server ID changes has its old session cleared.
- Notifications should carry the profile ID and use the profile display name in their desktop title.
- Unread counts should be persisted as a `Record<profileId, counts>` and rendered from the active profile only.
- The UI swaps profiles by resetting the foreground connection. Background connections are intentionally deferred until notification and unread state are profile-aware.

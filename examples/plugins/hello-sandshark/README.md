# Hello SandShark

A starter plugin for SandShark. It shows the pieces most plugins use:

- a `/hello` slash command, which reads the user who ran it;
- a server setting an admin can change: the greeting;
- an action called from the plugin's own UI, which keeps a count in plugin storage;
- an event handler that writes to the plugin's log;
- a page under user settings.

To try it, copy this folder into the `plugins` folder in the server's data directory. Then open Server settings, Plugins, and enable **Hello SandShark**. Members need the **Use plugins** permission to run `/hello` and see the page.

[The plugins guide](../../../docs/plugins.md) explains each part and the rest of the API.

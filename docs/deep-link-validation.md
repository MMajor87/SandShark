# Deep-link validation

SandShark registers the `sandshark://` protocol on Windows. Incoming links are validated in Electron and again in the renderer before they can select a server profile or route to a channel.

Supported links:

- `sandshark://server/chat.example.com`
- `sandshark://server/chat.example.com/channel/123`
- `sandshark://channel/123`
- `sandshark://invite/<server origin, URL encoded>/<invite code>`, for example `sandshark://invite/http%3A%2F%2F192.168.1.20%3A4991/abc123`. The whole origin is encoded, so a server without TLS keeps `http`. It adds the server like a server link, then opens its connect screen with the invite code ready to register with. The web client offers this link as **Open in the SandShark app** when opened with an invite, and the server picker also accepts the web invite link (`https://chat.example.com/?invite=abc123`) pasted as the server URL.

Server links are validated through the server's `/info` endpoint before being added or updated locally. The main process queues up to 16 valid links while the renderer starts, handles links passed to a second instance, and never permits the custom protocol to replace the SandShark renderer.

Manual validation on Windows:

1. With SandShark closed, open a valid `sandshark://server/<host>` link and confirm it opens the app and adds the server only after `/info` succeeds.
2. With SandShark running, open `sandshark://channel/<id>` and confirm it focuses the app and opens that available channel.
3. Attempt malformed, credential-bearing, unsafe-protocol, or non-numeric channel links and confirm no navigation or profile change occurs.

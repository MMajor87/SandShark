# Deep-link validation

SandShark registers both `sandshark://` and the legacy `sharkord://` protocol on Windows. Incoming links are validated in Electron and again in the renderer before they can select a server profile or route to a channel.

Supported links:

- `sandshark://server/chat.example.com`
- `sandshark://server/chat.example.com/channel/123`
- `sandshark://channel/123`

`sharkord://` can be used in place of `sandshark://` for existing links. Server links are validated through the server's `/info` endpoint before being added or updated locally. The main process queues up to 16 valid links while the renderer starts, handles links passed to a second instance, and never permits the custom protocol to replace the SandShark renderer.

Manual validation on Windows:

1. With SandShark closed, open a valid `sandshark://server/<host>` link and confirm it opens the app and adds the server only after `/info` succeeds.
2. With SandShark running, open `sandshark://channel/<id>` and confirm it focuses the app and opens that available channel.
3. Open `sharkord://server/<host>/channel/<id>` to verify the legacy scheme follows the same flow.
4. Attempt malformed, credential-bearing, unsafe-protocol, or non-numeric channel links and confirm no navigation or profile change occurs.

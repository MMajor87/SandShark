# External link validation

Phase 19 keeps the SandShark renderer limited to its packaged UI. It opens only
validated HTTP(S) URLs in the operating system's default browser and blocks all
other external protocols. Validated `sandshark://` and legacy `sharkord://`
links are intercepted for the Phase 20 deep-link router rather than loaded in
the renderer.

Manual validation:

1. Open an HTTPS link from SandShark and confirm it opens in the default
   browser without replacing the desktop window.
2. Attempt to open `file:`, `javascript:`, `data:`, and a URL containing
   embedded credentials; confirm none are opened.
3. Trigger a redirect to an external URL and confirm it follows the same
   browser handoff.
4. Trigger a valid `sandshark://` or `sharkord://` URL and confirm the desktop
   renderer does not navigate away. Phase 20 adds its destination handling.

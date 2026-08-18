# File transfer validation

The existing SandShark upload flow handles drag-and-drop, file-picker, image, clipboard-image, and large-file uploads with permission, server-limit, preview, and progress handling.

Desktop attachment downloads now open a native Save dialog before the transfer starts. SandShark sanitizes the suggested filename, reports progress, and offers Open and Show after completion. The main process retains only the 32 most recent completed download paths, addressed by opaque download IDs.

Manual validation on the shared test server:

1. Upload a file by picker, drag-and-drop, and clipboard paste; confirm previews and progress appear.
2. Upload an image and a file near the server size limit; confirm the limit failure is shown without sending an oversized file.
3. Download an attachment, choose a location, and verify progress, Open, and Show actions.
4. Download a filename containing path separators, reserved Windows characters, or trailing dots and confirm the saved suggestion is safe.

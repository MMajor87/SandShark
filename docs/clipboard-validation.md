# Clipboard validation

SandShark keeps clipboard handling in the renderer. This preserves Chromium and Tiptap's standard text and rich-text behavior, while the compose container reads `ClipboardEvent.clipboardData` file items to use pasted images as regular attachments.

The desktop preload API does not expose Electron's `clipboard` module. The main-process permission handler grants only trusted renderer media requests, so SandShark does not request or create an additional clipboard permission path.

Manual validation on the shared test server:

1. Copy plain text into a message compose field and confirm it pastes and sends unchanged.
2. Copy rich text with links and basic formatting and confirm Tiptap retains the supported formatting without opening links.
3. Paste an image from the system clipboard and confirm it enters the existing attachment upload flow with preview and progress.
4. Confirm copying an invite, image URL, or error detail still uses the browser clipboard API without a desktop permission prompt.

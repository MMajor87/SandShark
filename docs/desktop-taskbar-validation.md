# Windows taskbar validation

Phase 18 mirrors SandShark unread state to a Windows taskbar overlay. General
unread messages use a blue count; unread mention channels use a red count and
take precedence. Counts above 99 are shown as `99+`.

Manual validation with authenticated accounts on the shared test server:

1. Hide or minimize SandShark and send a normal qualifying message from a
   second account. Confirm the taskbar shows a blue unread overlay.
2. Send a qualifying mention. Confirm the overlay turns red with the mention
   count and the taskbar flashes.
3. Open or mark all affected channels as read. Confirm the overlay disappears
   after the unread and mention counts reach zero.
4. Focus SandShark after a flash. Confirm the taskbar stops requesting
   attention.

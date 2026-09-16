# Sharkord reference inventory

Track decisions and completed changes in the [branding TODO checklist](sandshark-branding-todo.md).

Snapshot: September 15, 2026. Case-insensitive scan of existing Git-tracked text files in the main checkout. Counts exclude `bun.lock`, which is reported separately. Dependencies, generated output, `.git`, the secondary integration worktree, runtime data, and deleted files are excluded. Line numbers describe this snapshot. Image contents are not included in this text scan.

Found 1088 text occurrences on 1049 lines across 601 files. 605 lines contain only package-namespace references; 444 contain another use of the name. Translations account for 132 matching lines across 32 files. The lockfile contains another 22 matching lines.

See [the change assessment](sandshark-branding-audit.md) for proposed changes and compatibility considerations.

## File index

| File | Matching lines | Occurrences | Line numbers |
| --- | ---: | ---: | --- |
| [.github/ISSUE_TEMPLATE/bug_report.yml](../.github/ISSUE_TEMPLATE/bug_report.yml) | 3 | 3 | 2, 27, 36 |
| [.github/ISSUE_TEMPLATE/feature_request.yml](../.github/ISSUE_TEMPLATE/feature_request.yml) | 3 | 7 | 2, 11, 12 |
| [.github/ISSUE_TEMPLATE/question.yml](../.github/ISSUE_TEMPLATE/question.yml) | 1 | 1 | 13 |
| [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) | 1 | 2 | 4 |
| [.github/actions/build-sharkord/action.yml](../.github/actions/build-sharkord/action.yml) | 1 | 1 | 1 |
| [.github/workflows/develop-image.yml](../.github/workflows/develop-image.yml) | 5 | 6 | 23, 30, 32, 33, 34 |
| [.github/workflows/release.yml](../.github/workflows/release.yml) | 12 | 13 | 36, 55, 56, 58, 59, 61, 70, 71, 72, 73, 74, 82 |
| [AGENTS.md](../AGENTS.md) | 1 | 1 | 3 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 7 | 7 | 1, 5, 9, 11, 24, 26, 50 |
| [Dockerfile](../Dockerfile) | 8 | 12 | 8, 9, 13, 14, 17, 18, 19, 21 |
| [LICENSE](../LICENSE) | 1 | 1 | 3 |
| [README.md](../README.md) | 3 | 4 | 3, 5, 9 |
| [ROADMAP.md](../ROADMAP.md) | 1 | 1 | 1 |
| [UPSTREAM_MERGE_ASSESSMENT.md](../UPSTREAM_MERGE_ASSESSMENT.md) | 5 | 7 | 1, 3, 7, 8, 25 |
| [UPSTREAM_MERGE_CHECKLIST.md](../UPSTREAM_MERGE_CHECKLIST.md) | 6 | 6 | 1, 3, 5, 11, 169, 173 |
| [UPSTREAM_MERGE_RELEASE_NOTES.md](../UPSTREAM_MERGE_RELEASE_NOTES.md) | 1 | 1 | 1 |
| [apps/client/package.json](../apps/client/package.json) | 2 | 2 | 24, 25 |
| [apps/client/src/audio-worklets/audio-meter-processor.js](../apps/client/src/audio-worklets/audio-meter-processor.js) | 1 | 1 | 1 |
| [apps/client/src/audio-worklets/noise-gate-processor.js](../apps/client/src/audio-worklets/noise-gate-processor.js) | 1 | 1 | 1 |
| [apps/client/src/components/channel-chip/index.tsx](../apps/client/src/components/channel-chip/index.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/channel-view/text/file-card.tsx](../apps/client/src/components/channel-view/text/file-card.tsx) | 2 | 2 | 2, 3 |
| [apps/client/src/components/channel-view/text/helpers.ts](../apps/client/src/components/channel-view/text/helpers.ts) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/hooks/use-arrow-up-edit.ts](../apps/client/src/components/channel-view/text/hooks/use-arrow-up-edit.ts) | 1 | 1 | 3 |
| [apps/client/src/components/channel-view/text/hooks/use-message-author-name.ts](../apps/client/src/components/channel-view/text/hooks/use-message-author-name.ts) | 1 | 1 | 4 |
| [apps/client/src/components/channel-view/text/index.tsx](../apps/client/src/components/channel-view/text/index.tsx) | 2 | 2 | 20, 21 |
| [apps/client/src/components/channel-view/text/message-actions.tsx](../apps/client/src/components/channel-view/text/message-actions.tsx) | 2 | 2 | 13, 14 |
| [apps/client/src/components/channel-view/text/message-edit-inline.tsx](../apps/client/src/components/channel-view/text/message-edit-inline.tsx) | 2 | 2 | 7, 8 |
| [apps/client/src/components/channel-view/text/message-reactions.tsx](../apps/client/src/components/channel-view/text/message-reactions.tsx) | 2 | 2 | 10, 11 |
| [apps/client/src/components/channel-view/text/message-reply-preview-wrapper.tsx](../apps/client/src/components/channel-view/text/message-reply-preview-wrapper.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/channel-view/text/message.tsx](../apps/client/src/components/channel-view/text/message.tsx) | 1 | 1 | 10 |
| [apps/client/src/components/channel-view/text/messages-group.tsx](../apps/client/src/components/channel-view/text/messages-group.tsx) | 1 | 1 | 10 |
| [apps/client/src/components/channel-view/text/overrides/command.tsx](../apps/client/src/components/channel-view/text/overrides/command.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/overrides/image.tsx](../apps/client/src/components/channel-view/text/overrides/image.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/channel-view/text/overrides/video-player.tsx](../apps/client/src/components/channel-view/text/overrides/video-player.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/pinned-messages-popover.tsx](../apps/client/src/components/channel-view/text/pinned-messages-popover.tsx) | 2 | 2 | 5, 13 |
| [apps/client/src/components/channel-view/text/preview-file.tsx](../apps/client/src/components/channel-view/text/preview-file.tsx) | 2 | 2 | 4, 5 |
| [apps/client/src/components/channel-view/text/renderer/content-cache.ts](../apps/client/src/components/channel-view/text/renderer/content-cache.ts) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/renderer/helpers.ts](../apps/client/src/components/channel-view/text/renderer/helpers.ts) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/renderer/index.tsx](../apps/client/src/components/channel-view/text/renderer/index.tsx) | 2 | 2 | 11, 12 |
| [apps/client/src/components/channel-view/text/renderer/media-cache.ts](../apps/client/src/components/channel-view/text/renderer/media-cache.ts) | 1 | 1 | 8 |
| [apps/client/src/components/channel-view/text/renderer/message-render-fallback.tsx](../apps/client/src/components/channel-view/text/renderer/message-render-fallback.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/renderer/serializer.tsx](../apps/client/src/components/channel-view/text/renderer/serializer.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/channel-view/text/renderer/types.ts](../apps/client/src/components/channel-view/text/renderer/types.ts) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/reply-preview-helpers.ts](../apps/client/src/components/channel-view/text/reply-preview-helpers.ts) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/text-skeleton.tsx](../apps/client/src/components/channel-view/text/text-skeleton.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/text/text-top-bar.tsx](../apps/client/src/components/channel-view/text/text-top-bar.tsx) | 2 | 2 | 3, 4 |
| [apps/client/src/components/channel-view/text/use-draft-messages.tsx](../apps/client/src/components/channel-view/text/use-draft-messages.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/channel-view/text/users-typing.tsx](../apps/client/src/components/channel-view/text/users-typing.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/channel-view/voice/card-theme.tsx](../apps/client/src/components/channel-view/voice/card-theme.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/voice/control-toggle-button.tsx](../apps/client/src/components/channel-view/voice/control-toggle-button.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/channel-view/voice/controls-bar.tsx](../apps/client/src/components/channel-view/voice/controls-bar.tsx) | 2 | 2 | 9, 10 |
| [apps/client/src/components/channel-view/voice/external-stream-card.tsx](../apps/client/src/components/channel-view/voice/external-stream-card.tsx) | 2 | 2 | 10, 11 |
| [apps/client/src/components/channel-view/voice/fullscreen-button.tsx](../apps/client/src/components/channel-view/voice/fullscreen-button.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/voice/helpers.ts](../apps/client/src/components/channel-view/voice/helpers.ts) | 1 | 1 | 2 |
| [apps/client/src/components/channel-view/voice/hooks/use-voice-refs.ts](../apps/client/src/components/channel-view/voice/hooks/use-voice-refs.ts) | 1 | 1 | 7 |
| [apps/client/src/components/channel-view/voice/picture-in-picture-button.tsx](../apps/client/src/components/channel-view/voice/picture-in-picture-button.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/voice/pin-button.tsx](../apps/client/src/components/channel-view/voice/pin-button.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/voice/quality-button.tsx](../apps/client/src/components/channel-view/voice/quality-button.tsx) | 2 | 2 | 7, 16 |
| [apps/client/src/components/channel-view/voice/quality-options.ts](../apps/client/src/components/channel-view/voice/quality-options.ts) | 1 | 1 | 1 |
| [apps/client/src/components/channel-view/voice/screen-share-card.tsx](../apps/client/src/components/channel-view/voice/screen-share-card.tsx) | 2 | 2 | 8, 9 |
| [apps/client/src/components/channel-view/voice/voice-grid.tsx](../apps/client/src/components/channel-view/voice/voice-grid.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/channel-view/voice/voice-user-card.tsx](../apps/client/src/components/channel-view/voice/voice-user-card.tsx) | 1 | 1 | 14 |
| [apps/client/src/components/channel-view/voice/volume-button.tsx](../apps/client/src/components/channel-view/voice/volume-button.tsx) | 1 | 1 | 12 |
| [apps/client/src/components/context-menus/category/index.tsx](../apps/client/src/components/context-menus/category/index.tsx) | 2 | 2 | 7, 15 |
| [apps/client/src/components/context-menus/channel/index.tsx](../apps/client/src/components/context-menus/channel/index.tsx) | 2 | 2 | 12, 20 |
| [apps/client/src/components/debug-info/index.tsx](../apps/client/src/components/debug-info/index.tsx) | 2 | 3 | 7, 21 |
| [apps/client/src/components/devices-provider/index.tsx](../apps/client/src/components/devices-provider/index.tsx) | 1 | 1 | 16 |
| [apps/client/src/components/dialogs/assign-role/index.tsx](../apps/client/src/components/dialogs/assign-role/index.tsx) | 2 | 2 | 5, 23 |
| [apps/client/src/components/dialogs/confirm-action/index.tsx](../apps/client/src/components/dialogs/confirm-action/index.tsx) | 1 | 1 | 11 |
| [apps/client/src/components/dialogs/create-category/index.tsx](../apps/client/src/components/dialogs/create-category/index.tsx) | 1 | 1 | 13 |
| [apps/client/src/components/dialogs/create-channel/index.tsx](../apps/client/src/components/dialogs/create-channel/index.tsx) | 2 | 2 | 7, 18 |
| [apps/client/src/components/dialogs/create-invite-dialog/index.tsx](../apps/client/src/components/dialogs/create-invite-dialog/index.tsx) | 2 | 2 | 4, 21 |
| [apps/client/src/components/dialogs/delete-user/index.tsx](../apps/client/src/components/dialogs/delete-user/index.tsx) | 2 | 2 | 3, 17 |
| [apps/client/src/components/dialogs/plugin-install-confirm/index.tsx](../apps/client/src/components/dialogs/plugin-install-confirm/index.tsx) | 3 | 3 | 10, 92, 97 |
| [apps/client/src/components/dialogs/reset-user-password/index.tsx](../apps/client/src/components/dialogs/reset-user-password/index.tsx) | 2 | 2 | 2, 14 |
| [apps/client/src/components/dialogs/search/hooks.ts](../apps/client/src/components/dialogs/search/hooks.ts) | 1 | 1 | 2 |
| [apps/client/src/components/dialogs/search/index.tsx](../apps/client/src/components/dialogs/search/index.tsx) | 2 | 2 | 5, 15 |
| [apps/client/src/components/dialogs/search/search-result-file.tsx](../apps/client/src/components/dialogs/search/search-result-file.tsx) | 1 | 1 | 4 |
| [apps/client/src/components/dialogs/search/search-result-message.tsx](../apps/client/src/components/dialogs/search/search-result-message.tsx) | 2 | 2 | 8, 9 |
| [apps/client/src/components/dialogs/search/types.ts](../apps/client/src/components/dialogs/search/types.ts) | 1 | 1 | 1 |
| [apps/client/src/components/dialogs/server-password/index.tsx](../apps/client/src/components/dialogs/server-password/index.tsx) | 1 | 1 | 16 |
| [apps/client/src/components/dialogs/sounds/index.tsx](../apps/client/src/components/dialogs/sounds/index.tsx) | 1 | 1 | 11 |
| [apps/client/src/components/dialogs/text-input/index.tsx](../apps/client/src/components/dialogs/text-input/index.tsx) | 1 | 1 | 12 |
| [apps/client/src/components/dialogs/voice-debug/index.tsx](../apps/client/src/components/dialogs/voice-debug/index.tsx) | 1 | 1 | 18 |
| [apps/client/src/components/dialogs/voice-debug/parts.tsx](../apps/client/src/components/dialogs/voice-debug/parts.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/dialogs/voice-debug/tabs.tsx](../apps/client/src/components/dialogs/voice-debug/tabs.tsx) | 1 | 1 | 5 |
| [apps/client/src/components/dialogs/welcome-profile-setup/index.tsx](../apps/client/src/components/dialogs/welcome-profile-setup/index.tsx) | 4 | 4 | 11, 25, 120, 171 |
| [apps/client/src/components/emoji-picker/index.tsx](../apps/client/src/components/emoji-picker/index.tsx) | 1 | 1 | 12 |
| [apps/client/src/components/error-boundary/global-error-boundary.tsx](../apps/client/src/components/error-boundary/global-error-boundary.tsx) | 2 | 3 | 9, 23 |
| [apps/client/src/components/fullscreen-image/content.tsx](../apps/client/src/components/fullscreen-image/content.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/image-picker/index.tsx](../apps/client/src/components/image-picker/index.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/language-switcher/index.tsx](../apps/client/src/components/language-switcher/index.tsx) | 1 | 1 | 9 |
| [apps/client/src/components/left-sidebar/categories.tsx](../apps/client/src/components/left-sidebar/categories.tsx) | 2 | 2 | 13, 14 |
| [apps/client/src/components/left-sidebar/channels.tsx](../apps/client/src/components/left-sidebar/channels.tsx) | 1 | 1 | 34 |
| [apps/client/src/components/left-sidebar/direct-messages/dm-button.tsx](../apps/client/src/components/left-sidebar/direct-messages/dm-button.tsx) | 2 | 2 | 4, 5 |
| [apps/client/src/components/left-sidebar/direct-messages/index.tsx](../apps/client/src/components/left-sidebar/direct-messages/index.tsx) | 2 | 2 | 18, 19 |
| [apps/client/src/components/left-sidebar/direct-messages/search-user-dropdown.tsx](../apps/client/src/components/left-sidebar/direct-messages/search-user-dropdown.tsx) | 1 | 1 | 10 |
| [apps/client/src/components/left-sidebar/external-stream.tsx](../apps/client/src/components/left-sidebar/external-stream.tsx) | 2 | 2 | 2, 3 |
| [apps/client/src/components/left-sidebar/helpers.ts](../apps/client/src/components/left-sidebar/helpers.ts) | 1 | 1 | 3 |
| [apps/client/src/components/left-sidebar/index.tsx](../apps/client/src/components/left-sidebar/index.tsx) | 1 | 1 | 13 |
| [apps/client/src/components/left-sidebar/plugin-buttons.tsx](../apps/client/src/components/left-sidebar/plugin-buttons.tsx) | 1 | 1 | 7 |
| [apps/client/src/components/left-sidebar/server-dropdown.tsx](../apps/client/src/components/left-sidebar/server-dropdown.tsx) | 2 | 2 | 14, 23 |
| [apps/client/src/components/left-sidebar/sidebar-dnd.tsx](../apps/client/src/components/left-sidebar/sidebar-dnd.tsx) | 1 | 1 | 9 |
| [apps/client/src/components/left-sidebar/stats-popover.tsx](../apps/client/src/components/left-sidebar/stats-popover.tsx) | 1 | 1 | 12 |
| [apps/client/src/components/left-sidebar/stream-context-menu.tsx](../apps/client/src/components/left-sidebar/stream-context-menu.tsx) | 1 | 1 | 9 |
| [apps/client/src/components/left-sidebar/use-sidebar-dnd.ts](../apps/client/src/components/left-sidebar/use-sidebar-dnd.ts) | 1 | 1 | 17 |
| [apps/client/src/components/left-sidebar/user-control.tsx](../apps/client/src/components/left-sidebar/user-control.tsx) | 2 | 2 | 7, 8 |
| [apps/client/src/components/left-sidebar/voice-control.tsx](../apps/client/src/components/left-sidebar/voice-control.tsx) | 2 | 2 | 6, 7 |
| [apps/client/src/components/left-sidebar/voice-user.tsx](../apps/client/src/components/left-sidebar/voice-user.tsx) | 2 | 2 | 7, 8 |
| [apps/client/src/components/message-compose/index.tsx](../apps/client/src/components/message-compose/index.tsx) | 3 | 3 | 19, 26, 27 |
| [apps/client/src/components/mod-view-sheet/context.tsx](../apps/client/src/components/mod-view-sheet/context.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/mod-view-sheet/details/index.tsx](../apps/client/src/components/mod-view-sheet/details/index.tsx) | 2 | 2 | 3, 11 |
| [apps/client/src/components/mod-view-sheet/header.tsx](../apps/client/src/components/mod-view-sheet/header.tsx) | 2 | 2 | 16, 17 |
| [apps/client/src/components/mod-view-sheet/index.tsx](../apps/client/src/components/mod-view-sheet/index.tsx) | 2 | 2 | 4, 5 |
| [apps/client/src/components/mod-view-sheet/mod-view-content.tsx](../apps/client/src/components/mod-view-sheet/mod-view-content.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/mod-view-sheet/server-activity/files.tsx](../apps/client/src/components/mod-view-sheet/server-activity/files.tsx) | 3 | 3 | 6, 7, 8 |
| [apps/client/src/components/mod-view-sheet/server-activity/index.tsx](../apps/client/src/components/mod-view-sheet/server-activity/index.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/mod-view-sheet/server-activity/links.tsx](../apps/client/src/components/mod-view-sheet/server-activity/links.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/mod-view-sheet/server-activity/messages.tsx](../apps/client/src/components/mod-view-sheet/server-activity/messages.tsx) | 2 | 2 | 3, 4 |
| [apps/client/src/components/mod-view-sheet/storage/index.tsx](../apps/client/src/components/mod-view-sheet/storage/index.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/paginated-table/index.tsx](../apps/client/src/components/paginated-table/index.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/permissions-list/index.tsx](../apps/client/src/components/permissions-list/index.tsx) | 2 | 2 | 2, 3 |
| [apps/client/src/components/plugin-avatar/index.tsx](../apps/client/src/components/plugin-avatar/index.tsx) | 1 | 1 | 4 |
| [apps/client/src/components/plugin-slot-renderer/error-boundary.tsx](../apps/client/src/components/plugin-slot-renderer/error-boundary.tsx) | 1 | 1 | 7 |
| [apps/client/src/components/plugin-slot-renderer/index.tsx](../apps/client/src/components/plugin-slot-renderer/index.tsx) | 1 | 1 | 10 |
| [apps/client/src/components/protect/index.tsx](../apps/client/src/components/protect/index.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/reconnecting-overlay/index.tsx](../apps/client/src/components/reconnecting-overlay/index.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/right-sidebar/index.tsx](../apps/client/src/components/right-sidebar/index.tsx) | 1 | 1 | 11 |
| [apps/client/src/components/role-badge/index.tsx](../apps/client/src/components/role-badge/index.tsx) | 2 | 2 | 1, 2 |
| [apps/client/src/components/routing/__tests__/helpers.test.ts](../apps/client/src/components/routing/__tests__/helpers.test.ts) | 2 | 2 | 102, 107 |
| [apps/client/src/components/routing/desktop-deep-link-controller.tsx](../apps/client/src/components/routing/desktop-deep-link-controller.tsx) | 3 | 3 | 50, 133, 146 |
| [apps/client/src/components/routing/helpers.ts](../apps/client/src/components/routing/helpers.ts) | 1 | 1 | 47 |
| [apps/client/src/components/routing/index.tsx](../apps/client/src/components/routing/index.tsx) | 1 | 1 | 23 |
| [apps/client/src/components/server-screens/calendar/index.tsx](../apps/client/src/components/server-screens/calendar/index.tsx) | 1 | 1 | 15 |
| [apps/client/src/components/server-screens/category-settings/general.tsx](../apps/client/src/components/server-screens/category-settings/general.tsx) | 1 | 1 | 5 |
| [apps/client/src/components/server-screens/channel-settings/general.tsx](../apps/client/src/components/server-screens/channel-settings/general.tsx) | 1 | 1 | 5 |
| [apps/client/src/components/server-screens/channel-settings/permissions/channel-permission-list.tsx](../apps/client/src/components/server-screens/channel-settings/permissions/channel-permission-list.tsx) | 2 | 2 | 1, 2 |
| [apps/client/src/components/server-screens/channel-settings/permissions/index.tsx](../apps/client/src/components/server-screens/channel-settings/permissions/index.tsx) | 2 | 2 | 6, 7 |
| [apps/client/src/components/server-screens/channel-settings/permissions/override.tsx](../apps/client/src/components/server-screens/channel-settings/permissions/override.tsx) | 2 | 2 | 7, 8 |
| [apps/client/src/components/server-screens/channel-settings/permissions/overrides-list.tsx](../apps/client/src/components/server-screens/channel-settings/permissions/overrides-list.tsx) | 3 | 3 | 10, 11, 12 |
| [apps/client/src/components/server-screens/channel-settings/permissions/search-popover.tsx](../apps/client/src/components/server-screens/channel-settings/permissions/search-popover.tsx) | 1 | 1 | 13 |
| [apps/client/src/components/server-screens/channel-settings/permissions/types.ts](../apps/client/src/components/server-screens/channel-settings/permissions/types.ts) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/server-screen-layout.tsx](../apps/client/src/components/server-screens/server-screen-layout.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/server-settings/emojis/emoji-list.tsx](../apps/client/src/components/server-screens/server-settings/emojis/emoji-list.tsx) | 2 | 2 | 3, 4 |
| [apps/client/src/components/server-screens/server-settings/emojis/index.tsx](../apps/client/src/components/server-screens/server-settings/emojis/index.tsx) | 1 | 1 | 6 |
| [apps/client/src/components/server-screens/server-settings/emojis/update-emoji.tsx](../apps/client/src/components/server-screens/server-settings/emojis/update-emoji.tsx) | 2 | 2 | 6, 7 |
| [apps/client/src/components/server-screens/server-settings/general/index.tsx](../apps/client/src/components/server-screens/server-settings/general/index.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/server-screens/server-settings/index.tsx](../apps/client/src/components/server-screens/server-settings/index.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/server-screens/server-settings/invites/index.tsx](../apps/client/src/components/server-screens/server-settings/invites/index.tsx) | 1 | 1 | 5 |
| [apps/client/src/components/server-screens/server-settings/invites/invites-table.tsx](../apps/client/src/components/server-screens/server-settings/invites/invites-table.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/server-screens/server-settings/invites/table-invite.tsx](../apps/client/src/components/server-screens/server-settings/invites/table-invite.tsx) | 3 | 3 | 8, 9, 17 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/args.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/args.tsx) | 2 | 2 | 1, 10 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/commands.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/commands.tsx) | 2 | 2 | 11, 12 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/index.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/index.tsx) | 2 | 2 | 14, 24 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/logs.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/logs.tsx) | 2 | 2 | 3, 10 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/permissions/capability-switches.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/permissions/capability-switches.tsx) | 2 | 2 | 6, 7 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/permissions/index.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/permissions/index.tsx) | 2 | 2 | 13, 14 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/permissions/role-list.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/permissions/role-list.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/permissions/types.ts](../apps/client/src/components/server-screens/server-settings/plugin-view/permissions/types.ts) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/settings.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/settings.tsx) | 2 | 2 | 4, 15 |
| [apps/client/src/components/server-screens/server-settings/plugin-view/tab-content.tsx](../apps/client/src/components/server-screens/server-settings/plugin-view/tab-content.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/server-screens/server-settings/plugins/index.tsx](../apps/client/src/components/server-screens/server-settings/plugins/index.tsx) | 2 | 2 | 2, 3 |
| [apps/client/src/components/server-screens/server-settings/plugins/installed.tsx](../apps/client/src/components/server-screens/server-settings/plugins/installed.tsx) | 3 | 3 | 6, 7, 17 |
| [apps/client/src/components/server-screens/server-settings/plugins/marketplace/hooks.ts](../apps/client/src/components/server-screens/server-settings/plugins/marketplace/hooks.ts) | 1 | 1 | 5 |
| [apps/client/src/components/server-screens/server-settings/plugins/marketplace/image-with-fallback.tsx](../apps/client/src/components/server-screens/server-settings/plugins/marketplace/image-with-fallback.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/server-settings/plugins/marketplace/index.tsx](../apps/client/src/components/server-screens/server-settings/plugins/marketplace/index.tsx) | 2 | 2 | 4, 5 |
| [apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-item.tsx](../apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-item.tsx) | 2 | 2 | 10, 11 |
| [apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-screenshots.tsx](../apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-screenshots.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-skeleton.tsx](../apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-skeleton.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/server-settings/roles/index.tsx](../apps/client/src/components/server-screens/server-settings/roles/index.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/server-screens/server-settings/roles/permissions-list.tsx](../apps/client/src/components/server-screens/server-settings/roles/permissions-list.tsx) | 2 | 2 | 1, 2 |
| [apps/client/src/components/server-screens/server-settings/roles/roles-list.tsx](../apps/client/src/components/server-screens/server-settings/roles/roles-list.tsx) | 2 | 2 | 4, 5 |
| [apps/client/src/components/server-screens/server-settings/roles/update-role.tsx](../apps/client/src/components/server-screens/server-settings/roles/update-role.tsx) | 2 | 2 | 12, 22 |
| [apps/client/src/components/server-screens/server-settings/storage/index.tsx](../apps/client/src/components/server-screens/server-settings/storage/index.tsx) | 2 | 2 | 29, 43 |
| [apps/client/src/components/server-screens/server-settings/storage/metrics.tsx](../apps/client/src/components/server-screens/server-settings/storage/metrics.tsx) | 3 | 3 | 1, 41, 44 |
| [apps/client/src/components/server-screens/server-settings/storage/plugin-usage.tsx](../apps/client/src/components/server-screens/server-settings/storage/plugin-usage.tsx) | 2 | 2 | 1, 2 |
| [apps/client/src/components/server-screens/server-settings/storage/storage-size-control.tsx](../apps/client/src/components/server-screens/server-settings/storage/storage-size-control.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/server-settings/updates/index.tsx](../apps/client/src/components/server-screens/server-settings/updates/index.tsx) | 1 | 1 | 10 |
| [apps/client/src/components/server-screens/server-settings/users/index.tsx](../apps/client/src/components/server-screens/server-settings/users/index.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/server-screens/server-settings/users/table-user.tsx](../apps/client/src/components/server-screens/server-settings/users/table-user.tsx) | 2 | 2 | 10, 18 |
| [apps/client/src/components/server-screens/settings-shell/index.tsx](../apps/client/src/components/server-screens/settings-shell/index.tsx) | 1 | 1 | 6 |
| [apps/client/src/components/server-screens/settings-shell/list-editor.tsx](../apps/client/src/components/server-screens/settings-shell/list-editor.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/settings-shell/save-bar.tsx](../apps/client/src/components/server-screens/settings-shell/save-bar.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/server-screens/settings-shell/section.tsx](../apps/client/src/components/server-screens/settings-shell/section.tsx) | 1 | 1 | 7 |
| [apps/client/src/components/server-screens/settings-shell/sidebar.tsx](../apps/client/src/components/server-screens/settings-shell/sidebar.tsx) | 2 | 2 | 2, 3 |
| [apps/client/src/components/server-screens/settings-shell/use-settings-form.ts](../apps/client/src/components/server-screens/settings-shell/use-settings-form.ts) | 1 | 1 | 2 |
| [apps/client/src/components/server-screens/user-settings/desktop/index.tsx](../apps/client/src/components/server-screens/user-settings/desktop/index.tsx) | 3 | 3 | 16, 198, 322 |
| [apps/client/src/components/server-screens/user-settings/devices/index.tsx](../apps/client/src/components/server-screens/user-settings/devices/index.tsx) | 2 | 2 | 24, 41 |
| [apps/client/src/components/server-screens/user-settings/devices/microphone-test-level-bar.tsx](../apps/client/src/components/server-screens/user-settings/devices/microphone-test-level-bar.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/server-screens/user-settings/devices/push-to-talk-settings.tsx](../apps/client/src/components/server-screens/user-settings/devices/push-to-talk-settings.tsx) | 1 | 1 | 21 |
| [apps/client/src/components/server-screens/user-settings/devices/resolution-fps-control.tsx](../apps/client/src/components/server-screens/user-settings/devices/resolution-fps-control.tsx) | 1 | 1 | 9 |
| [apps/client/src/components/server-screens/user-settings/index.tsx](../apps/client/src/components/server-screens/user-settings/index.tsx) | 1 | 1 | 4 |
| [apps/client/src/components/server-screens/user-settings/notifications/index.tsx](../apps/client/src/components/server-screens/user-settings/notifications/index.tsx) | 1 | 1 | 15 |
| [apps/client/src/components/server-screens/user-settings/others/index.tsx](../apps/client/src/components/server-screens/user-settings/others/index.tsx) | 1 | 1 | 6 |
| [apps/client/src/components/server-screens/user-settings/others/window-behavior-settings.tsx](../apps/client/src/components/server-screens/user-settings/others/window-behavior-settings.tsx) | 1 | 1 | 10 |
| [apps/client/src/components/server-screens/user-settings/password/index.tsx](../apps/client/src/components/server-screens/user-settings/password/index.tsx) | 1 | 1 | 11 |
| [apps/client/src/components/server-screens/user-settings/profile/index.tsx](../apps/client/src/components/server-screens/user-settings/profile/index.tsx) | 2 | 2 | 10, 17 |
| [apps/client/src/components/thread-sidebar/parent-message-preview.tsx](../apps/client/src/components/thread-sidebar/parent-message-preview.tsx) | 2 | 2 | 5, 6 |
| [apps/client/src/components/thread-sidebar/thread-compose.tsx](../apps/client/src/components/thread-sidebar/thread-compose.tsx) | 2 | 2 | 11, 16 |
| [apps/client/src/components/thread-sidebar/thread-content.tsx](../apps/client/src/components/thread-sidebar/thread-content.tsx) | 2 | 2 | 5, 6 |
| [apps/client/src/components/thread-sidebar/thread-header.tsx](../apps/client/src/components/thread-sidebar/thread-header.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/tiptap-input/extensions/channel-reference/index.ts](../apps/client/src/components/tiptap-input/extensions/channel-reference/index.ts) | 1 | 1 | 1 |
| [apps/client/src/components/tiptap-input/extensions/channel-reference/suggestion.tsx](../apps/client/src/components/tiptap-input/extensions/channel-reference/suggestion.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/tiptap-input/extensions/commands/command-list.tsx](../apps/client/src/components/tiptap-input/extensions/commands/command-list.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/tiptap-input/extensions/commands/command-suggestion.ts](../apps/client/src/components/tiptap-input/extensions/commands/command-suggestion.ts) | 1 | 1 | 1 |
| [apps/client/src/components/tiptap-input/extensions/commands/plugin-command-node.tsx](../apps/client/src/components/tiptap-input/extensions/commands/plugin-command-node.tsx) | 1 | 1 | 1 |
| [apps/client/src/components/tiptap-input/extensions/commands/slash-commands-extension.ts](../apps/client/src/components/tiptap-input/extensions/commands/slash-commands-extension.ts) | 1 | 1 | 1 |
| [apps/client/src/components/tiptap-input/extensions/mentions/index.ts](../apps/client/src/components/tiptap-input/extensions/mentions/index.ts) | 1 | 1 | 2 |
| [apps/client/src/components/tiptap-input/extensions/mentions/suggestion.tsx](../apps/client/src/components/tiptap-input/extensions/mentions/suggestion.tsx) | 1 | 1 | 3 |
| [apps/client/src/components/tiptap-input/index.tsx](../apps/client/src/components/tiptap-input/index.tsx) | 1 | 1 | 4 |
| [apps/client/src/components/top-bar/index.tsx](../apps/client/src/components/top-bar/index.tsx) | 2 | 2 | 6, 7 |
| [apps/client/src/components/top-bar/voice-buttons.tsx](../apps/client/src/components/top-bar/voice-buttons.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/top-bar/voice-options-controller.tsx](../apps/client/src/components/top-bar/voice-options-controller.tsx) | 1 | 1 | 20 |
| [apps/client/src/components/top-bar/volume-controller.tsx](../apps/client/src/components/top-bar/volume-controller.tsx) | 1 | 1 | 16 |
| [apps/client/src/components/unread-count/index.tsx](../apps/client/src/components/unread-count/index.tsx) | 2 | 2 | 1, 2 |
| [apps/client/src/components/user-avatar/index.tsx](../apps/client/src/components/user-avatar/index.tsx) | 2 | 2 | 7, 8 |
| [apps/client/src/components/user-popover/index.tsx](../apps/client/src/components/user-popover/index.tsx) | 2 | 2 | 17, 23 |
| [apps/client/src/components/user-status/index.tsx](../apps/client/src/components/user-status/index.tsx) | 1 | 1 | 2 |
| [apps/client/src/components/voice-provider/__tests__/helpers.test.ts](../apps/client/src/components/voice-provider/__tests__/helpers.test.ts) | 1 | 1 | 1 |
| [apps/client/src/components/voice-provider/desktop-capture-picker.tsx](../apps/client/src/components/voice-provider/desktop-capture-picker.tsx) | 1 | 1 | 8 |
| [apps/client/src/components/voice-provider/floating-pinned-card.tsx](../apps/client/src/components/voice-provider/floating-pinned-card.tsx) | 1 | 1 | 9 |
| [apps/client/src/components/voice-provider/helpers.ts](../apps/client/src/components/voice-provider/helpers.ts) | 1 | 1 | 11 |
| [apps/client/src/components/voice-provider/hooks/use-remote-streams.ts](../apps/client/src/components/voice-provider/hooks/use-remote-streams.ts) | 1 | 1 | 2 |
| [apps/client/src/components/voice-provider/hooks/use-transport-stats.ts](../apps/client/src/components/voice-provider/hooks/use-transport-stats.ts) | 3 | 3 | 513, 514, 519 |
| [apps/client/src/components/voice-provider/hooks/use-transports.ts](../apps/client/src/components/voice-provider/hooks/use-transports.ts) | 1 | 1 | 14 |
| [apps/client/src/components/voice-provider/hooks/use-voice-controls.ts](../apps/client/src/components/voice-provider/hooks/use-voice-controls.ts) | 1 | 1 | 8 |
| [apps/client/src/components/voice-provider/hooks/use-voice-events.ts](../apps/client/src/components/voice-provider/hooks/use-voice-events.ts) | 1 | 1 | 10 |
| [apps/client/src/components/voice-provider/index.tsx](../apps/client/src/components/voice-provider/index.tsx) | 1 | 1 | 46 |
| [apps/client/src/features/app/actions.ts](../apps/client/src/features/app/actions.ts) | 2 | 2 | 18, 125 |
| [apps/client/src/features/dialogs/actions.ts](../apps/client/src/features/dialogs/actions.ts) | 1 | 1 | 2 |
| [apps/client/src/features/dialogs/slice.ts](../apps/client/src/features/dialogs/slice.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server-screens/actions.ts](../apps/client/src/features/server-screens/actions.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server-screens/slice.ts](../apps/client/src/features/server-screens/slice.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/__tests__/helpers.test.ts](../apps/client/src/features/server/__tests__/helpers.test.ts) | 1 | 1 | 5 |
| [apps/client/src/features/server/__tests__/plugin-capability-access.test.ts](../apps/client/src/features/server/__tests__/plugin-capability-access.test.ts) | 1 | 1 | 6 |
| [apps/client/src/features/server/__tests__/user-settings-plugins.test.ts](../apps/client/src/features/server/__tests__/user-settings-plugins.test.ts) | 1 | 1 | 9 |
| [apps/client/src/features/server/actions.ts](../apps/client/src/features/server/actions.ts) | 4 | 4 | 14, 80, 322, 323 |
| [apps/client/src/features/server/admin/hooks.ts](../apps/client/src/features/server/admin/hooks.ts) | 1 | 1 | 23 |
| [apps/client/src/features/server/categories/actions.ts](../apps/client/src/features/server/categories/actions.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server/categories/subscriptions.ts](../apps/client/src/features/server/categories/subscriptions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/channels/__tests__/selectors.test.ts](../apps/client/src/features/server/channels/__tests__/selectors.test.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server/channels/actions.ts](../apps/client/src/features/server/channels/actions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/channels/selectors.ts](../apps/client/src/features/server/channels/selectors.ts) | 1 | 1 | 7 |
| [apps/client/src/features/server/emojis/actions.ts](../apps/client/src/features/server/emojis/actions.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server/emojis/subscriptions.ts](../apps/client/src/features/server/emojis/subscriptions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/helpers.ts](../apps/client/src/features/server/helpers.ts) | 1 | 1 | 5 |
| [apps/client/src/features/server/hooks.ts](../apps/client/src/features/server/hooks.ts) | 1 | 1 | 1 |
| [apps/client/src/features/server/messages/actions.ts](../apps/client/src/features/server/messages/actions.ts) | 1 | 1 | 19 |
| [apps/client/src/features/server/messages/hooks.ts](../apps/client/src/features/server/messages/hooks.ts) | 1 | 1 | 7 |
| [apps/client/src/features/server/messages/subscriptions.ts](../apps/client/src/features/server/messages/subscriptions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/plugins/actions.ts](../apps/client/src/features/server/plugins/actions.ts) | 1 | 1 | 14 |
| [apps/client/src/features/server/plugins/hooks.ts](../apps/client/src/features/server/plugins/hooks.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server/plugins/plugin-store.ts](../apps/client/src/features/server/plugins/plugin-store.ts) | 3 | 3 | 5, 6, 78 |
| [apps/client/src/features/server/plugins/selectors.ts](../apps/client/src/features/server/plugins/selectors.ts) | 1 | 1 | 7 |
| [apps/client/src/features/server/plugins/use-plugin-can-use.ts](../apps/client/src/features/server/plugins/use-plugin-can-use.ts) | 1 | 1 | 1 |
| [apps/client/src/features/server/plugins/use-plugin-user-data.ts](../apps/client/src/features/server/plugins/use-plugin-user-data.ts) | 1 | 1 | 1 |
| [apps/client/src/features/server/roles/actions.ts](../apps/client/src/features/server/roles/actions.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server/roles/subscriptions.ts](../apps/client/src/features/server/roles/subscriptions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/selectors.ts](../apps/client/src/features/server/selectors.ts) | 1 | 1 | 8 |
| [apps/client/src/features/server/slice.ts](../apps/client/src/features/server/slice.ts) | 2 | 2 | 25, 26 |
| [apps/client/src/features/server/subscriptions.ts](../apps/client/src/features/server/subscriptions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/types.ts](../apps/client/src/features/server/types.ts) | 1 | 1 | 5 |
| [apps/client/src/features/server/users/actions.ts](../apps/client/src/features/server/users/actions.ts) | 1 | 1 | 2 |
| [apps/client/src/features/server/users/selectors.ts](../apps/client/src/features/server/users/selectors.ts) | 1 | 1 | 7 |
| [apps/client/src/features/server/users/subscriptions.ts](../apps/client/src/features/server/users/subscriptions.ts) | 1 | 1 | 3 |
| [apps/client/src/features/server/voice/actions.ts](../apps/client/src/features/server/voice/actions.ts) | 1 | 1 | 16 |
| [apps/client/src/features/server/voice/hooks.ts](../apps/client/src/features/server/voice/hooks.ts) | 1 | 1 | 4 |
| [apps/client/src/helpers/__tests__/get-plugin-bundle-url.test.ts](../apps/client/src/helpers/__tests__/get-plugin-bundle-url.test.ts) | 1 | 1 | 43 |
| [apps/client/src/helpers/audio-gate.ts](../apps/client/src/helpers/audio-gate.ts) | 2 | 2 | 6, 7 |
| [apps/client/src/helpers/browser-logger.ts](../apps/client/src/helpers/browser-logger.ts) | 1 | 1 | 1 |
| [apps/client/src/helpers/download-file.ts](../apps/client/src/helpers/download-file.ts) | 1 | 1 | 2 |
| [apps/client/src/helpers/exposes.ts](../apps/client/src/helpers/exposes.ts) | 6 | 6 | 10, 17, 18, 19, 20, 21 |
| [apps/client/src/helpers/get-file-url.ts](../apps/client/src/helpers/get-file-url.ts) | 3 | 3 | 1, 8, 18 |
| [apps/client/src/helpers/get-plugin-bundle-url.ts](../apps/client/src/helpers/get-plugin-bundle-url.ts) | 1 | 1 | 1 |
| [apps/client/src/helpers/get-rendered-username.ts](../apps/client/src/helpers/get-rendered-username.ts) | 1 | 1 | 1 |
| [apps/client/src/helpers/server-connection.ts](../apps/client/src/helpers/server-connection.ts) | 3 | 3 | 2, 30, 297 |
| [apps/client/src/helpers/server-session.ts](../apps/client/src/helpers/server-session.ts) | 1 | 1 | 71 |
| [apps/client/src/helpers/storage.ts](../apps/client/src/helpers/storage.ts) | 35 | 35 | 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 45, 47 |
| [apps/client/src/helpers/upload-file.ts](../apps/client/src/helpers/upload-file.ts) | 1 | 1 | 1 |
| [apps/client/src/hooks/use-form.ts](../apps/client/src/hooks/use-form.ts) | 1 | 1 | 1 |
| [apps/client/src/hooks/use-pick-image.ts](../apps/client/src/hooks/use-pick-image.ts) | 1 | 1 | 3 |
| [apps/client/src/hooks/use-select-channel.ts](../apps/client/src/hooks/use-select-channel.ts) | 1 | 1 | 8 |
| [apps/client/src/hooks/use-stream-quality-data.ts](../apps/client/src/hooks/use-stream-quality-data.ts) | 1 | 1 | 4 |
| [apps/client/src/hooks/use-typing-signal.ts](../apps/client/src/hooks/use-typing-signal.ts) | 1 | 1 | 2 |
| [apps/client/src/hooks/use-upload-files.ts](../apps/client/src/hooks/use-upload-files.ts) | 1 | 1 | 4 |
| [apps/client/src/i18n/index.ts](../apps/client/src/i18n/index.ts) | 1 | 1 | 6 |
| [apps/client/src/i18n/locales/cs/common.json](../apps/client/src/i18n/locales/cs/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/cs/connect.json](../apps/client/src/i18n/locales/cs/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/cs/dialogs.json](../apps/client/src/i18n/locales/cs/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/cs/settings.json](../apps/client/src/i18n/locales/cs/settings.json) | 11 | 12 | 36, 39, 43, 115, 116, 208, 241, 268, 277, 327, 472 |
| [apps/client/src/i18n/locales/en/common.json](../apps/client/src/i18n/locales/en/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/en/connect.json](../apps/client/src/i18n/locales/en/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/en/dialogs.json](../apps/client/src/i18n/locales/en/dialogs.json) | 2 | 2 | 94, 101 |
| [apps/client/src/i18n/locales/en/settings.json](../apps/client/src/i18n/locales/en/settings.json) | 10 | 11 | 36, 39, 115, 116, 210, 243, 270, 279, 329, 474 |
| [apps/client/src/i18n/locales/es/common.json](../apps/client/src/i18n/locales/es/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/es/connect.json](../apps/client/src/i18n/locales/es/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/es/dialogs.json](../apps/client/src/i18n/locales/es/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/es/settings.json](../apps/client/src/i18n/locales/es/settings.json) | 10 | 11 | 36, 39, 115, 116, 208, 241, 268, 277, 327, 472 |
| [apps/client/src/i18n/locales/fr/common.json](../apps/client/src/i18n/locales/fr/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/fr/connect.json](../apps/client/src/i18n/locales/fr/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/fr/dialogs.json](../apps/client/src/i18n/locales/fr/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/fr/settings.json](../apps/client/src/i18n/locales/fr/settings.json) | 11 | 12 | 36, 39, 115, 116, 202, 208, 241, 268, 277, 327, 472 |
| [apps/client/src/i18n/locales/it/common.json](../apps/client/src/i18n/locales/it/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/it/connect.json](../apps/client/src/i18n/locales/it/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/it/dialogs.json](../apps/client/src/i18n/locales/it/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/it/settings.json](../apps/client/src/i18n/locales/it/settings.json) | 10 | 11 | 36, 39, 115, 116, 208, 241, 268, 277, 327, 472 |
| [apps/client/src/i18n/locales/pt-BR/common.json](../apps/client/src/i18n/locales/pt-BR/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/pt-BR/connect.json](../apps/client/src/i18n/locales/pt-BR/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/pt-BR/dialogs.json](../apps/client/src/i18n/locales/pt-BR/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/pt-BR/settings.json](../apps/client/src/i18n/locales/pt-BR/settings.json) | 10 | 11 | 36, 39, 115, 116, 210, 243, 270, 279, 329, 474 |
| [apps/client/src/i18n/locales/ru/common.json](../apps/client/src/i18n/locales/ru/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/ru/connect.json](../apps/client/src/i18n/locales/ru/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/ru/dialogs.json](../apps/client/src/i18n/locales/ru/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/ru/settings.json](../apps/client/src/i18n/locales/ru/settings.json) | 11 | 12 | 37, 40, 92, 93, 179, 185, 219, 228, 286, 396, 481 |
| [apps/client/src/i18n/locales/zh/common.json](../apps/client/src/i18n/locales/zh/common.json) | 3 | 3 | 16, 75, 76 |
| [apps/client/src/i18n/locales/zh/connect.json](../apps/client/src/i18n/locales/zh/connect.json) | 1 | 1 | 24 |
| [apps/client/src/i18n/locales/zh/dialogs.json](../apps/client/src/i18n/locales/zh/dialogs.json) | 2 | 2 | 85, 92 |
| [apps/client/src/i18n/locales/zh/settings.json](../apps/client/src/i18n/locales/zh/settings.json) | 11 | 12 | 36, 39, 115, 116, 202, 208, 242, 251, 301, 416, 472 |
| [apps/client/src/lib/trpc.ts](../apps/client/src/lib/trpc.ts) | 1 | 1 | 24 |
| [apps/client/src/main.tsx](../apps/client/src/main.tsx) | 1 | 1 | 2 |
| [apps/client/src/screens/connect/hooks/use-oidc-login.ts](../apps/client/src/screens/connect/hooks/use-oidc-login.ts) | 1 | 1 | 5 |
| [apps/client/src/screens/connect/index.tsx](../apps/client/src/screens/connect/index.tsx) | 6 | 7 | 19, 34, 178, 289, 298, 302 |
| [apps/client/src/screens/disconnected/index.tsx](../apps/client/src/screens/disconnected/index.tsx) | 2 | 2 | 3, 4 |
| [apps/client/src/screens/loading-app/index.tsx](../apps/client/src/screens/loading-app/index.tsx) | 1 | 1 | 3 |
| [apps/client/src/screens/server-connection/index.tsx](../apps/client/src/screens/server-connection/index.tsx) | 5 | 6 | 27, 112, 166, 245, 250 |
| [apps/client/src/screens/server-view/content-wrapper.tsx](../apps/client/src/screens/server-view/content-wrapper.tsx) | 2 | 2 | 12, 13 |
| [apps/client/src/screens/server-view/index.tsx](../apps/client/src/screens/server-view/index.tsx) | 1 | 1 | 20 |
| [apps/client/src/types.ts](../apps/client/src/types.ts) | 1 | 1 | 1 |
| [apps/client/src/vite-env.d.ts](../apps/client/src/vite-env.d.ts) | 8 | 9 | 8, 196, 199, 205, 206, 207, 208, 209 |
| [apps/desktop/RELEASE_NOTES.md](../apps/desktop/RELEASE_NOTES.md) | 1 | 1 | 3 |
| [apps/desktop/electron-builder.yml](../apps/desktop/electron-builder.yml) | 1 | 1 | 32 |
| [apps/desktop/src/main.ts](../apps/desktop/src/main.ts) | 2 | 2 | 90, 1254 |
| [apps/server/build/build.ts](../apps/server/build/build.ts) | 5 | 5 | 84, 85, 86, 87, 105 |
| [apps/server/build/helpers.ts](../apps/server/build/helpers.ts) | 5 | 5 | 1, 159, 160, 161, 162 |
| [apps/server/package.json](../apps/server/package.json) | 3 | 3 | 2, 45, 46 |
| [apps/server/scripts/seed-mock.ts](../apps/server/scripts/seed-mock.ts) | 2 | 2 | 40, 241 |
| [apps/server/src/__tests__/config.test.ts](../apps/server/src/__tests__/config.test.ts) | 11 | 11 | 63, 69, 75, 81, 85, 91, 98, 104, 110, 119, 129 |
| [apps/server/src/__tests__/context.ts](../apps/server/src/__tests__/context.ts) | 1 | 1 | 1 |
| [apps/server/src/__tests__/e2e-mocks/message-render-mock.ts](../apps/server/src/__tests__/e2e-mocks/message-render-mock.ts) | 1 | 1 | 1 |
| [apps/server/src/__tests__/e2e-mocks/mock-messages-channel.ts](../apps/server/src/__tests__/e2e-mocks/mock-messages-channel.ts) | 1 | 1 | 1 |
| [apps/server/src/__tests__/e2e-mocks/seed-e2e.ts](../apps/server/src/__tests__/e2e-mocks/seed-e2e.ts) | 1 | 1 | 1 |
| [apps/server/src/__tests__/fake-oidc-provider.ts](../apps/server/src/__tests__/fake-oidc-provider.ts) | 2 | 2 | 25, 26 |
| [apps/server/src/__tests__/helpers.ts](../apps/server/src/__tests__/helpers.ts) | 1 | 1 | 1 |
| [apps/server/src/__tests__/seed.ts](../apps/server/src/__tests__/seed.ts) | 1 | 1 | 57 |
| [apps/server/src/config.ts](../apps/server/src/config.ts) | 17 | 17 | 1, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279 |
| [apps/server/src/db/__tests__/channel-permissions.test.ts](../apps/server/src/db/__tests__/channel-permissions.test.ts) | 1 | 1 | 1 |
| [apps/server/src/db/migrate.ts](../apps/server/src/db/migrate.ts) | 1 | 1 | 1 |
| [apps/server/src/db/mutations/files.ts](../apps/server/src/db/mutations/files.ts) | 1 | 1 | 1 |
| [apps/server/src/db/mutations/roles.ts](../apps/server/src/db/mutations/roles.ts) | 1 | 1 | 1 |
| [apps/server/src/db/mutations/server.ts](../apps/server/src/db/mutations/server.ts) | 1 | 1 | 1 |
| [apps/server/src/db/mutations/users.ts](../apps/server/src/db/mutations/users.ts) | 1 | 1 | 43 |
| [apps/server/src/db/publishers.ts](../apps/server/src/db/publishers.ts) | 1 | 1 | 6 |
| [apps/server/src/db/queries/channels.ts](../apps/server/src/db/queries/channels.ts) | 1 | 1 | 7 |
| [apps/server/src/db/queries/dms.ts](../apps/server/src/db/queries/dms.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/emojis.ts](../apps/server/src/db/queries/emojis.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/files.ts](../apps/server/src/db/queries/files.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/invites.ts](../apps/server/src/db/queries/invites.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/logins.ts](../apps/server/src/db/queries/logins.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/messages.ts](../apps/server/src/db/queries/messages.ts) | 1 | 1 | 8 |
| [apps/server/src/db/queries/plugin-capabilities.ts](../apps/server/src/db/queries/plugin-capabilities.ts) | 1 | 1 | 5 |
| [apps/server/src/db/queries/plugin-user-data.ts](../apps/server/src/db/queries/plugin-user-data.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/roles.ts](../apps/server/src/db/queries/roles.ts) | 1 | 1 | 6 |
| [apps/server/src/db/queries/server.ts](../apps/server/src/db/queries/server.ts) | 1 | 1 | 1 |
| [apps/server/src/db/queries/users.ts](../apps/server/src/db/queries/users.ts) | 1 | 1 | 5 |
| [apps/server/src/db/schema.ts](../apps/server/src/db/schema.ts) | 1 | 1 | 7 |
| [apps/server/src/db/seed.ts](../apps/server/src/db/seed.ts) | 7 | 7 | 22, 50, 52, 152, 154, 156, 164 |
| [apps/server/src/declarations.d.ts](../apps/server/src/declarations.d.ts) | 7 | 7 | 30, 31, 32, 33, 34, 35, 36 |
| [apps/server/src/helpers/__tests__/apply-env-overrides.test.ts](../apps/server/src/helpers/__tests__/apply-env-overrides.test.ts) | 7 | 7 | 144, 145, 146, 155, 156, 157, 158 |
| [apps/server/src/helpers/__tests__/downloads.test.ts](../apps/server/src/helpers/__tests__/downloads.test.ts) | 2 | 2 | 1, 73 |
| [apps/server/src/helpers/__tests__/marketplace.test.ts](../apps/server/src/helpers/__tests__/marketplace.test.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/assert-can-act-on-user.ts](../apps/server/src/helpers/assert-can-act-on-user.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/assert-channel-access.ts](../apps/server/src/helpers/assert-channel-access.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/categories.ts](../apps/server/src/helpers/categories.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/change-user-image.ts](../apps/server/src/helpers/change-user-image.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/channels.ts](../apps/server/src/helpers/channels.ts) | 1 | 1 | 7 |
| [apps/server/src/helpers/downloads.ts](../apps/server/src/helpers/downloads.ts) | 1 | 1 | 4 |
| [apps/server/src/helpers/embeds.ts](../apps/server/src/helpers/embeds.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/file-manager.ts](../apps/server/src/helpers/file-manager.ts) | 1 | 1 | 12 |
| [apps/server/src/helpers/files-crypto.ts](../apps/server/src/helpers/files-crypto.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/get-current-voice-runtime.ts](../apps/server/src/helpers/get-current-voice-runtime.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/get-invoker-ctx-from-trpc-ctx.ts](../apps/server/src/helpers/get-invoker-ctx-from-trpc-ctx.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/get-ws-info.ts](../apps/server/src/helpers/get-ws-info.ts) | 1 | 1 | 228 |
| [apps/server/src/helpers/install-plugin-version.ts](../apps/server/src/helpers/install-plugin-version.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/load-message-for-write.ts](../apps/server/src/helpers/load-message-for-write.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/logins.ts](../apps/server/src/helpers/logins.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/marketplace.ts](../apps/server/src/helpers/marketplace.ts) | 1 | 1 | 5 |
| [apps/server/src/helpers/message-pin.ts](../apps/server/src/helpers/message-pin.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/moderation.ts](../apps/server/src/helpers/moderation.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/oidc/avatar.ts](../apps/server/src/helpers/oidc/avatar.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/oidc/error.ts](../apps/server/src/helpers/oidc/error.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/oidc/user.ts](../apps/server/src/helpers/oidc/user.ts) | 1 | 1 | 7 |
| [apps/server/src/helpers/paths.ts](../apps/server/src/helpers/paths.ts) | 4 | 4 | 6, 15, 25, 36 |
| [apps/server/src/helpers/plugin-capability-access.ts](../apps/server/src/helpers/plugin-capability-access.ts) | 1 | 1 | 7 |
| [apps/server/src/helpers/plugin-command-args.ts](../apps/server/src/helpers/plugin-command-args.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/plugin-paths.ts](../apps/server/src/helpers/plugin-paths.ts) | 1 | 1 | 5 |
| [apps/server/src/helpers/run-before-message-save-hooks.ts](../apps/server/src/helpers/run-before-message-save-hooks.ts) | 1 | 1 | 6 |
| [apps/server/src/helpers/sanitize-html.ts](../apps/server/src/helpers/sanitize-html.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/should-ask-server-password.ts](../apps/server/src/helpers/should-ask-server-password.ts) | 1 | 1 | 1 |
| [apps/server/src/helpers/updater.ts](../apps/server/src/helpers/updater.ts) | 3 | 3 | 1, 19, 20 |
| [apps/server/src/helpers/user-roles.ts](../apps/server/src/helpers/user-roles.ts) | 1 | 1 | 1 |
| [apps/server/src/http/__tests__/healthz.test.ts](../apps/server/src/http/__tests__/healthz.test.ts) | 3 | 3 | 36, 43, 54 |
| [apps/server/src/http/__tests__/info.test.ts](../apps/server/src/http/__tests__/info.test.ts) | 1 | 1 | 1 |
| [apps/server/src/http/__tests__/login.test.ts](../apps/server/src/http/__tests__/login.test.ts) | 2 | 2 | 1, 79 |
| [apps/server/src/http/__tests__/manifest.test.ts](../apps/server/src/http/__tests__/manifest.test.ts) | 1 | 1 | 1 |
| [apps/server/src/http/__tests__/plugin-bundle.test.ts](../apps/server/src/http/__tests__/plugin-bundle.test.ts) | 1 | 1 | 1 |
| [apps/server/src/http/__tests__/plugin-routes.test.ts](../apps/server/src/http/__tests__/plugin-routes.test.ts) | 1 | 1 | 5 |
| [apps/server/src/http/__tests__/public.test.ts](../apps/server/src/http/__tests__/public.test.ts) | 1 | 1 | 1 |
| [apps/server/src/http/__tests__/upload.test.ts](../apps/server/src/http/__tests__/upload.test.ts) | 1 | 1 | 1 |
| [apps/server/src/http/helpers.ts](../apps/server/src/http/helpers.ts) | 2 | 2 | 1, 2 |
| [apps/server/src/http/index.ts](../apps/server/src/http/index.ts) | 2 | 2 | 1, 113 |
| [apps/server/src/http/info.ts](../apps/server/src/http/info.ts) | 1 | 1 | 1 |
| [apps/server/src/http/login.ts](../apps/server/src/http/login.ts) | 2 | 2 | 6, 55 |
| [apps/server/src/http/manifest.ts](../apps/server/src/http/manifest.ts) | 1 | 1 | 1 |
| [apps/server/src/http/oidc/__tests__/oidc.test.ts](../apps/server/src/http/oidc/__tests__/oidc.test.ts) | 7 | 7 | 6, 155, 209, 744, 854, 918, 939 |
| [apps/server/src/http/oidc/backchannel-logout.ts](../apps/server/src/http/oidc/backchannel-logout.ts) | 1 | 1 | 1 |
| [apps/server/src/http/oidc/callback.ts](../apps/server/src/http/oidc/callback.ts) | 1 | 1 | 1 |
| [apps/server/src/http/oidc/common.ts](../apps/server/src/http/oidc/common.ts) | 2 | 2 | 1, 13 |
| [apps/server/src/http/oidc/login.ts](../apps/server/src/http/oidc/login.ts) | 1 | 1 | 1 |
| [apps/server/src/http/plugin-bundle.ts](../apps/server/src/http/plugin-bundle.ts) | 1 | 1 | 1 |
| [apps/server/src/http/plugin-route.ts](../apps/server/src/http/plugin-route.ts) | 1 | 1 | 1 |
| [apps/server/src/http/upload.ts](../apps/server/src/http/upload.ts) | 1 | 1 | 1 |
| [apps/server/src/index.ts](../apps/server/src/index.ts) | 2 | 2 | 11, 35 |
| [apps/server/src/plugins/__tests__/hooks-manager.test.ts](../apps/server/src/plugins/__tests__/hooks-manager.test.ts) | 1 | 1 | 6 |
| [apps/server/src/plugins/__tests__/http-route-registry.test.ts](../apps/server/src/plugins/__tests__/http-route-registry.test.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/__tests__/plugin-manager.test.ts](../apps/server/src/plugins/__tests__/plugin-manager.test.ts) | 1 | 1 | 8 |
| [apps/server/src/plugins/__tests__/voice-consume.test.ts](../apps/server/src/plugins/__tests__/voice-consume.test.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/actions/assert-not-owner.ts](../apps/server/src/plugins/actions/assert-not-owner.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/actions/consume-voice-producer.ts](../apps/server/src/plugins/actions/consume-voice-producer.ts) | 1 | 1 | 4 |
| [apps/server/src/plugins/actions/create-plugin-message.ts](../apps/server/src/plugins/actions/create-plugin-message.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/actions/edit-plugin-message.ts](../apps/server/src/plugins/actions/edit-plugin-message.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/actions/push-to-plugin-clients.ts](../apps/server/src/plugins/actions/push-to-plugin-clients.ts) | 1 | 1 | 5 |
| [apps/server/src/plugins/actions/read-plugin-messages.ts](../apps/server/src/plugins/actions/read-plugin-messages.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/actions/set-plugin-user-role.ts](../apps/server/src/plugins/actions/set-plugin-user-role.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/actions/write-plugin-channels.ts](../apps/server/src/plugins/actions/write-plugin-channels.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/create-context.ts](../apps/server/src/plugins/create-context.ts) | 2 | 2 | 11, 17 |
| [apps/server/src/plugins/event-bus.ts](../apps/server/src/plugins/event-bus.ts) | 2 | 2 | 1, 2 |
| [apps/server/src/plugins/hooks-manager.ts](../apps/server/src/plugins/hooks-manager.ts) | 1 | 1 | 7 |
| [apps/server/src/plugins/http-route-registry.ts](../apps/server/src/plugins/http-route-registry.ts) | 1 | 1 | 5 |
| [apps/server/src/plugins/index.ts](../apps/server/src/plugins/index.ts) | 2 | 2 | 8, 25 |
| [apps/server/src/plugins/plugin-logger.ts](../apps/server/src/plugins/plugin-logger.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/plugin-settings-manager.ts](../apps/server/src/plugins/plugin-settings-manager.ts) | 2 | 2 | 1, 7 |
| [apps/server/src/plugins/plugin-state-store.ts](../apps/server/src/plugins/plugin-state-store.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/registry.ts](../apps/server/src/plugins/registry.ts) | 1 | 1 | 1 |
| [apps/server/src/plugins/run-hook.ts](../apps/server/src/plugins/run-hook.ts) | 1 | 1 | 1 |
| [apps/server/src/queues/activity-log/index.ts](../apps/server/src/queues/activity-log/index.ts) | 1 | 1 | 1 |
| [apps/server/src/queues/message-metadata/get-message-metadata.ts](../apps/server/src/queues/message-metadata/get-message-metadata.ts) | 1 | 1 | 1 |
| [apps/server/src/queues/message-metadata/helpers.ts](../apps/server/src/queues/message-metadata/helpers.ts) | 1 | 1 | 10 |
| [apps/server/src/routers/__tests__/categories.test.ts](../apps/server/src/routers/__tests__/categories.test.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/__tests__/channels.test.ts](../apps/server/src/routers/__tests__/channels.test.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/__tests__/dms.test.ts](../apps/server/src/routers/__tests__/dms.test.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/__tests__/emojis.test.ts](../apps/server/src/routers/__tests__/emojis.test.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/__tests__/files.test.ts](../apps/server/src/routers/__tests__/files.test.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/__tests__/messages.test.ts](../apps/server/src/routers/__tests__/messages.test.ts) | 1 | 1 | 7 |
| [apps/server/src/routers/__tests__/others.test.ts](../apps/server/src/routers/__tests__/others.test.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/__tests__/plugins.test.ts](../apps/server/src/routers/__tests__/plugins.test.ts) | 1 | 1 | 15 |
| [apps/server/src/routers/__tests__/roles.test.ts](../apps/server/src/routers/__tests__/roles.test.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/__tests__/users.test.ts](../apps/server/src/routers/__tests__/users.test.ts) | 1 | 1 | 9 |
| [apps/server/src/routers/__tests__/voice.test.ts](../apps/server/src/routers/__tests__/voice.test.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/categories/add-category.ts](../apps/server/src/routers/categories/add-category.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/categories/delete-category.ts](../apps/server/src/routers/categories/delete-category.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/categories/events.ts](../apps/server/src/routers/categories/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/categories/get-category.ts](../apps/server/src/routers/categories/get-category.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/categories/reorder-categories.ts](../apps/server/src/routers/categories/reorder-categories.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/categories/update-category.ts](../apps/server/src/routers/categories/update-category.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/add-channel.ts](../apps/server/src/routers/channels/add-channel.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/delete-channel.ts](../apps/server/src/routers/channels/delete-channel.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/delete-permissions.ts](../apps/server/src/routers/channels/delete-permissions.ts) | 1 | 1 | 5 |
| [apps/server/src/routers/channels/events.ts](../apps/server/src/routers/channels/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/get-channel.ts](../apps/server/src/routers/channels/get-channel.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/get-permissions.ts](../apps/server/src/routers/channels/get-permissions.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/mark-as-read.ts](../apps/server/src/routers/channels/mark-as-read.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/reorder-channels.ts](../apps/server/src/routers/channels/reorder-channels.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/update-channel.ts](../apps/server/src/routers/channels/update-channel.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/channels/update-permission.ts](../apps/server/src/routers/channels/update-permission.ts) | 1 | 1 | 5 |
| [apps/server/src/routers/dms/index.ts](../apps/server/src/routers/dms/index.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/dms/open-direct-message.ts](../apps/server/src/routers/dms/open-direct-message.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/emojis/add-emoji.ts](../apps/server/src/routers/emojis/add-emoji.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/emojis/delete-emoji.ts](../apps/server/src/routers/emojis/delete-emoji.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/emojis/events.ts](../apps/server/src/routers/emojis/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/emojis/get-emojis.ts](../apps/server/src/routers/emojis/get-emojis.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/emojis/update-emoji.ts](../apps/server/src/routers/emojis/update-emoji.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/files/delete-file.ts](../apps/server/src/routers/files/delete-file.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/invites/add-invite.ts](../apps/server/src/routers/invites/add-invite.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/invites/delete-invite.ts](../apps/server/src/routers/invites/delete-invite.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/invites/get-invites.ts](../apps/server/src/routers/invites/get-invites.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/messages/edit-message.ts](../apps/server/src/routers/messages/edit-message.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/messages/events.ts](../apps/server/src/routers/messages/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/messages/get-messages.ts](../apps/server/src/routers/messages/get-messages.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/messages/get-thread-messages.ts](../apps/server/src/routers/messages/get-thread-messages.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/messages/search.ts](../apps/server/src/routers/messages/search.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/messages/send-message.ts](../apps/server/src/routers/messages/send-message.ts) | 1 | 1 | 14 |
| [apps/server/src/routers/messages/signal-typing.ts](../apps/server/src/routers/messages/signal-typing.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/messages/toggle-message-pin.ts](../apps/server/src/routers/messages/toggle-message-pin.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/messages/toggle-message-reaction.ts](../apps/server/src/routers/messages/toggle-message-reaction.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/others/change-logo.ts](../apps/server/src/routers/others/change-logo.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/others/events.ts](../apps/server/src/routers/others/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/others/get-settings.ts](../apps/server/src/routers/others/get-settings.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/others/get-storage-settings.ts](../apps/server/src/routers/others/get-storage-settings.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/others/get-update.ts](../apps/server/src/routers/others/get-update.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/others/join.ts](../apps/server/src/routers/others/join.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/others/update-server.ts](../apps/server/src/routers/others/update-server.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/others/update-settings.ts](../apps/server/src/routers/others/update-settings.ts) | 1 | 1 | 8 |
| [apps/server/src/routers/others/use-secret-token.ts](../apps/server/src/routers/others/use-secret-token.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/events.ts](../apps/server/src/routers/plugins/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/execute-action.ts](../apps/server/src/routers/plugins/execute-action.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/plugins/execute-command.ts](../apps/server/src/routers/plugins/execute-command.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/plugins/get-capabilities.ts](../apps/server/src/routers/plugins/get-capabilities.ts) | 1 | 1 | 8 |
| [apps/server/src/routers/plugins/get-commands.ts](../apps/server/src/routers/plugins/get-commands.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/get-logs.ts](../apps/server/src/routers/plugins/get-logs.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/get-plugins.ts](../apps/server/src/routers/plugins/get-plugins.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/get-settings.ts](../apps/server/src/routers/plugins/get-settings.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/get-user-data.ts](../apps/server/src/routers/plugins/get-user-data.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/install-plugin.ts](../apps/server/src/routers/plugins/install-plugin.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/remove-plugin.ts](../apps/server/src/routers/plugins/remove-plugin.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/reset-capability-access.ts](../apps/server/src/routers/plugins/reset-capability-access.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/plugins/set-capability-access.ts](../apps/server/src/routers/plugins/set-capability-access.ts) | 1 | 1 | 7 |
| [apps/server/src/routers/plugins/set-user-data.ts](../apps/server/src/routers/plugins/set-user-data.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/toggle-plugin.ts](../apps/server/src/routers/plugins/toggle-plugin.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/plugins/update-setting.ts](../apps/server/src/routers/plugins/update-setting.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/roles/add-role.ts](../apps/server/src/routers/roles/add-role.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/roles/delete-role.ts](../apps/server/src/routers/roles/delete-role.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/roles/events.ts](../apps/server/src/routers/roles/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/roles/get-roles.ts](../apps/server/src/routers/roles/get-roles.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/roles/set-default-role.ts](../apps/server/src/routers/roles/set-default-role.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/roles/update-role.ts](../apps/server/src/routers/roles/update-role.ts) | 1 | 1 | 8 |
| [apps/server/src/routers/users/add-role.ts](../apps/server/src/routers/users/add-role.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/assert-can-modify-owner-role.ts](../apps/server/src/routers/users/assert-can-modify-owner-role.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/ban.ts](../apps/server/src/routers/users/ban.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/delete-user.ts](../apps/server/src/routers/users/delete-user.ts) | 1 | 1 | 7 |
| [apps/server/src/routers/users/events.ts](../apps/server/src/routers/users/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/get-user-info.ts](../apps/server/src/routers/users/get-user-info.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/get-users.ts](../apps/server/src/routers/users/get-users.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/kick.ts](../apps/server/src/routers/users/kick.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/remove-role.ts](../apps/server/src/routers/users/remove-role.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/reset-password.ts](../apps/server/src/routers/users/reset-password.ts) | 1 | 1 | 5 |
| [apps/server/src/routers/users/unban.ts](../apps/server/src/routers/users/unban.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/update-password.ts](../apps/server/src/routers/users/update-password.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/users/update-user.ts](../apps/server/src/routers/users/update-user.ts) | 1 | 1 | 5 |
| [apps/server/src/routers/voice/close-producer.ts](../apps/server/src/routers/voice/close-producer.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/voice/consume.ts](../apps/server/src/routers/voice/consume.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/voice/events.ts](../apps/server/src/routers/voice/events.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/voice/join.ts](../apps/server/src/routers/voice/join.ts) | 1 | 1 | 7 |
| [apps/server/src/routers/voice/leave.ts](../apps/server/src/routers/voice/leave.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/voice/move.ts](../apps/server/src/routers/voice/move.ts) | 1 | 1 | 6 |
| [apps/server/src/routers/voice/produce.ts](../apps/server/src/routers/voice/produce.ts) | 1 | 1 | 9 |
| [apps/server/src/routers/voice/set-consumer-quality.ts](../apps/server/src/routers/voice/set-consumer-quality.ts) | 1 | 1 | 1 |
| [apps/server/src/routers/voice/update-state.ts](../apps/server/src/routers/voice/update-state.ts) | 1 | 1 | 1 |
| [apps/server/src/runtimes/__tests__/voice-runtime.test.ts](../apps/server/src/runtimes/__tests__/voice-runtime.test.ts) | 1 | 1 | 1 |
| [apps/server/src/runtimes/index.ts](../apps/server/src/runtimes/index.ts) | 1 | 1 | 1 |
| [apps/server/src/runtimes/voice.ts](../apps/server/src/runtimes/voice.ts) | 1 | 1 | 12 |
| [apps/server/src/utils/__tests__/file-manager.test.ts](../apps/server/src/utils/__tests__/file-manager.test.ts) | 1 | 1 | 6 |
| [apps/server/src/utils/__tests__/metrics.test.ts](../apps/server/src/utils/__tests__/metrics.test.ts) | 1 | 1 | 26 |
| [apps/server/src/utils/__tests__/presence.test.ts](../apps/server/src/utils/__tests__/presence.test.ts) | 1 | 1 | 1 |
| [apps/server/src/utils/env.ts](../apps/server/src/utils/env.ts) | 11 | 17 | 2, 3, 4, 5, 8, 9, 13, 15, 22, 23, 34 |
| [apps/server/src/utils/ip-cache.ts](../apps/server/src/utils/ip-cache.ts) | 1 | 1 | 1 |
| [apps/server/src/utils/mediasoup.ts](../apps/server/src/utils/mediasoup.ts) | 1 | 1 | 1 |
| [apps/server/src/utils/metrics.ts](../apps/server/src/utils/metrics.ts) | 2 | 2 | 1, 72 |
| [apps/server/src/utils/pubsub.ts](../apps/server/src/utils/pubsub.ts) | 1 | 1 | 19 |
| [apps/server/src/utils/trpc.ts](../apps/server/src/utils/trpc.ts) | 1 | 1 | 7 |
| [apps/server/src/utils/wss.ts](../apps/server/src/utils/wss.ts) | 1 | 1 | 12 |
| [bun.lock](../bun.lock) | 22 | 28 | 6, 22, 23, 96, 99, 100, 147, 151, 166, 169, 188, 204, 229, 246, 660, 662, 664, 666, 668, 670, 2048, 2050 |
| [docker-entrypoint.sh](../docker-entrypoint.sh) | 3 | 3 | 4, 10, 31 |
| [docs/branding.md](../docs/branding.md) | 1 | 3 | 5 |
| [docs/deep-link-validation.md](../docs/deep-link-validation.md) | 3 | 3 | 3, 11, 17 |
| [docs/desktop-browser-api-audit.md](../docs/desktop-browser-api-audit.md) | 2 | 2 | 35, 42 |
| [docs/external-link-validation.md](../docs/external-link-validation.md) | 2 | 2 | 5, 17 |
| [docs/sandshark-phase-0.md](../docs/sandshark-phase-0.md) | 4 | 7 | 9, 15, 24, 27 |
| [docs/sandshark-versioning.md](../docs/sandshark-versioning.md) | 2 | 2 | 3, 11 |
| [docs/upstream-compatibility.md](../docs/upstream-compatibility.md) | 1 | 1 | 3 |
| [docs/windows-installer.md](../docs/windows-installer.md) | 2 | 2 | 5, 16 |
| [package.json](../package.json) | 2 | 2 | 2, 15 |
| [packages/e2e/package.json](../packages/e2e/package.json) | 3 | 3 | 2, 18, 22 |
| [packages/e2e/playwright.config.ts](../packages/e2e/playwright.config.ts) | 1 | 1 | 40 |
| [packages/e2e/tests/auto-login.pw.ts](../packages/e2e/tests/auto-login.pw.ts) | 10 | 10 | 2, 45, 62, 63, 78, 79, 94, 95, 106, 111 |
| [packages/e2e/tests/category-lifecycle.pw.ts](../packages/e2e/tests/category-lifecycle.pw.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/connect.pw.ts](../packages/e2e/tests/connect.pw.ts) | 2 | 2 | 2, 10 |
| [packages/e2e/tests/dm-unread.pw.ts](../packages/e2e/tests/dm-unread.pw.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/fixtures.ts](../packages/e2e/tests/fixtures.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/fixtures/plugins/e2e-plugin/client/index.js](../packages/e2e/tests/fixtures/plugins/e2e-plugin/client/index.js) | 3 | 3 | 3, 11, 85 |
| [packages/e2e/tests/fixtures/plugins/e2e-plugin/manifest.json](../packages/e2e/tests/fixtures/plugins/e2e-plugin/manifest.json) | 1 | 1 | 4 |
| [packages/e2e/tests/helpers/channels.ts](../packages/e2e/tests/helpers/channels.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/helpers/messages.ts](../packages/e2e/tests/helpers/messages.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/pagination.pw.ts](../packages/e2e/tests/pagination.pw.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/plugins.pw.ts](../packages/e2e/tests/plugins.pw.ts) | 1 | 1 | 2 |
| [packages/e2e/tests/search.pw.ts](../packages/e2e/tests/search.pw.ts) | 1 | 1 | 1 |
| [packages/e2e/tests/sessions.pw.ts](../packages/e2e/tests/sessions.pw.ts) | 1 | 1 | 2 |
| [packages/plugin-sdk/README.md](../packages/plugin-sdk/README.md) | 2 | 2 | 1, 3 |
| [packages/plugin-sdk/package.json](../packages/plugin-sdk/package.json) | 2 | 2 | 2, 25 |
| [packages/plugin-sdk/src/actions.ts](../packages/plugin-sdk/src/actions.ts) | 3 | 3 | 6, 9, 25 |
| [packages/plugin-sdk/src/client.ts](../packages/plugin-sdk/src/client.ts) | 7 | 7 | 13, 16, 23, 27, 30, 40, 84 |
| [packages/plugin-sdk/src/index.ts](../packages/plugin-sdk/src/index.ts) | 6 | 6 | 35, 45, 378, 382, 819, 859 |
| [packages/scripts/package.json](../packages/scripts/package.json) | 1 | 1 | 2 |
| [packages/shared/package.json](../packages/shared/package.json) | 1 | 1 | 2 |
| [packages/shared/src/helpers/__tests__/message-sanitizer.test.ts](../packages/shared/src/helpers/__tests__/message-sanitizer.test.ts) | 3 | 3 | 246, 292, 302 |
| [packages/shared/src/plugins/client-sdk.ts](../packages/shared/src/plugins/client-sdk.ts) | 2 | 2 | 31, 76 |
| [packages/shared/src/plugins/components.ts](../packages/shared/src/plugins/components.ts) | 2 | 2 | 70, 74 |
| [packages/shared/src/plugins/contract.ts](../packages/shared/src/plugins/contract.ts) | 4 | 5 | 17, 25, 26, 27 |
| [packages/shared/src/plugins/marketplace.ts](../packages/shared/src/plugins/marketplace.ts) | 2 | 2 | 5, 8 |
| [packages/shared/src/statics/metrics.ts](../packages/shared/src/statics/metrics.ts) | 1 | 1 | 5 |
| [packages/ui/package.json](../packages/ui/package.json) | 2 | 2 | 2, 32 |
| [packages/ui/src/lib/extract-image-palette.ts](../packages/ui/src/lib/extract-image-palette.ts) | 1 | 1 | 1 |
| [tsconfig.json](../tsconfig.json) | 1 | 1 | 5 |

## References other than package namespaces

Package import/dependency-only lines and lockfile entries are indexed above. The following entries show all other matching lines, including translations and test expectations.

### .github/ISSUE_TEMPLATE/bug_report.yml

```text
2: description: Report a bug in Sharkord. Please provide as much detail as possible to help us identify and fix the issue.
27: label: Sharkord Version
36: label: How are you running Sharkord?
```

### .github/ISSUE_TEMPLATE/feature_request.yml

```text
2: description: Suggest an idea for Sharkord. Please provide as much detail as possible to help us understand and evaluate your request.
11: Please check the [Roadmap](https://github.com/Sharkord/sharkord/blob/development/ROADMAP.md)
12: and [what Sharkord is not](https://github.com/Sharkord/sharkord/blob/development/CONTRIBUTING.md#what-sharkord-is-not)
```

### .github/ISSUE_TEMPLATE/question.yml

```text
13: Check [Common Questions](https://sharkord.com/docs/common-questions) for answers to frequently asked questions.
```

### .github/PULL_REQUEST_TEMPLATE.md

```text
4: https://github.com/Sharkord/sharkord/blob/development/CONTRIBUTING.md
```

### .github/actions/build-sharkord/action.yml

```text
1: name: Build Sharkord
```

### .github/workflows/develop-image.yml

```text
23: uses: ./.github/actions/build-sharkord
30: tags: ${{ secrets.DOCKER_USERNAME }}/sharkord:dev
32: org.opencontainers.image.title=Sharkord
33: org.opencontainers.image.description=Sharkord Server (dev)
34: org.opencontainers.image.source=https://github.com/Sharkord/sharkord
```

### .github/workflows/release.yml

```text
36: uses: ./.github/actions/build-sharkord
55: ${{ secrets.DOCKER_USERNAME }}/sharkord:latest
56: ${{ secrets.DOCKER_USERNAME }}/sharkord:v${{ steps.get_version.outputs.version }}
58: org.opencontainers.image.title=Sharkord
59: org.opencontainers.image.description=Sharkord Server
61: org.opencontainers.image.source=https://github.com/Sharkord/sharkord
70: apps/server/build/out/sharkord-linux-x64
71: apps/server/build/out/sharkord-linux-arm64
72: apps/server/build/out/sharkord-windows-x64.exe
73: apps/server/build/out/sharkord-macos-x64
74: apps/server/build/out/sharkord-macos-arm64
82: docker pull ${{ secrets.DOCKER_USERNAME }}/sharkord:v${{ steps.get_version.outputs.version }}
```

### AGENTS.md

```text
3: Guide for AI agents working on Sharkord. Read [CONTRIBUTING.md](CONTRIBUTING.md) for
```

### CONTRIBUTING.md

```text
1: # Sharkord Contributing Guide
5: Sharkord is maintained by its core maintainers.
9: ## What Sharkord Is
11: Sharkord is a self-hosted communication platform that provides core Discord-like features on your own infrastructure.
24: ## What Sharkord Is Not
26: - **Not a Discord Clone**: We do not aim to replicate every Discord feature. Sharkord is not intended to be a huge community platform or a knowledge base. We focus on core communication features, not feature parity with Discord.
50: - Explain why it fits Sharkord’s scope
```

### Dockerfile

```text
8: COPY apps/server/build/out/sharkord-linux-x64 /tmp/sharkord-linux-x64
9: COPY apps/server/build/out/sharkord-linux-arm64 /tmp/sharkord-linux-arm64
13: amd64)  cp /tmp/sharkord-linux-x64 /sharkord ;; \
14: arm64)  cp /tmp/sharkord-linux-arm64 /sharkord ;; \
17: chmod +x /sharkord; \
18: chown bun:bun /sharkord; \
19: rm -rf /tmp/sharkord-linux-*
21: RUN mkdir -p /home/bun/.config/sharkord && \
```

### LICENSE

```text
3: Copyright (c) 2025 Sharkord Team
```

### README.md

```text
3: SandShark is a private-for-now Windows desktop client project for Sharkord.
5: The goal is to reuse the existing Sharkord React/TypeScript frontend while adding Electron-based desktop functionality, including native notifications, tray behavior, push-to-talk, Windows startup options, local configuration, and installer/update support.
9: This repository is initialized as the SandShark project shell. The implementation plan lives in [Sharkord_Desktop_Fork_TODO.md](./Sharkord_Desktop_Fork_TODO.md).
```

### ROADMAP.md

```text
1: # Sharkord Roadmap
```

### UPSTREAM_MERGE_ASSESSMENT.md

```text
1: # Sharkord upgrade assessment
3: Checked September 15, 2026. Target: Sharkord v0.0.25 (`b94d9a9e`). SandShark committed baseline: `c992a4b8`. This is an assessment, not an applied merge.
7: - [v0.0.24, August 27](https://github.com/Sharkord/sharkord/releases/tag/v0.0.24): security and permission fixes, safer database migrations, session invalidation, OIDC, voice diagnostics, reconnect handling, voice UI and performance changes.
8: - [v0.0.25, September 4](https://github.com/Sharkord/sharkord/releases/tag/v0.0.25): breaking plugin SDK upgrade, per-role plugin capability permissions, settings redesign, moving channels between categories, screen-share cursor settings, OIDC corrections, and Brazilian Portuguese translations.
25: These counts concern committed HEAD. The current uncommitted capture diagnostics, native process exclusion, playback logging, and tests must also be included during integration. Preserve the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md`.
```

### UPSTREAM_MERGE_CHECKLIST.md

```text
1: # Sharkord v0.0.25 merge checklist
3: Status: local integration complete. Merge commit `1875f5e3` is on `main` and `integrate/sharkord-v0.0.25`. Release-only checks remain unchecked below.
5: Target: `b94d9a9e` (Sharkord v0.0.25). See [the assessment](UPSTREAM_MERGE_ASSESSMENT.md) for evidence and release links. Complete the phases in order. A checked task must have a recorded result; unresolved failures stay unchecked.
11: - [x] Keep the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md` separate from merge work.
169: - Fast-forwarded the main checkout and ran `bun install --frozen-lockfile` successfully. Only the pre-existing deletion of `Sharkord_Desktop_Fork_TODO.md` remains as a tracked working-tree change.
173: - Candidate: `.integration/sharkord-v0.0.25/apps/desktop/release/win-unpacked/SandShark.exe`. Server release binaries are under the integration worktree's `apps/server/build/out`.
```

### UPSTREAM_MERGE_RELEASE_NOTES.md

```text
1: # SandShark integration of Sharkord v0.0.25
```

### apps/client/src/audio-worklets/audio-meter-processor.js

```text
1: const MICROPHONE_AUDIO_METER_WORKLET_NAME = 'sharkord-audio-meter';
```

### apps/client/src/audio-worklets/noise-gate-processor.js

```text
1: const MICROPHONE_NOISE_GATE_WORKLET_NAME = 'sharkord-noise-gate';
```

### apps/client/src/components/debug-info/index.tsx

```text
7: '%cSHARKORD',
21: '%cThis is a open source project, feel free to contribute: https://github.com/Sharkord/sharkord',
```

### apps/client/src/components/dialogs/plugin-install-confirm/index.tsx

```text
92: href="https://sharkord.com/docs/plugins/security"
97: https://sharkord.com/docs/plugins/security
```

### apps/client/src/components/dialogs/welcome-profile-setup/index.tsx

```text
120: // Older Sharkord servers require this field. Newer servers ignore it.
171: serverName: serverName ?? 'Sharkord'
```

### apps/client/src/components/error-boundary/global-error-boundary.tsx

```text
23: const GITHUB_ISSUES_URL = 'https://github.com/Sharkord/sharkord/issues';
```

### apps/client/src/components/left-sidebar/helpers.ts

```text
3: export const VOICE_USER_DND_MIME = 'application/x-sharkord-user-id';
```

### apps/client/src/components/routing/__tests__/helpers.test.ts

```text
102: expect(getDocumentTitle(false, 'My Server', 5)).toBe('Sharkord');
107: expect(getDocumentTitle(true, undefined, 0)).toBe('Sharkord');
```

### apps/client/src/components/routing/desktop-deep-link-controller.tsx

```text
50: (url.protocol !== 'sandshark:' && url.protocol !== 'sharkord:') ||
133: : 'Could not open the linked Sharkord server.'
146: toast.error('Choose a Sharkord server before opening a channel link.');
```

### apps/client/src/components/routing/helpers.ts

```text
47: if (!isConnected || !serverName) return 'Sharkord';
```

### apps/client/src/components/server-screens/server-settings/storage/metrics.tsx

```text
41: {t('diskSharkordUsed')}
44: {filesize(diskMetrics.sharkordUsedSpace, { standard: 'jedec' })}
```

### apps/client/src/components/server-screens/user-settings/desktop/index.tsx

```text
198: SandShark is a desktop client for compatible Sharkord servers.
322: description="A Sharkord-compatible desktop client."
```

### apps/client/src/components/voice-provider/hooks/use-transport-stats.ts

```text
513: window.sharkordDebug = {
514: ...window.sharkordDebug,
519: delete window.sharkordDebug?.printVoiceStats;
```

### apps/client/src/features/app/actions.ts

```text
125: 'Could not reach the saved Sharkord server. Check its URL and try again.'
```

### apps/client/src/features/server/actions.ts

```text
80: throw new Error('No Sharkord server has been selected.');
322: window.sharkordDebug = {
323: ...window.sharkordDebug,
```

### apps/client/src/features/server/plugins/plugin-store.ts

```text
78: window.__SHARKORD_STORE__ = pluginStore;
```

### apps/client/src/helpers/audio-gate.ts

```text
6: const MICROPHONE_NOISE_GATE_WORKLET_NAME = 'sharkord-noise-gate';
7: const MICROPHONE_AUDIO_METER_WORKLET_NAME = 'sharkord-audio-meter';
```

### apps/client/src/helpers/exposes.ts

```text
10: window.__SHARKORD_EXPOSED_LIBS__ = {
17: window.__SHARKORD_REACT__ = React;
18: window.__SHARKORD_REACT_JSX__ = ReactJSX;
19: window.__SHARKORD_REACT_JSX_DEV__ = ReactJSXDev;
20: window.__SHARKORD_REACT_DOM__ = ReactDOM;
21: window.__SHARKORD_REACT_DOM_CLIENT__ = ReactDOMClient;
```

### apps/client/src/helpers/get-file-url.ts

```text
8: throw new Error('No Sharkord server has been selected.');
18: throw new Error('No Sharkord server has been selected.');
```

### apps/client/src/helpers/server-connection.ts

```text
30: throw new Error('Enter a Sharkord server URL.');
297: throw new Error('This endpoint does not appear to be a Sharkord server.');
```

### apps/client/src/helpers/server-session.ts

```text
71: throw new Error('No Sharkord server has been selected.');
```

### apps/client/src/helpers/storage.ts

```text
2: IDENTITY = 'sharkord-identity',
3: USER_PASSWORD = 'sharkord-user-password',
5: DEVICES_SETTINGS = 'sharkord-devices-settings',
6: FLOATING_CARD_POSITION = 'sharkord-floating-card-position',
7: RIGHT_SIDEBAR_STATE = 'sharkord-right-sidebar-state',
8: VOICE_CHAT_SIDEBAR_STATE = 'sharkord-voice-chat-sidebar-state',
9: VOICE_CHAT_SIDEBAR_CHANNEL_ID = 'sharkord-voice-chat-sidebar-channel-id',
10: VOICE_CHAT_SIDEBAR_WIDTH = 'sharkord-voice-chat-sidebar-width',
11: VOICE_CHAT_SHOW_USER_BANNERS = 'sharkord-voice-chat-show-user-banners',
12: VOLUME_SETTINGS = 'sharkord-volume-settings',
13: STREAM_QUALITY_SETTINGS = 'sharkord-stream-quality-settings',
14: RECENT_EMOJIS = 'sharkord-recent-emojis',
15: DEBUG = 'sharkord-debug',
16: DRAFT_MESSAGES = 'sharkord-draft-messages',
17: HIDE_NON_VIDEO_PARTICIPANTS = 'sharkord-hide-non-video-participants',
18: THREAD_SIDEBAR_WIDTH = 'sharkord-thread-sidebar-width',
19: LEFT_SIDEBAR_WIDTH = 'sharkord-left-sidebar-width',
20: RIGHT_SIDEBAR_WIDTH = 'sharkord-right-sidebar-width',
21: CATEGORIES_EXPANDED = 'sharkord-categories-expanded',
22: AUTO_LOGIN = 'sharkord-auto-login',
23: AUTO_LOGIN_TOKEN = 'sharkord-auto-login-token',
24: LAST_SELECTED_CHANNEL = 'sharkord-last-selected-channel',
25: AUTO_JOIN_LAST_CHANNEL = 'sharkord-auto-join-last-channel',
26: BROWSER_NOTIFICATIONS = 'sharkord-browser-notifications',
27: BROWSER_NOTIFICATIONS_FOR_MENTIONS = 'sharkord-browser-notifications-for-mentions',
28: BROWSER_NOTIFICATIONS_FOR_DMS = 'sharkord-browser-notifications-for-dms',
29: CHAT_INPUT_HEIGHT_VH = 'sharkord-chat-input-height-vh',
30: THREAD_INPUT_HEIGHT_VH = 'sharkord-thread-input-height-vh',
31: BROWSER_NOTIFICATIONS_FOR_REPLIES = 'sharkord-browser-notifications-for-replies',
32: LANGUAGE = 'sharkord-language',
33: PLUGIN_SLOT_DEBUG = 'sharkord-plugin-slot-debug',
34: HIDE_OWN_SCREEN_SHARE = 'sharkord-hide-own-screen-share',
35: ALWAYS_SHOW_VOICE_CONTROLS = 'sharkord-always-show-voice-controls',
45: TOKEN = 'sharkord-token',
47: OIDC_NO_AUTO_REDIRECT = 'sharkord-oidc-no-auto-redirect'
```

### apps/client/src/i18n/locales/cs/common.json

```text
16: "mobileNotOptimized": "Sharkord ještě není optimalizovaný pro telefony, ne všechno bude fungovat elegantně.",
75: "globalErrorTitle": "Promiňte, Sharkord spadl a nedokázal se zotavit.",
76: "globalErrorDescription": "V Sharkordu došlo k neočekávané chybě. Znovu načtěte aplikaci. Pokud se to bude opakovat, otevřete prosím issue na GitHubu a přiložte podrobnosti chyby.",
```

### apps/client/src/i18n/locales/cs/connect.json

```text
24: "loadingApp": "Načítám Sharkord",
```

### apps/client/src/i18n/locales/cs/dialogs.json

```text
85: "pluginInstallConfirmLead": "Rozšíření jsou velmi mocný způsob, jak rozšířit funkce Sharkordu, ale mohou ovlivnit bezpečnost.",
92: "pluginInstallUseDocker": "Silně doporučujeme spouštět Sharkord v kontejneru pro izolaci a redukci rizik.",
```

### apps/client/src/i18n/locales/cs/settings.json

```text
36: "passwordManagedBySsoDesc": "Tento účet se přihlašuje přes jednotné přihlášení, takže nemá heslo Sharkordu, které by šlo změnit. Přihlašovací údaje spravujte u svého poskytovatele identity.",
39: "othersDesc": "Nastavení chování Sharkordu.",
43: "languageDesc": "Vyberte jazyk ve kterém se Sharkord zobrazuje.",
115: "restrictOwnAudioDesc": "Při sdílenjí obrazovky vynechat zvuky Sharkordu.",
116: "restrictOwnAudioUnsupported": "Váš prohlížeč nepodporuje omezení sdílení vlastních zvuků. Zvuky Sharkordu můžou způsobit ozvěnu nebo feedback.",
208: "noPluginsDesc": "Nainstalujte si rozšíření a přidejte nové funkce a možnosti svého serveru Sharkord.",
241: "marketplaceVerifiedTooltip": "Toto rozšíření bylo ověřeno týmem Sharkord.",
268: "updatesDesc": "Zkontrolujte a nainstalujte aktualizace, aby váš server Sharkord běžel s nejnovějšími funkcemi a vylepšeními zabezpečení.",
277: "upToDateDesc": "Váš server používá nejnovější verzi Sharkordu.",
327: "diskSharkordUsed": "Využito Sharkordem",
472: "logoDesc": "Doporučujeme čtvercový obrázek. Pokud obrázek není přesně čtvercový, ikony PWA se vrátí k výchozí ikoně Sharkord.",
```

### apps/client/src/i18n/locales/en/common.json

```text
16: "mobileNotOptimized": "Sharkord is not optimized for mobile devices yet. The experience will not be ideal.",
75: "globalErrorTitle": "Sorry, Sharkord crashed and couldn't recover.",
76: "globalErrorDescription": "Sharkord hit an unexpected error. Reload the app. If this keeps happening, please open an issue with the error details in github.",
```

### apps/client/src/i18n/locales/en/connect.json

```text
24: "loadingApp": "Loading Sharkord",
```

### apps/client/src/i18n/locales/en/dialogs.json

```text
94: "pluginInstallConfirmLead": "Plugins are a very powerful way to extend Sharkord's functionality, but they also come with significant security risks.",
101: "pluginInstallUseDocker": "We strongly recommend running Sharkord in a Docker container for isolation and reduced risk.",
```

### apps/client/src/i18n/locales/en/settings.json

```text
36: "passwordManagedBySsoDesc": "This account signs in through single sign-on, so it has no Sharkord password to change. Manage your credentials with your identity provider.",
39: "othersDesc": "General settings related to Sharkord's behavior.",
115: "restrictOwnAudioDesc": "Exclude Sharkord audio from the audio captured during screen sharing.",
116: "restrictOwnAudioUnsupported": "Your browser does not support restricting your own audio during screen sharing. Sharkord audio may be captured in the shared stream, which can cause echo or feedback.",
210: "noPluginsDesc": "Install plugins to add new features and extend the functionality of your Sharkord server.",
243: "marketplaceVerifiedTooltip": "This plugin was verified by Sharkord.",
270: "updatesDesc": "Check for and install updates to keep your Sharkord server running with the latest features and security improvements.",
279: "upToDateDesc": "Your server is running the latest version of Sharkord.",
329: "diskSharkordUsed": "Sharkord Used",
474: "logoDesc": "A square image is recommended. If your image is not perfectly square, the PWA icons fall back to the default Sharkord icon.",
```

### apps/client/src/i18n/locales/es/common.json

```text
16: "mobileNotOptimized": "Sharkord aún no está optimizado para dispositivos móviles. La experiencia no será ideal.",
75: "globalErrorTitle": "Lo sentimos, Sharkord se bloqueó y no pudo recuperarse.",
76: "globalErrorDescription": "Sharkord encontró un error inesperado. Recarga la aplicación. Si esto sigue ocurriendo, abre una incidencia en GitHub con los detalles del error.",
```

### apps/client/src/i18n/locales/es/connect.json

```text
24: "loadingApp": "Cargando Sharkord",
```

### apps/client/src/i18n/locales/es/dialogs.json

```text
85: "pluginInstallConfirmLead": "Los plugins son una forma muy poderosa de extender la funcionalidad de Sharkord, pero también conllevan riesgos de seguridad significativos.",
92: "pluginInstallUseDocker": "Recomendamos encarecidamente ejecutar Sharkord en un contenedor Docker para mayor aislamiento y menor riesgo.",
```

### apps/client/src/i18n/locales/es/settings.json

```text
36: "passwordManagedBySsoDesc": "Esta cuenta inicia sesión mediante inicio de sesión único, por lo que no tiene una contraseña de Sharkord que cambiar. Gestiona tus credenciales en tu proveedor de identidad.",
39: "othersDesc": "Ajustes generales relacionados con el comportamiento de Sharkord.",
115: "restrictOwnAudioDesc": "Excluir el audio de Sharkord del audio capturado durante la pantalla compartida.",
116: "restrictOwnAudioUnsupported": "Tu navegador no soporta restringir tu propio audio durante la pantalla compartida. El audio de Sharkord puede ser capturado en la transmisión compartida, lo que puede causar eco o retroalimentación.",
208: "noPluginsDesc": "Instala plugins para añadir nuevas funciones y extender la funcionalidad de tu servidor Sharkord.",
241: "marketplaceVerifiedTooltip": "Este plugin fue verificado por Sharkord.",
268: "updatesDesc": "Busca e instala actualizaciones para mantener tu servidor Sharkord funcionando con las últimas funciones y mejoras de seguridad.",
277: "upToDateDesc": "Tu servidor está ejecutando la última versión de Sharkord.",
327: "diskSharkordUsed": "Usado por Sharkord",
472: "logoDesc": "Se recomienda una imagen cuadrada. Si tu imagen no es perfectamente cuadrada, los iconos PWA usarán el icono predeterminado de Sharkord.",
```

### apps/client/src/i18n/locales/fr/common.json

```text
16: "mobileNotOptimized": "Sharkord n'est pas encore optimisé pour les appareils mobiles. L'expérience ne sera pas optimale.",
75: "globalErrorTitle": "Désolé, Sharkord a planté et n'a pas pu récupérer.",
76: "globalErrorDescription": "Sharkord a rencontré une erreur inattendue. Rechargez l'application. Si cela continue, ouvrez une issue sur GitHub avec les détails de l'erreur.",
```

### apps/client/src/i18n/locales/fr/connect.json

```text
24: "loadingApp": "Chargement de Sharkord",
```

### apps/client/src/i18n/locales/fr/dialogs.json

```text
85: "pluginInstallConfirmLead": "Les plugins sont un moyen tres puissant d'etendre les fonctionnalites de Sharkord, mais ils s'accompagnent aussi de risques de securite importants.",
92: "pluginInstallUseDocker": "Nous recommandons fortement d'executer Sharkord dans un conteneur Docker pour l'isolation et la reduction des risques.",
```

### apps/client/src/i18n/locales/fr/settings.json

```text
36: "passwordManagedBySsoDesc": "Ce compte se connecte via l'authentification unique, il n'a donc pas de mot de passe Sharkord à modifier. Gérez vos identifiants auprès de votre fournisseur d'identité.",
39: "othersDesc": "Paramètres généraux liés au comportement de Sharkord.",
115: "restrictOwnAudioDesc": "Exclure l'audio de Sharkord de l'audio capturé pendant le partage d'écran.",
116: "restrictOwnAudioUnsupported": "Votre navigateur ne prend pas en charge la restriction de votre propre audio pendant le partage d'écran. L'audio de Sharkord peut être capturé dans le flux partagé, ce qui peut provoquer de l'écho ou du larsen.",
202: "pluginsManageDesc": "Gérez les extensions installées et étendez les fonctionnalités de votre serveur Sharkord.",
208: "noPluginsDesc": "Installez des extensions pour ajouter de nouvelles fonctionnalités à votre serveur Sharkord.",
241: "marketplaceVerifiedTooltip": "Ce plugin a ete verifie par Sharkord.",
268: "updatesDesc": "Vérifiez et installez les mises à jour pour maintenir votre serveur Sharkord avec les dernières fonctionnalités et améliorations de sécurité.",
277: "upToDateDesc": "Votre serveur exécute la dernière version de Sharkord.",
327: "diskSharkordUsed": "Espace utilisé par Sharkord",
472: "logoDesc": "Une image carrée est recommandée. Si votre image n'est pas parfaitement carrée, les icônes PWA utiliseront l'icône Sharkord par défaut.",
```

### apps/client/src/i18n/locales/it/common.json

```text
16: "mobileNotOptimized": "Sharkord non e ancora ottimizzato per dispositivi mobili. L'esperienza non sara ideale.",
75: "globalErrorTitle": "Ci dispiace, Sharkord si è arrestato e non è riuscito a riprendersi.",
76: "globalErrorDescription": "Sharkord ha riscontrato un errore imprevisto. Ricarica l'app. Se continua a succedere, apri una issue su GitHub con i dettagli dell'errore.",
```

### apps/client/src/i18n/locales/it/connect.json

```text
24: "loadingApp": "Caricamento di Sharkord",
```

### apps/client/src/i18n/locales/it/dialogs.json

```text
85: "pluginInstallConfirmLead": "I plugin sono un modo molto potente per estendere le funzionalita di Sharkord, ma comportano anche rischi di sicurezza significativi.",
92: "pluginInstallUseDocker": "Consigliamo vivamente di eseguire Sharkord in un container Docker per isolamento e riduzione del rischio.",
```

### apps/client/src/i18n/locales/it/settings.json

```text
36: "passwordManagedBySsoDesc": "Questo account accede tramite Single Sign-On, quindi non ha una password di Sharkord da modificare. Gestisci le tue credenziali presso il tuo provider di identità.",
39: "othersDesc": "Impostazioni generali relative al comportamento di Sharkord.",
115: "restrictOwnAudioDesc": "Escludi l'audio di Sharkord dall'audio catturato durante la condivisione schermo.",
116: "restrictOwnAudioUnsupported": "Il tuo browser non supporta la limitazione del proprio audio durante la condivisione schermo. L'audio di Sharkord potrebbe essere catturato nel flusso condiviso, causando eco o feedback.",
208: "noPluginsDesc": "Installa plugin per aggiungere funzionalita ed estendere il tuo server Sharkord.",
241: "marketplaceVerifiedTooltip": "Questo plugin e stato verificato da Sharkord.",
268: "updatesDesc": "Controlla e installa aggiornamenti per mantenere il tuo server Sharkord con funzionalita e miglioramenti di sicurezza piu recenti.",
277: "upToDateDesc": "Il tuo server esegue l'ultima versione di Sharkord.",
327: "diskSharkordUsed": "Usato da Sharkord",
472: "logoDesc": "Si consiglia un'immagine quadrata. Se l'immagine non è perfettamente quadrata, le icone PWA useranno l'icona predefinita di Sharkord.",
```

### apps/client/src/i18n/locales/pt-BR/common.json

```text
16: "mobileNotOptimized": "O Sharkord ainda não está otimizado para dispositivos móveis. A experiência pode não ser a ideal.",
75: "globalErrorTitle": "Desculpe, o Sharkord travou e não pôde se recuperar.",
76: "globalErrorDescription": "O Sharkord encontrou um erro inesperado. Recarregue o aplicativo. Se isso continuar acontecendo, abra um problema com os detalhes do erro no GitHub.",
```

### apps/client/src/i18n/locales/pt-BR/connect.json

```text
24: "loadingApp": "Carregando o Sharkord",
```

### apps/client/src/i18n/locales/pt-BR/dialogs.json

```text
85: "pluginInstallConfirmLead": "Plugins são uma maneira muito poderosa de estender a funcionalidade do Sharkord, mas também vêm com riscos de segurança significativos.",
92: "pluginInstallUseDocker": "Recomendamos fortemente a execução do Sharkord em um contêiner Docker para isolamento e risco reduzido.",
```

### apps/client/src/i18n/locales/pt-BR/settings.json

```text
36: "passwordManagedBySsoDesc": "Esta conta faz login por meio de single sign-on (SSO), então não há uma senha do Sharkord para ser alterada. Gerencie suas credenciais com o seu provedor de identidade.",
39: "othersDesc": "Configurações gerais relacionadas ao comportamento do Sharkord.",
115: "restrictOwnAudioDesc": "Excluir o áudio do Sharkord do áudio capturado durante o compartilhamento de tela.",
116: "restrictOwnAudioUnsupported": "Seu navegador não suporta a restrição do próprio áudio durante o compartilhamento de tela. O áudio do Sharkord pode ser capturado na transmissão compartilhada, o que pode causar eco ou feedback.",
210: "noPluginsDesc": "Instale plugins para adicionar novos recursos e estender a funcionalidade do seu servidor Sharkord.",
243: "marketplaceVerifiedTooltip": "Este plugin foi verificado pelo Sharkord.",
270: "updatesDesc": "Verifique e instale atualizações para manter seu servidor Sharkord funcionando com os recursos e melhorias de segurança mais recentes.",
279: "upToDateDesc": "Seu servidor está executando a versão mais recente do Sharkord.",
329: "diskSharkordUsed": "Usado pelo Sharkord",
474: "logoDesc": "Uma imagem quadrada é recomendada. Se sua imagem não for perfeitamente quadrada, os ícones do PWA cairão para o ícone padrão do Sharkord.",
```

### apps/client/src/i18n/locales/ru/common.json

```text
16: "mobileNotOptimized": "Sharkord пока еще не оптимизирован под мобильные устройства. Пользовательский опыт может быть неудовлетворительным.",
75: "globalErrorTitle": "Извините, Sharkord упал и не смог восстановиться.",
76: "globalErrorDescription": "В Sharkord произошла непредвиденная ошибка. Перезагрузите приложение. Если это будет повторяться, откройте issue на GitHub и приложите детали ошибки.",
```

### apps/client/src/i18n/locales/ru/connect.json

```text
24: "loadingApp": "Загрузка Sharkord",
```

### apps/client/src/i18n/locales/ru/dialogs.json

```text
85: "pluginInstallConfirmLead": "Плагины — это очень мощный способ расширить функциональность Sharkord, но они также несут значительные риски безопасности.",
92: "pluginInstallUseDocker": "Мы настоятельно рекомендуем запускать Sharkord в Docker-контейнере для изоляции и снижения рисков.",
```

### apps/client/src/i18n/locales/ru/settings.json

```text
37: "passwordManagedBySsoDesc": "Эта учётная запись входит через единый вход, поэтому у неё нет пароля Sharkord, который можно изменить. Управляйте учётными данными у своего поставщика.",
40: "othersDesc": "Общие настройки, связанные с Sharkord.",
92: "restrictOwnAudioDesc": "Исключать звук Sharkord из аудио, захватываемого при демонстрации экрана.",
93: "restrictOwnAudioUnsupported": "Ваш браузер не поддерживает ограничение собственного аудио при демонстрации экрана. Звук Sharkord может попасть в общий поток, что может вызвать эхо или обратную связь.",
179: "pluginsManageDesc": "Управляйте установленными плагинами и расширяйте свой сервер Sharkord дополнительными функциями и возможностями.",
185: "noPluginsDesc": "Установите плагины, чтобы добавить новые функции и расширить функциональность вашего сервера Sharkord.",
219: "updatesDesc": "Проверьте наличие и установите обновления, чтобы ваш сервер Sharkord работал с новейшими функциями и улучшениями безопасности.",
228: "upToDateDesc": "На вашем сервере установлена ​​последняя версия Sharkord.",
286: "diskSharkordUsed": "Использовано Sharkord",
396: "marketplaceVerifiedTooltip": "Этот плагин был проверен Sharkord.",
481: "logoDesc": "Рекомендуется квадратное изображение. Если изображение не идеально квадратное, для иконок PWA будет использована стандартная иконка Sharkord.",
```

### apps/client/src/i18n/locales/zh/common.json

```text
16: "mobileNotOptimized": "Sharkord 尚未针对移动设备进行优化，使用体验可能不佳。",
75: "globalErrorTitle": "抱歉，Sharkord 崩溃了，而且无法恢复。",
76: "globalErrorDescription": "Sharkord 遇到了一个意外错误。请重新加载应用。如果这种情况持续发生，请在 GitHub 上提交一个包含错误详情的 issue。",
```

### apps/client/src/i18n/locales/zh/connect.json

```text
24: "loadingApp": "正在加载 Sharkord",
```

### apps/client/src/i18n/locales/zh/dialogs.json

```text
85: "pluginInstallConfirmLead": "插件是扩展 Sharkord 功能的强大方式，但也存在重大安全风险。",
92: "pluginInstallUseDocker": "我们强烈建议在 Docker 容器中运行 Sharkord 以实现隔离并降低风险。",
```

### apps/client/src/i18n/locales/zh/settings.json

```text
36: "passwordManagedBySsoDesc": "此账户通过单点登录进行登录，因此没有可修改的 Sharkord 密码。请在你的身份提供商处管理凭据。",
39: "othersDesc": "与 Sharkord 行为相关的常规设置。",
115: "restrictOwnAudioDesc": "在屏幕共享期间将 Sharkord 的音频排除在捕获到的音频之外。",
116: "restrictOwnAudioUnsupported": "您的浏览器不支持在屏幕共享期间限制自己的音频。共享流中可能会捕获 Sharkord 的音频，从而导致回声或反馈。",
202: "pluginsManageDesc": "管理已安装的插件，通过更多功能扩展您的 Sharkord 服务器。",
208: "noPluginsDesc": "安装插件以添加新功能并扩展您的 Sharkord 服务器。",
242: "updatesDesc": "检查并安装更新，确保您的 Sharkord 服务器始终运行最新功能和安全改进。",
251: "upToDateDesc": "您的服务器正在运行最新版本的 Sharkord。",
301: "diskSharkordUsed": "Sharkord 占用",
416: "marketplaceVerifiedTooltip": "此插件已通过 Sharkord 验证。",
472: "logoDesc": "建议使用正方形图片。如果图片不是完美的正方形，PWA 图标将回退为默认的 Sharkord 图标。",
```

### apps/client/src/screens/connect/index.tsx

```text
178: alt="Sharkord"
289: href="https://github.com/sharkord/sharkord"
298: href="https://sharkord.com"
302: Sharkord
```

### apps/client/src/screens/server-connection/index.tsx

```text
112: : 'Could not validate the Sharkord server.'
166: <span>Add a Sharkord server to get started.</span>
245: {editor?.profile ? 'Edit Sharkord Server' : 'Add Sharkord Server'}
250: <Label htmlFor="server-url">Sharkord server URL</Label>
```

### apps/client/src/vite-env.d.ts

```text
8: sharkordDebug?: {
196: __SHARKORD_STORE__: import('@sharkord/shared').TPluginStore;
199: __SHARKORD_EXPOSED_LIBS__: {
205: __SHARKORD_REACT__: typeof import('react');
206: __SHARKORD_REACT_JSX__: typeof import('react/jsx-runtime');
207: __SHARKORD_REACT_JSX_DEV__: typeof import('react/jsx-dev-runtime');
208: __SHARKORD_REACT_DOM__: typeof import('react-dom');
209: __SHARKORD_REACT_DOM_CLIENT__: typeof import('react-dom/client');
```

### apps/desktop/RELEASE_NOTES.md

```text
3: - Integrates Sharkord v0.0.25, including the redesigned settings, plugin framework, authentication/session protections, voice statistics and screen-share cursor controls.
```

### apps/desktop/electron-builder.yml

```text
32: - sharkord
```

### apps/desktop/src/main.ts

```text
90: const deepLinkSchemes = ['sandshark', 'sharkord'];
1254: (url.protocol === 'sandshark:' || url.protocol === 'sharkord:') &&
```

### apps/server/build/build.ts

```text
84: { out: 'sharkord-linux-x64', target: 'bun-linux-x64' },
85: { out: 'sharkord-linux-arm64', target: 'bun-linux-arm64' },
86: { out: 'sharkord-windows-x64.exe', target: 'bun-windows-x64' },
87: { out: 'sharkord-macos-arm64', target: 'bun-darwin-arm64' }
105: console.log('Sharkord built.');
```

### apps/server/build/helpers.ts

```text
159: 'process.env.SHARKORD_ENV': '"production"',
160: 'process.env.SHARKORD_BUILD_VERSION': `"${version}"`,
161: 'process.env.SHARKORD_BUILD_DATE': `"${new Date().toISOString()}"`,
162: 'process.env.SHARKORD_MEDIASOUP_BIN_NAME': `"${mediasoupBinary}"`,
```

### apps/server/scripts/seed-mock.ts

```text
241: name: 'Sharkord Dev',
```

### apps/server/src/__tests__/config.test.ts

```text
63: setEnv('SHARKORD_PORT', '8080');
69: setEnv('SHARKORD_PORT', 'not-a-port');
75: setEnv('SHARKORD_BACKUP_DATABASE', 'false');
81: setEnv('SHARKORD_PORT', '-1');
85: setEnv('SHARKORD_PORT', '0');
91: setEnv('SHARKORD_PORT', '80.5');
98: setEnv('SHARKORD_PORT', '{"nested":true}');
104: setEnv('SHARKORD_WEBRTC_MAX_BITRATE', '0');
110: setEnv('SHARKORD_TRUSTED_PROXIES', '10.0.0.1,10.0.0.2');
119: setEnv('SHARKORD_ALLOWED_ORIGINS', ',');
129: setEnv('SHARKORD_PORT', '8080');
```

### apps/server/src/__tests__/fake-oidc-provider.ts

```text
25: const CLIENT_ID = 'sharkord-test-client';
26: const CLIENT_SECRET = 'sharkord-test-secret';
```

### apps/server/src/config.ts

```text
264: 'server.port': 'SHARKORD_PORT',
265: 'server.debug': 'SHARKORD_DEBUG',
266: 'server.autoupdate': 'SHARKORD_AUTOUPDATE',
267: 'server.backupDatabase': 'SHARKORD_BACKUP_DATABASE',
268: 'server.maxRequestBodyBytes': 'SHARKORD_MAX_REQUEST_BODY_BYTES',
269: 'server.allowedOrigins': 'SHARKORD_ALLOWED_ORIGINS',
270: 'server.trustedProxies': 'SHARKORD_TRUSTED_PROXIES',
271: 'oidc.enabled': 'SHARKORD_OIDC_ENABLED',
272: 'oidc.issuer': 'SHARKORD_OIDC_ISSUER',
273: 'oidc.clientId': 'SHARKORD_OIDC_CLIENT_ID',
274: 'oidc.clientSecret': 'SHARKORD_OIDC_CLIENT_SECRET',
275: 'oidc.redirectUri': 'SHARKORD_OIDC_REDIRECT_URI',
276: 'oidc.disableLocalLogin': 'SHARKORD_OIDC_DISABLE_LOCAL_LOGIN',
277: 'webRtc.port': 'SHARKORD_WEBRTC_PORT',
278: 'webRtc.announcedAddress': 'SHARKORD_WEBRTC_ANNOUNCED_ADDRESS',
279: 'webRtc.maxBitrate': 'SHARKORD_WEBRTC_MAX_BITRATE'
```

### apps/server/src/db/mutations/users.ts

```text
43: const username = name || `SharkordUser${randomNum}`;
```

### apps/server/src/db/seed.ts

```text
50: name: 'sharkord Server',
52: 'This is the default Sharkord server description. Change me in the server settings!',
152: name: 'Sharkord',
154: password: 'sharkord',
156: bio: 'Hey, I am Sharkord!',
164: content: '<p>Welcome to sharkord!</p>',
```

### apps/server/src/declarations.d.ts

```text
30: // SHARKORD_ prefixed environment variables
31: SHARKORD_PORT?: string;
32: SHARKORD_DEBUG?: string;
33: SHARKORD_AUTOUPDATE?: string;
34: SHARKORD_WEBRTC_PORT?: string;
35: SHARKORD_WEBRTC_ANNOUNCED_ADDRESS?: string;
36: SHARKORD_DATA_PATH?: string;
```

### apps/server/src/helpers/__tests__/apply-env-overrides.test.ts

```text
144: setEnv('SHARKORD_PORT_TEST', '5000');
145: setEnv('SHARKORD_DEBUG_TEST', 'false');
146: setEnv('SHARKORD_WEBRTC_PORT_TEST', '50000');
155: 'server.port': 'SHARKORD_PORT_TEST',
156: 'server.debug': 'SHARKORD_DEBUG_TEST',
157: 'mediasoup.webrtcPort': 'SHARKORD_WEBRTC_PORT_TEST',
158: 'mediasoup.announcedAddress': 'SHARKORD_ANNOUNCED_ADDRESS_TEST'
```

### apps/server/src/helpers/__tests__/downloads.test.ts

```text
73: outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sharkord-downloads-'));
```

### apps/server/src/helpers/get-ws-info.ts

```text
228: 'Requests are arriving from %s with forwarded headers, but that address is not in server.trustedProxies, so the headers are ignored and every client is rate limited as one. Add it to server.trustedProxies (or SHARKORD_TRUSTED_PROXIES) if it is your proxy.',
```

### apps/server/src/helpers/paths.ts

```text
6: SHARKORD_MEDIASOUP_BIN_NAME
15: const INJECTED_DATA_PATH = process.env.SHARKORD_DATA_PATH;
25: return path.join(getAppDataPath(), 'sharkord');
36: SHARKORD_MEDIASOUP_BIN_NAME || 'mediasoup-worker'
```

### apps/server/src/helpers/updater.ts

```text
19: repoOwner: 'Sharkord',
20: repoName: 'sharkord',
```

### apps/server/src/http/__tests__/healthz.test.ts

```text
36: expect(response.headers.get('X-Sharkord-Version')).toBe(SERVER_VERSION);
43: expect(response.headers.get('X-Sharkord-Version')).toBe(SERVER_VERSION);
54: expect(response.headers.get('X-Sharkord-Version')).toBe(SERVER_VERSION);
```

### apps/server/src/http/__tests__/login.test.ts

```text
79: expect(newUser?.name).toStartWith('SharkordUser');
```

### apps/server/src/http/index.ts

```text
113: res.setHeader('X-Sharkord-Version', SERVER_VERSION);
```

### apps/server/src/http/login.ts

```text
55: .hash('sharkord-dummy-password-for-timing')
```

### apps/server/src/http/oidc/__tests__/oidc.test.ts

```text
155: pathProvider = await startFakeOidcProvider('/application/o/sharkord');
209: `sharkord_oidc_state_${target.searchParams.get('state')}=1`
744: expect(created!.name).toStartWith('SharkordUser');
854: cookie: 'sharkord_oidc_state=not-the-right-state'
918: expect(setCookie).toContain('sharkord_oidc_state_');
939: expect(setCookie).toContain('sharkord_oidc_state_');
```

### apps/server/src/http/oidc/common.ts

```text
13: const OIDC_STATE_COOKIE_PREFIX = 'sharkord_oidc_state_';
```

### apps/server/src/index.ts

```text
35: chalk.green.bold('SHARKORD') + ' ' + chalk.white.bold(`v${SERVER_VERSION}`),
```

### apps/server/src/utils/__tests__/metrics.test.ts

```text
26: expect(result.sharkordUsedSpace).toBe(42);
```

### apps/server/src/utils/env.ts

```text
2: const SHARKORD_ENV = process.env.SHARKORD_ENV;
3: const SHARKORD_BUILD_VERSION = process.env.SHARKORD_BUILD_VERSION;
4: const SHARKORD_BUILD_DATE = process.env.SHARKORD_BUILD_DATE;
5: const SHARKORD_MEDIASOUP_BIN_NAME = process.env.SHARKORD_MEDIASOUP_BIN_NAME;
8: typeof SHARKORD_BUILD_VERSION !== 'undefined'
9: ? SHARKORD_BUILD_VERSION
13: typeof SHARKORD_BUILD_DATE !== 'undefined' ? SHARKORD_BUILD_DATE : 'dev';
15: const env = typeof SHARKORD_ENV !== 'undefined' ? SHARKORD_ENV : 'development';
22: if (!SHARKORD_MEDIASOUP_BIN_NAME) {
23: throw new Error('SHARKORD_MEDIASOUP_BIN is not defined');
34: SHARKORD_MEDIASOUP_BIN_NAME
```

### apps/server/src/utils/metrics.ts

```text
72: sharkordUsedSpace: filesUsedSpace
```

### docker-entrypoint.sh

```text
4: DATA_DIR="/home/bun/.config/sharkord"
10: exec /sharkord
31: exec su -s /bin/sh bun -c "exec /sharkord"
```

### docs/branding.md

```text
5: Desktop-facing titles and the About row identify SandShark as a Sharkord-compatible desktop client. References to Sharkord remain where they identify the independent server project, its protocol compatibility, or upstream attribution; SandShark does not present itself as the Sharkord server product.
```

### docs/deep-link-validation.md

```text
3: SandShark registers both `sandshark://` and the legacy `sharkord://` protocol on Windows. Incoming links are validated in Electron and again in the renderer before they can select a server profile or route to a channel.
11: `sharkord://` can be used in place of `sandshark://` for existing links. Server links are validated through the server's `/info` endpoint before being added or updated locally. The main process queues up to 16 valid links while the renderer starts, handles links passed to a second instance, and never permits the custom protocol to replace the SandShark renderer.
17: 3. Open `sharkord://server/<host>/channel/<id>` to verify the legacy scheme follows the same flow.
```

### docs/desktop-browser-api-audit.md

```text
35: | Browser URL handling | `helpers/get-file-url.ts`, connect invite query parameter | Requires a compatibility wrapper | The renderer must retain the selected Sharkord server origin while packaged UI loads from an app URL. Replace direct `window.location` server derivation with a desktop-aware server-origin helper in Phase 6. |
42: The web client assumes its own origin is the Sharkord server. Login is an HTTP POST to `${origin}/login`; the tRPC client opens `${wsProtocol}://${host}` and passes the session token in WebSocket connection parameters. A packaged Electron renderer cannot make that assumption, so Phase 6 must introduce an explicit active-server origin with both HTTP and WebSocket forms. The existing `getUrlFromServer()` and `getHostFromServer()` functions are the intended migration seam.
```

### docs/external-link-validation.md

```text
5: other external protocols. Validated `sandshark://` and legacy `sharkord://`
17: 4. Trigger a valid `sandshark://` or `sharkord://` URL and confirm the desktop
```

### docs/sandshark-phase-0.md

```text
9: - Upstream repository: https://github.com/Sharkord/sharkord
15: SandShark is maintained as a private repository with `Sharkord/sharkord` configured as the `upstream` remote. This keeps the project private while preserving a clean upstream baseline for future merges.
24: - Added `upstream` remote for `https://github.com/Sharkord/sharkord.git`.
27: - Installed Bun `1.3.14` locally for Sharkord development.
```

### docs/sandshark-versioning.md

```text
3: SandShark releases are versioned independently of the Sharkord workspace and server. The desktop package and bundled client always share the same SandShark version.
11: The root workspace version remains the Sharkord baseline version and is not changed for SandShark-only releases.
```

### docs/upstream-compatibility.md

```text
3: SandShark follows the upstream Sharkord client where possible. Desktop behavior
```

### docs/windows-installer.md

```text
5: The installer creates Start Menu and desktop shortcuts, registers both `sandshark://` and legacy `sharkord://` protocols, and preserves the Electron user-data directory on uninstall. SandShark's Windows startup preference is registered by the application itself through Electron's login-item API.
16: 2. Open a `sandshark://` and a `sharkord://` link after installation.
```

### package.json

```text
2: "name": "sharkord",
```

### packages/e2e/package.json

```text
18: "seed:e2e": "SHARKORD_DATA_PATH=./e2e-data bun run ./tests/setup/seed-db.ts"
```

### packages/e2e/playwright.config.ts

```text
40: SHARKORD_DATA_PATH: e2eDataPath
```

### packages/e2e/tests/auto-login.pw.ts

```text
45: localStorage.setItem('sharkord-auto-login', 'true');
62: localStorage.setItem('sharkord-auto-login', 'true');
63: localStorage.removeItem('sharkord-auto-login-token');
78: localStorage.setItem('sharkord-auto-login', 'false');
79: localStorage.setItem('sharkord-auto-login-token', 'some-token');
94: localStorage.setItem('sharkord-auto-login', 'true');
95: localStorage.setItem('sharkord-auto-login-token', 'invalid-token');
106: localStorage.getItem('sharkord-auto-login')
111: localStorage.getItem('sharkord-auto-login-token')
```

### packages/e2e/tests/connect.pw.ts

```text
10: const logo = page.getByAltText('Sharkord');
```

### packages/e2e/tests/fixtures/plugins/e2e-plugin/client/index.js

```text
3: const React = window.__SHARKORD_REACT__;
11: const { useCanUse } = window.__SHARKORD_STORE__.hooks;
85: const { data, loading, save } = window.__SHARKORD_STORE__.hooks.useUserData();
```

### packages/e2e/tests/fixtures/plugins/e2e-plugin/manifest.json

```text
4: "author": "Sharkord",
```

### packages/plugin-sdk/README.md

```text
1: # Sharkord Plugin SDK
3: For docs, see [docs](https://sharkord.com/docs/plugins/overview).
```

### packages/plugin-sdk/src/actions.ts

```text
25: 'createCallAction can only be used from plugin client code served by Sharkord.'
```

### packages/plugin-sdk/src/client.ts

```text
23: __SHARKORD_STORE__: TPluginStore;
27: const store = window.__SHARKORD_STORE__;
30: * Sharkord's own actions: sending a message, selecting a channel, fetching one
40: * const callAction = createCallAction<TSharkord>();
84: * Reads a slice of Sharkord's state and re-renders when it changes.
```

### packages/plugin-sdk/src/index.ts

```text
378: * type TSharkord = {
382: * const onLoad = (ctx: PluginContext<TSharkord>) => { ... };
819: type TSharkordState = ReturnType<TPluginStore['getState']>;
859: TSharkordState
```

### packages/shared/src/helpers/__tests__/message-sanitizer.test.ts

```text
246: '<p><span data-name="cool_doge" class="emoji-image" data-type="emoji"><img src="https://rc.sharkord.com/public/Cool%20Doge.gif" draggable="false" loading="lazy" align="absmiddle" alt="cool_doge emoji" /></span></p>';
292: const html = `<command data-plugin-id="sharkord-music-bot" data-plugin-logo="https://i.imgur.com/uVBNUK9.png" data-command="stop" data-args='[]' data-status='completed' data-response=''></command>`;
302: const html = `<p>Hello</p><command data-plugin-id="sharkord-music-bot" data-command="stop" data-args='[]' data-status='completed' data-response=''></command><p>World</p>`;
```

### packages/shared/src/plugins/client-sdk.ts

```text
31: * `window.__SHARKORD_STORE__.actions`.
76: * `window.__SHARKORD_STORE__`.
```

### packages/shared/src/plugins/components.ts

```text
70: * `window.__SHARKORD_REACT__` rather than bundling your own, or hooks will
```

### packages/shared/src/plugins/contract.ts

```text
17: * export type TSharkord = {
25: * The server reads it through `PluginContext<TSharkord>`, the client through
26: * `createCallAction<TSharkord>()`, `usePush<TSharkord>()` and
27: * `useUserData<TSharkord>()`.
```

### packages/shared/src/plugins/marketplace.ts

```text
5: //   'https://cdn.jsdelivr.net/gh/Sharkord/plugins@latest/plugins.json';
8: 'https://raw.githubusercontent.com/Sharkord/plugins/refs/heads/main/plugins.json?raw=true';
```

### packages/shared/src/statics/metrics.ts

```text
5: sharkordUsedSpace: number;
```

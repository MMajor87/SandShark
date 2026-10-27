# SandShark roadmap

Priorities are based on the reviewed integration backlog in [REFACTOR_PLAN.md](REFACTOR_PLAN.md).
They are not promised release dates. SandShark remains a small-group Windows desktop
client for compatible self-hosted servers.

## Release gates first

- Resolve the intermittent media-scroll browser test failure.
- Complete real two-participant voice/capture checks: reconnect, sleep/resume,
  permission loss, device removal and repeated capture startup/teardown.
- Verify clean hosted Windows builds, signing policy, installed updating/downloads,
  physical background PTT and real-provider SSO. Keep the reports' open gates visible.
- Validate the paired Phase 4 calendar client/server contract on the intended deployment.

## Implemented, awaiting the remaining live release checks

- Phase 1: private-file authorization and media-token refresh, capture permission
  revocation, control failure handling, native SDK and release safeguards.
- Phase 2: shared desktop bridge types, owned IPC, persistence, logging, updates,
  downloads, native input/audio and explicit main-process startup/teardown.
- Phase 3: capture resource ownership, cancellation guards, consolidated voice
  recovery and an explicit policy requiring camera/screen restart after recovery.
- Phase 4: calendar SQL visibility and bounded pagination, route separation,
  profile-switch regressions, dead-helper cleanup and protected artifact retention.

## Next focused improvements

1. Profile-image upload intent and authorization, including real image validation,
   ownership and size bounds; never weaken message attachment restrictions.
2. Push-to-mute using existing native input ownership, preserving prior mute state
   and respecting moderator mute, deafen, disconnect and rebinding.
3. Live device switching that releases the old device and preserves processing and
   mute state, with explicit handling for a failed replacement device.
4. Optional default mute for shared-stream audio, preserving explicit participant
   volume choices and distinguishing stream audio from voice.
5. Mixed-direction text support for Arabic/Persian, mentions, links and code blocks.
6. Review upstream account self-deletion work for reauthentication, owner protection,
   sessions, plugin side effects and calendar data ownership before adopting it.

## Follow upstream without duplicating large systems

Track upstream desktop and capture performance work against the existing platform
adapters. Integrate reviewed release commits, not a moving development branch.
Generated avatars are lower priority than reliability. Webhooks remain plugin-first.
P2P screen sharing and password-locked channels are deferred; mobile push is outside
this Windows desktop scope. See the issue links and acceptance criteria in the
refactor plan before starting one of these items.

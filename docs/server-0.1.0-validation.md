# SandShark Server 0.1.0 release verification

Verified on October 29, 2026. The release binary was built from
`c5547677ff8ac7eba94cf936c947742e2ee9434a`; the subsequent runner fix does not change
application code or the immutable server tag.

## Automated checks

- Local `bun run magic`, 2,228 tests, frozen-lockfile install, database migration
  consistency and desktop security checks passed during release preparation.
- [Server pipeline](https://github.com/MMajor87/SandShark/actions/runs/40804091685):
  repository CI, 54 browser tests (one existing mocked skip), four binary builds,
  container publication and draft asset upload passed.
- [Main CI](https://github.com/MMajor87/SandShark/actions/runs/40835646608) and
  [Windows desktop CI](https://github.com/MMajor87/SandShark/actions/runs/40835646630)
  passed for `6edde21460f40d305380a654c826f8fc62f235a7`.
- The uploaded asset sizes/digests match release.json. The downloaded Windows
  executable's SHA-256 was independently calculated before execution.

## Packaged runtime checks

The exact draft Windows executable ran with a new data directory and loopback-only
HTTP access. Two independent Chromium contexts authenticated as the seeded owner
and member. Tests used the executable's bundled client, real WebSockets, real
WebRTC transports and its embedded mediasoup worker, without mocked server routes.

Passed: calendar pages 1 and 2 retain earlier events; both users receive audio and
report nonzero decoded audio energy; mute/unmute; two screen-share start/stop cycles;
a separate camera producer with newly decoded remote frames; stopped video sender
tracks; server restart; automatic application reconnection without silent voice
rejoin; explicit rejoin restoring two-way audio with camera/screen off; disconnect.

The browser driver used Node 22.14.0 and Playwright 1.58.2. Chromium fake media devices
provided microphone/camera content and a generated canvas stream supplied screen
content. This verifies the media transport and lifecycle, not physical device or
OS capture. Synthetic media prevented access to the user's microphone or screen.

## Backup, migration and restore

A checksum-verified local 0.0.25 binary booted with disposable seeded data. Its full
data directory was copied while stopped. The downloaded 0.1.0 binary upgraded that
database through migration 0020. User identities, message content and calendar
entries remained identical. SQLite integrity and foreign-key checks were clean.
A second 0.1.0 startup made no further schema or data changes. Restoring the entire
backup into a separate directory allowed 0.0.25 to boot with the original data and
migration history. Existing deployments were not touched.

## Distribution and limits

Anonymous GHCR manifest retrieval succeeded for
`ghcr.io/mmajor87/sandshark-server:0.1.0`, including Linux amd64 and arm64 images.
Docker runtime testing was unavailable on this Windows host. Linux and macOS
binaries were built and checked against uploaded digests, but not executed locally.
Physical capture/application audio, hardware removal, WAN conditions and sleep/resume
remain outside this check. The broader desktop roadmap gates remain open.

Evidence and disposable harnesses are retained locally under
`.integration/server-release-verification/`, including `live-checks.log`,
`upgrade-checks.log`, `browser-checks.mjs`, `live-checks.ts`, `upgrade-checks.ts`,
and the timestamped upgrade directory's `verification.json`.

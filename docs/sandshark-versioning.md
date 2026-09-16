# SandShark versioning

SandShark releases are versioned independently of the Sharkord workspace and server. The desktop package and bundled client always share the same SandShark version.

The first independent SandShark release is `1.0.0`. Use Semantic Versioning for subsequent releases:

- Patch releases (`1.0.1`) for fixes and small compatibility changes.
- Minor releases (`1.1.0`) for backward-compatible features.
- Major releases (`2.0.0`) for intentionally breaking desktop-client changes.

The root workspace version remains the Sharkord baseline version and is not changed for SandShark-only releases.

## Update sources

Both the desktop updater and the bundled server updater target `MMajor87/SandShark`.
They use different metadata: desktop updates use `latest.yml` and the Windows
installer, while server updates require `release.json` and matching server binaries.
The server version comes from that manifest, not the desktop release tag.

The server updater currently reads GitHub's latest release endpoint. A desktop-only
latest release cannot supply a server update, even if an older server release exists.
Before enabling server updates for this fork, provide compatible server metadata and
artifacts on the latest release or implement separate release selection for the server.
The existing server release workflow produces these assets; the desktop workflow does not.
On September 16, 2026, the latest published release (`sandshark-v1.0.30`) contained
desktop assets only. No release assets were published or changed as part of switching
the update source.

### Generate server release metadata

Run `bun run --cwd apps/server build` from the repository root. This builds the
client and four server binaries, then writes `apps/server/build/out/release.json`
with the root package version, build timestamp, artifact names, targets, byte sizes,
and SHA-256 checksums. The generated manifest is validated by the updater library.
Do not hand-edit checksums or use the desktop version for this manifest.

Upload the manifest and all four binaries from that output directory together to
the intended GitHub release. Keep their filenames identical to the manifest entries.
The binaries currently retain their `sharkord-*` filenames for compatibility with
the existing server build and release workflow. Generated output is not committed.

On September 16, 2026, a local server build generated version `0.0.25` metadata for
Linux x64/arm64, Windows x64, and macOS arm64. All four file sizes and SHA-256 hashes
were independently verified against the manifest. These assets have not been published.
Servers already running `0.0.25` will need a higher server version before an update
is offered.

## Desktop releases

To prepare a SandShark release, update the matching `version` fields in `apps/client/package.json` and `apps/desktop/package.json`, then create and push a matching tag:

```powershell
git tag sandshark-v<version>
git push origin sandshark-v<version>
```

The tag release workflow validates the package versions, runs the full repository checks, builds the Windows installer, smoke-launches the unpacked app, verifies the installer signature when signing secrets are configured, and then creates a draft GitHub release.

Unsigned Windows releases are temporarily allowed while SandShark's signing certificate is pending. Until `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are configured, the workflow marks draft releases as unsigned prereleases and skips signature verification.

For local packaging without publishing:

```powershell
bun run --cwd apps/desktop package
bun run --cwd apps/desktop test:packaged-startup
```

The local output is `apps/desktop/release/SandShark-<version>-Setup-x64.exe`.

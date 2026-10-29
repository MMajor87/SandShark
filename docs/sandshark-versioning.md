# SandShark versioning

Desktop and server releases share this repository but have independent versions.

| Product | Version source | Tag | Update metadata |
| --- | --- | --- | --- |
| Desktop | `apps/desktop/package.json` and `apps/client/package.json` | `sandshark-v<version>` | `latest.yml` |
| Server | `apps/server/package.json` | `sandshark-server-v<version>` | `release.json` |

Use semantic versions for each product. The root workspace version records the
upstream Sharkord baseline; shared packages and the plugin SDK keep their own
versions. A server version bump changes only the server package.

## Update sources

Both products use `MMajor87/SandShark`. New desktop builds select the most recent
published stable `sandshark-v*` release and pass its download directory to Electron
Updater. Server builds select stable `sandshark-server-v*` releases and verify that
the manifest version matches the tag. Both searches paginate, ignore drafts and
prereleases, and stop after 1,000 releases with an error rather than selecting the
other product. A selected release with missing metadata fails instead of silently
falling back to an older build.

Server release selection uses a small committed Bun patch to
`bun-sfe-autoupdater@0.0.4`. Its existing architecture checks, SHA-256 verification
and binary installer are retained. Revalidate the patch and updater tests when
upgrading that dependency; `bun install --frozen-lockfile` applies the patch in CI.

Desktop releases explicitly set GitHub's Latest flag. Server releases explicitly
leave it unset, including when a maintainer publishes a draft. This also protects
older installed desktop clients that still use the repository-wide latest endpoint.
Previously installed servers using that endpoint require a one-time manual upgrade.
The new desktop selection code takes effect when the next desktop build is shipped.

## Server releases

The first independent server version is `0.1.0`, based on Sharkord `0.0.28`.
Prepare a new server version from the repository root:

```powershell
bun apps/server/build/set-version.ts --version <version>
bun install --lockfile-only
bun run magic
bun run test
```

Update `apps/server/RELEASE_NOTES.md`, commit the server package, lockfile and notes,
then tag the reviewed commit:

```powershell
git tag sandshark-server-v<version>
git push origin sandshark-server-v<version>
```

The server release workflow resolves the tag to a commit once, runs repository and
E2E checks against that commit, and builds all four server binaries plus the bundled
web client. It generates `release.json`, `SHA256SUMS.txt` and `BUILD_COMMIT.txt`.
It publishes a versioned Linux x64/arm64 image to
`ghcr.io/mmajor87/sandshark-server:<version>` using GitHub Actions credentials, then
creates a GitHub release draft. No Docker Hub credentials are required. Configure
the GHCR package visibility as public if anonymous container pulls are intended.

Review the draft's compatibility notes and complete its deployment checks before
publishing. Leave **Set as latest release** disabled. The workflow does not push a
container `latest` tag. The manually dispatched development image workflow publishes
`ghcr.io/mmajor87/sandshark-server:dev` separately.

For a local build, run `bun run --cwd apps/server build`. Outputs live in
`apps/server/build/out`; generated binaries are not committed. The server manifest
uses the server package version, never the desktop or root workspace version.
The retained `sharkord-*` filenames support existing installation scripts.

## Desktop releases

Update matching versions in `apps/client/package.json` and
`apps/desktop/package.json`, refresh the lockfile, and update desktop release notes.
Commit before tagging:

```powershell
git tag sandshark-v<version>
git push origin sandshark-v<version>
```

The desktop workflow checks the resolved commit, validates package versions, builds
the Windows installer, generates checksums, and publishes a stable desktop release
with `latest.yml`. It currently publishes unsigned installers; deployment checks
remain documented in the roadmap.

For local packaging without publishing:

```powershell
bun run --cwd apps/desktop package
bun run --cwd apps/desktop test:packaged-startup
```

## Client/server compatibility

Server 0.1.0 pairs with Desktop 1.1.2 from phase four or a subsequent compatible
release. Calendar pagination changes `calendar.getAll` from an array to
`{ events, nextCursor }`, so update older clients and servers together. Future
release notes must state supported client/server versions and migration requirements.
Independent version numbers do not imply protocol compatibility.

# SandShark versioning

SandShark releases are versioned independently of the Sharkord workspace and server. The desktop package and bundled client always share the same SandShark version.

The first independent SandShark release is `1.0.0`. Use Semantic Versioning for subsequent releases:

- Patch releases (`1.0.1`) for fixes and small compatibility changes.
- Minor releases (`1.1.0`) for backward-compatible features.
- Major releases (`2.0.0`) for intentionally breaking desktop-client changes.

The root workspace version remains the Sharkord baseline version and is not changed for SandShark-only releases.

To prepare a SandShark release, update the matching `version` fields in `apps/client/package.json` and `apps/desktop/package.json`, then create and push a matching tag:

```powershell
git tag sandshark-v<version>
git push origin sandshark-v<version>
```

The tag release workflow validates the package versions, runs the full repository checks, builds the Windows installer, smoke-launches the unpacked app, verifies the installer signature, and then creates a draft GitHub release.

Windows releases require the `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` repository secrets. The release workflow fails before packaging if those signing secrets are missing, so unsigned SandShark installers are not produced by the release pipeline.

For local packaging without publishing:

```powershell
bun run --cwd apps/desktop package
bun run --cwd apps/desktop test:packaged-startup
```

The local output is `apps/desktop/release/SandShark-<version>-Setup-x64.exe`.

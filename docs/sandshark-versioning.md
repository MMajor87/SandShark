# SandShark versioning

SandShark releases are versioned independently of the Sharkord workspace and server. The desktop package and bundled client always share the same SandShark version.

The first independent SandShark release is `1.0.0`. Use Semantic Versioning for subsequent releases:

- Patch releases (`1.0.1`) for fixes and small compatibility changes.
- Minor releases (`1.1.0`) for backward-compatible features.
- Major releases (`2.0.0`) for intentionally breaking desktop-client changes.

The root workspace version remains the Sharkord baseline version and is not changed for SandShark-only releases.

To make a SandShark release, update the matching `version` fields in `apps/client/package.json` and `apps/desktop/package.json`, then build the Windows installer:

```powershell
bun run --cwd apps/desktop package
```

The output is `apps/desktop/release/SandShark-<version>-Setup-x64.exe`.

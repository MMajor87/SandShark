# SandShark Windows Code Signing

SandShark signs both the Windows application executable and NSIS installer through `electron-builder` when a signing identity is supplied. The signing workflow verifies the finished installer and fails before it can upload an unsigned artifact.

## Certificate

Use a Microsoft Authenticode code-signing certificate issued to the SandShark publisher. An organization-validated certificate is suitable for this workflow; EV certificates can improve SmartScreen reputation but commonly require hardware-backed signing instead of the PFX-based CI path.

Keep the certificate and its password outside the repository. Do not add `.pfx`, `.p12`, or certificate passwords to source control.

## Local verification

After packaging, verify an installer with:

```powershell
bun run --cwd apps/desktop verify:signature -- -Path apps/desktop/release/SandShark-<version>-Setup-x64.exe
```

The command fails unless Windows reports a valid Authenticode signature.

## GitHub Actions secrets

The `Sign SandShark Desktop` workflow requires these repository secrets:

- `WIN_CSC_LINK`: Base64-encoded `.pfx` certificate data.
- `WIN_CSC_KEY_PASSWORD`: Password for that certificate.

Create the first secret from PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('SandShark-signing.pfx'))
```

The workflow uses `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, which `electron-builder` reads directly. It builds the installer, verifies its signature, and uploads the signed artifact. Until those secrets contain a valid certificate, the verification step intentionally fails and no artifact is uploaded.

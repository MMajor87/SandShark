# SandShark

SandShark is a Windows desktop client for compatible Sharkord servers, built with Electron and the upstream React/TypeScript frontend.

The desktop app includes native notifications, tray controls, push-to-talk, Windows startup options, saved server profiles, screen sharing, application audio capture, and installer/update support. This repository also contains the upstream server, shared packages, and plugin SDK used by the client.

## Local development

Install dependencies from the repository root:

```powershell
bun install
bun run desktop:dev
```

Connect to a compatible server using the desktop server picker. For native Windows capture functionality, build the helper first with `bun run --cwd apps/desktop native:build`; this requires the .NET SDK. The normal packaging command builds it automatically.

## Build and test

```powershell
bun run magic
bun run test
bun run --cwd apps/desktop package
bun run --cwd apps/desktop test:packaged-startup
```

Installers are written to `apps/desktop/release/`. See the [Windows installer guide](docs/windows-installer.md) for installation checks and [versioning policy](docs/sandshark-versioning.md) for release details.

## Project references

- [Branding checklist](docs/sandshark-branding-todo.md)
- [Branding audit](docs/sandshark-branding-audit.md) and [reference inventory](docs/sharkord-reference-inventory.md)
- [Upstream compatibility and integration guide](docs/upstream-compatibility.md)
- [Contribution guide](CONTRIBUTING.md) and [roadmap](ROADMAP.md)

Report SandShark-specific problems in this repository's issue tracker, including the desktop version and steps to reproduce. Remove credentials and private server addresses from shared logs.

## Upstream

SandShark builds on [Sharkord](https://github.com/Sharkord/sharkord). Upstream attribution is retained in [LICENSE](LICENSE), and server/plugin compatibility identifiers are preserved where needed. Desktop releases are versioned independently of the upstream server.

The [SandShark repository](https://github.com/MMajor87/SandShark) and [issue tracker](https://github.com/MMajor87/SandShark/issues) are public. Keep private server details and credentials out of reports.

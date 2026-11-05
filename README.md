# SandShark

SandShark is a Windows desktop client and self-hosted server for small-group voice and text communication.

The desktop app provides notifications, tray controls, push-to-talk, saved server profiles, screen sharing, application audio capture, and Windows installer and update support. This repository also contains the web client, shared packages, and plugin SDK.

## Get SandShark

| Product | Current release | Install option |
| --- | --- | --- |
| Windows desktop | [SandShark 1.4.0](https://github.com/MMajor87/SandShark/releases/tag/sandshark-v1.4.0) | Download the Windows setup executable from the release. |
| Server | [SandShark Server 0.5.0](https://github.com/MMajor87/SandShark/releases/tag/sandshark-server-v0.5.0) | Download a Linux x64/arm64, Windows x64, or macOS arm64 binary, or use the Docker image below. |

Desktop and server versions advance independently. Server 0.5.0 pairs with Desktop 1.4.0; upgrade the server first. The [server release notes](apps/server/RELEASE_NOTES.md) cover compatibility, upgrades, and verification.

### Install the server with Docker

The Server 0.5.0 release includes a public Linux amd64/arm64 image at `ghcr.io/mmajor87/sandshark-server:0.5.0`. Docker pulls the image for your machine's architecture.

```sh
docker volume create sandshark-data
docker run -d --name sandshark-server --restart unless-stopped -p 4991:4991/tcp -p 40000:40000/udp -e SANDSHARK_HOST=0.0.0.0 -e SANDSHARK_WEBRTC_ANNOUNCED_ADDRESS=YOUR_PUBLIC_IP_OR_HOSTNAME -v sandshark-data:/home/bun/.config/sandshark ghcr.io/mmajor87/sandshark-server:0.5.0
```

Replace `YOUR_PUBLIC_IP_OR_HOSTNAME` with the address clients use to reach the server. Open TCP 4991 for the app and UDP 40000 for voice on the host and firewall. The named volume keeps the database, uploads, configuration, plugins, and other server data when the container is replaced. Connect the desktop client to `http://YOUR_PUBLIC_IP_OR_HOSTNAME:4991` or your configured HTTPS address. Back up the whole data volume before upgrading; database migrations run at startup. There is no moving `latest` image tag, so pin the version you deploy.

For binary installs and release procedures, see [versioning and deployment](docs/sandshark-versioning.md).

## Local development

Install dependencies from the repository root with [Bun](https://bun.sh/):

```powershell
bun install
bun run desktop:dev
```

For server development, run `bun run --cwd apps/server dev` in another terminal. Connect through the desktop server picker. Native Windows application audio capture needs the .NET SDK and `bun run --cwd apps/desktop native:build`; desktop packaging builds the helper automatically.

## Build and test

```powershell
bun run magic
bun run test
bun run --cwd apps/server build
bun run --cwd apps/desktop package
bun run --cwd apps/desktop test:packaged-startup
```

Server binaries are written to `apps/server/build/out/`; Windows installers are written to `apps/desktop/release/`. See the [Windows installer guide](docs/windows-installer.md) and [versioning policy](docs/sandshark-versioning.md).

## Project information

- [Contribution guide](CONTRIBUTING.md), [development guide](DEVELOPMENT.md), and [roadmap](ROADMAP.md)
- [Server 0.1.0 release verification](docs/server-0.1.0-validation.md)
- [Bots](docs/bots.md): connecting discord.js and discord.py bots to a SandShark server
- [License](LICENSE). SandShark began as a fork of an MIT licensed project, whose copyright notice the license requires us to keep.

Report SandShark problems in the [issue tracker](https://github.com/MMajor87/SandShark/issues). Include the desktop and server versions and reproduction steps, and remove credentials and private server addresses from logs.

If you like what I am doing and get some use from it, feel free to add to my caffeine fund on Ko-Fi.
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/N3T82A0RF0)

# Windows server install

Each server release includes `sandshark-server-<version>-setup-x64.exe`. It installs the server as a Windows service, so the server starts with the computer, keeps running when nobody is signed in, and is restarted if it crashes. There is no terminal to keep open and no Docker. It needs 64-bit Windows and an administrator to install.

## What the installer does

- Installs the service, named **SandShark Server**. It runs as the built-in LocalService account rather than as an administrator or SYSTEM, since hosted bots and plugins run with the server's rights.
- Puts the service wrapper ([WinSW](https://github.com/winsw/winsw)) and its settings under `C:\Program Files\SandShark Server`, where only administrators can change them.
- Puts the server and its data under `C:\ProgramData\SandShark Server`:
  - `bin` holds the server itself. The service can write here, so the server can update itself.
  - `data` holds the database, uploads, `config.ini`, plugins and hosted bots.
  - `logs` holds the service's record of the server's console output. The server's own logs are in `data\logs`.

  Only SYSTEM, administrators and the service can open this folder, since it holds the database.
- Optionally, enabled by default, adds Windows Firewall rules for TCP 4991 (the app) and UDP 40000 (voice).
- Adds a **SandShark Server** folder to the Start Menu with these shortcuts:
  - **Server Monitor** opens the [status page](server-monitor.md) at `http://localhost:4991/monitor`.
  - **Start Server**, **Stop Server** and **Restart Server** control the service, after an administrator prompt.
  - **Server Data** opens the data folder.
  - **SandShark Server Tray** shows the tray icon.
- Optionally, enabled by default, starts the tray icon whenever someone signs in.

The service can also be managed from Services (`services.msc`) or with `sc query SandSharkServer`.

## Tray icon

The tray icon shows the server's version and how many people are online and in voice. It switches to a warning icon when the server stops answering. Double-click it to open the monitor. Right-click it to open the monitor or the data folder, to start, stop or restart the server (after an administrator prompt), or to exit.

The icon runs as the signed-in user, not as an administrator. It only reads the server's local status endpoint, checking every 10 seconds. It assumes port 4991. After changing the port, edit the shortcut so it ends with `-Port <port>`.

## Configuration

The server writes `C:\ProgramData\SandShark Server\data\config.ini` on first start. Edit it in an editor run as administrator, since the folder is closed to other accounts, then use **Restart Server**. If you change the port, the Server Monitor shortcut and the firewall rule still point at 4991. Open `http://localhost:<port>/monitor` yourself, and add a firewall rule for the new port.

Voice needs the address clients reach the server at. By default the server looks up its public IP address, which suits a server that people reach over the internet. If everyone connects over the local network, or the server sits behind an address the lookup doesn't see, set it under `[webRtc]`, for example `announcedAddress = 192.168.1.20`, then restart. Text chat works either way; only voice fails with the wrong address.

## Updates

The server updates itself from GitHub when an owner chooses **Update Server** under Server settings, Updates, or every hour with `autoupdate` turned on. The service restarts it on the new version.

You can also install a newer setup over the existing one. It keeps the data, the firewall choice and the install folder.

Don't install an older setup over a newer server. It replaces the server with the older one, and the older server can't read a database that a newer one has already migrated.

## Uninstall

Uninstall **SandShark Server** from Settings, Apps. The uninstaller:

- stops and removes the service and the firewall rules;
- asks whether to delete the data too. The default is to keep it, and a silent uninstall (`uninstall.exe /S`) always keeps it.

## Building the installer

CI builds the installer on Linux with NSIS, after the server build:

```sh
sudo apt-get install nsis
bun run --cwd apps/server build
bun run --cwd apps/server build:windows-installer
```

It downloads WinSW 2.12.0 and checks it against a pinned SHA-256. Set `MAKENSIS` to use a `makensis` that isn't on the `PATH`, for example on Windows.

# Linux server install

Each server release includes `sandshark-install-linux.sh`. It installs that release as a systemd service, so the server starts at boot, keeps running without a terminal, and is restarted if it crashes. It works on x64 and arm64 machines with systemd, which covers Debian, Ubuntu, Fedora, RHEL and most other distributions. On a machine without systemd, use the [Docker image](../README.md) or run the binary yourself.

```sh
curl -fsSL https://github.com/MMajor87/SandShark/releases/download/sandshark-server-v<version>/sandshark-install-linux.sh | sudo sh
```

To read the script before running it, download it first and run it with `sudo sh sandshark-install-linux.sh`.

## What the script does

- Downloads the release's binary for this machine and checks it against the release's `SHA256SUMS.txt`. Use `--binary <path>` to install a binary you already have instead.
- Creates a `sandshark` system user, which has no login shell.
- Installs the server to `/opt/sandshark/sandshark`. The folder belongs to the service user, so the server can update itself.
- Keeps the data in `/var/lib/sandshark`: the database, uploads, `config.ini`, plugins, hosted bots and logs. Only the service user can open it.
- Installs, enables and starts `sandshark.service`, which:
  - restarts the server whenever it exits;
  - runs it with `NoNewPrivileges`, a private `/tmp`, a read-only system (`ProtectSystem=strict`) and no access to home folders. The server can write only to its own two folders.

Running the script again installs that release over the existing one and keeps the data.

## Running it

| Task | Command |
| --- | --- |
| Status | `systemctl status sandshark` |
| Live log | `journalctl -u sandshark -f` |
| Restart | `sudo systemctl restart sandshark` |
| Stop, start | `sudo systemctl stop sandshark`, `sudo systemctl start sandshark` |

Open TCP 4991 for the app and UDP 40000 for voice in the firewall, for example with `sudo ufw allow 4991/tcp && sudo ufw allow 40000/udp`.

The server writes `/var/lib/sandshark/config.ini` on first start. Edit it, then restart the service.

Voice needs the address clients reach the server at. By default the server looks up its public IP address, which suits a server that people reach over the internet. If everyone connects over the local network, or the server sits behind an address the lookup doesn't see, set it under `[webRtc]`, for example `announcedAddress = 192.168.1.20`, then restart. Text chat works either way; only voice fails with the wrong address.

## Monitoring

The [status page](server-monitor.md) is served to the machine itself at `http://localhost:4991/monitor`. On a machine without a browser, tunnel it with `ssh -L 4991:localhost:4991 <this machine>`, then open the same address on your own computer. Scripts and monitoring tools on the machine can read `/monitor/status`.

## Updates

The server updates itself from GitHub when an owner chooses **Update Server** under Server settings, Updates, or every hour when `autoupdate` is turned on. It downloads the new binary, checks it against the release's checksum, replaces its own file, and exits. systemd then starts the new version.

You can also run a newer release's script. Don't run an older release's script over a newer server. It installs the older server, which can't read a database that a newer one has already migrated.

## Hosted bots

Hosted bots run as the `sandshark` user under the same restrictions. Python and Node.js have to be installed system wide, for example from the distribution's packages, since the service can't see anything installed under a home folder.

## Uninstall

```sh
sudo sh sandshark-install-linux.sh --uninstall
```

This removes the service and `/opt/sandshark`, and keeps the data and the `sandshark` user. Add `--purge` to delete both as well.

# Server monitor

The server serves a status page at `/monitor` to the machine it runs on. Open `http://localhost:4991/monitor` on that machine, using your port if you changed it. The page refreshes every few seconds and shows:

- whether the server is responding, its version and uptime, and whether a newer server release is out;
- the server's memory use and its share of one CPU core;
- who is connected, the active voice channels and how many people are in each, and the hosted bots and their status;
- the last lines of the server log.

The page has no login, so it is only served to the machine itself. Every other request gets the same "not found" as any unknown path. That includes:

- requests from another machine;
- requests a reverse proxy forwarded, even one on the same machine;
- requests for a host name other than `localhost`, `127.0.0.1` or `[::1]`;
- requests made by a page from another site in a browser on that machine.

To look at it from elsewhere, use a tunnel to the machine, such as `ssh -L 4991:localhost:4991 your-server`, and open the same address locally.

The page doesn't need any setup. Set `SANDSHARK_MONITOR=false`, or `monitor = false` under `[server]` in `config.ini`, to turn it off.

It reads three JSON endpoints, which scripts and monitoring tools on the same machine can use too. They have the same local-only rules:

| Endpoint | Returns |
| --- | --- |
| `/monitor/status` | version, start time, memory and CPU, online users, voice channels and hosted bots |
| `/monitor/log` | the last 300 lines of the server log |
| `/monitor/update` | the running and latest versions, and whether an update is waiting; this one calls GitHub, so don't poll it |

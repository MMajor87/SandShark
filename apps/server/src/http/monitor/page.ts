import type http from 'http';
import { guardMonitor } from './common';

// a plain page, so it works on a machine with no client build, and so a monitor that someone
// keeps open is not another copy of the app. every value from the server is set with
// textContent: user, channel and bot names are user input
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SandShark Server</title>
<style>
:root { color-scheme: light dark; --bg: #f6f7f9; --card: #fff; --text: #16181d; --muted: #5d6470; --line: #dde1e7; --ok: #1a7f37; --warn: #9a6700; --bad: #cf222e; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f1115; --card: #171a21; --text: #e6e8eb; --muted: #9aa3ae; --line: #2a2f3a; --ok: #3fb950; --warn: #d29922; --bad: #f85149; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 20px 16px 40px; display: grid; gap: 16px; }
header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 16px; }
h1 { font-size: 20px; margin: 0; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 0 0 8px; }
.muted { color: var(--muted); }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; min-width: 0; }
.stat { font-size: 22px; font-variant-numeric: tabular-nums; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-top: 1px solid var(--line); overflow-wrap: anywhere; }
li:first-child { border-top: 0; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; background: var(--muted); }
.ok { color: var(--ok); } .ok .dot, .dot.ok { background: var(--ok); }
.warn { color: var(--warn); } .bad { color: var(--bad); }
pre { margin: 0; max-height: 420px; overflow: auto; font: 12px/1.5 ui-monospace, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
  <header>
    <h1><span id="state" class="dot"></span>SandShark Server</h1>
    <span id="version" class="muted"></span>
    <span id="uptime" class="muted"></span>
    <span id="update" class="muted"></span>
  </header>
  <div class="grid">
    <section class="card"><h2>Memory</h2><div id="memory" class="stat">-</div></section>
    <section class="card"><h2>CPU</h2><div id="cpu" class="stat">-</div><div class="muted">share of one core</div></section>
    <section class="card"><h2>Online</h2><div id="online-count" class="stat">-</div></section>
    <section class="card"><h2>In voice</h2><div id="voice-count" class="stat">-</div></section>
  </div>
  <div class="grid">
    <section class="card"><h2>Online users</h2><ul id="users"></ul></section>
    <section class="card"><h2>Voice channels</h2><ul id="voice"></ul></section>
    <section class="card"><h2>Hosted bots</h2><ul id="bots"></ul></section>
  </div>
  <section class="card"><h2>Log</h2><pre id="log"></pre></section>
</main>
<script>
var POLL_MS = 3000;
var startedAt = null;

var byId = function (id) { return document.getElementById(id); };

var formatBytes = function (bytes) {
  var units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes;
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return value.toFixed(unit === 0 ? 0 : 1) + ' ' + units[unit];
};

var formatUptime = function (ms) {
  var minutes = Math.floor(ms / 60000);
  var days = Math.floor(minutes / 1440);
  var hours = Math.floor((minutes % 1440) / 60);
  var parts = [];
  if (days) parts.push(days + 'd');
  if (days || hours) parts.push(hours + 'h');
  parts.push((minutes % 60) + 'm');
  return 'up ' + parts.join(' ');
};

var fillList = function (id, items, render, empty) {
  var list = byId(id);
  list.replaceChildren();
  if (items.length === 0) {
    var none = document.createElement('li');
    none.className = 'muted';
    none.textContent = empty;
    list.append(none);
    return;
  }
  items.forEach(function (item) {
    var row = document.createElement('li');
    var cells = render(item);
    cells.forEach(function (cell) { row.append(cell); });
    list.append(row);
  });
};

var text = function (value, className) {
  var span = document.createElement('span');
  span.textContent = value;
  if (className) span.className = className;
  return span;
};

var BOT_CLASSES = { running: 'ok', starting: 'warn', installing: 'warn', crashed: 'bad' };

var setDown = function () {
  byId('state').className = 'dot bad';
  byId('uptime').textContent = 'not responding';
};

var showStatus = function (status) {
  startedAt = status.startedAt;
  byId('state').className = 'dot ok';
  byId('version').textContent = 'version ' + status.version;
  byId('uptime').textContent = formatUptime(Date.now() - startedAt);
  byId('memory').textContent = formatBytes(status.memoryBytes);
  byId('cpu').textContent = status.cpuPercent === null ? '-' : status.cpuPercent + '%';
  byId('online-count').textContent = status.onlineUsers.length;
  byId('voice-count').textContent = status.voiceChannels.reduce(function (sum, channel) { return sum + channel.userCount; }, 0);
  fillList('users', status.onlineUsers, function (user) { return [text(user.name)]; }, 'Nobody is connected');
  fillList('voice', status.voiceChannels, function (channel) {
    return [text(channel.name), text(channel.userCount + (channel.userCount === 1 ? ' user' : ' users'), 'muted')];
  }, 'No active voice channels');
  fillList('bots', status.hostedBots, function (bot) {
    return [text(bot.name), text(bot.status, BOT_CLASSES[bot.status] || 'muted')];
  }, 'No hosted bots');
};

var showLog = function (lines) {
  var log = byId('log');
  var atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24;
  log.textContent = lines.join('\\n');
  if (atBottom) log.scrollTop = log.scrollHeight;
};

var getJson = function (path) {
  return fetch(path, { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  });
};

var poll = function () {
  Promise.all([getJson('/monitor/status'), getJson('/monitor/log')])
    .then(function (results) { showStatus(results[0]); showLog(results[1].lines); })
    .catch(setDown)
    .finally(function () { setTimeout(poll, POLL_MS); });
};

getJson('/monitor/update')
  .then(function (update) {
    var element = byId('update');
    if (update.latestVersion === null) { element.textContent = 'could not check for updates'; return; }
    element.textContent = update.hasUpdate ? 'update ' + update.latestVersion + ' available' : 'up to date';
    element.className = update.hasUpdate ? 'warn' : 'muted';
  })
  .catch(function () { byId('update').textContent = 'could not check for updates'; });

poll();
</script>
</body>
</html>
`;

const monitorPageRouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  if (!guardMonitor(req, res)) return;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'"
  });
  res.end(PAGE);
};

export { monitorPageRouteHandler };

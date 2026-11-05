# Bots

SandShark speaks enough of Discord's bot API (REST v10 and the Gateway) that a bot written with discord.js or discord.py can run against a SandShark server with a configuration change and no code changes. This page covers creating a bot, pointing the two libraries at your server, and exactly what is and isn't supported.

## Create a bot

1. Open **Server settings → Bots**. You need the **Manage bots** permission, which only the owner role has by default.
2. Choose **Create bot** and give it a name.
3. Copy the token from the dialog. **It is shown once.** The server only keeps a hash of it. If you lose it, use **Reset token**, which stops the old token right away and disconnects the bot.
4. Give the bot roles from the **Users** tab, the same way you would for a member. A new bot starts with the default role, so it can do what a new member can do and nothing more. For example, members can't add reactions by default, so a bot that reacts needs a role that allows it.

A bot is a member with a **Bot** badge. It can't sign in through the login page, and deleting it keeps its messages under the deleted-user placeholder.

## Connect discord.js

Point the REST client at your server. discord.js asks the server where the gateway is, so nothing else changes:

```js
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  rest: { api: 'https://chat.example.com/api' }
});

client.login(process.env.SANDSHARK_BOT_TOKEN);
```

Use your server's address in place of `chat.example.com`. Keep it as `/api`; discord.js adds the `/v10` itself.

## Connect discord.py

discord.py needs **both** addresses changed. Unlike discord.js, it doesn't ask the server where the gateway is: it connects to Discord's own gateway address, which is built into the library.

> **Warning:** if you only change the REST address, discord.py sends your bot token to Discord's gateway. Discord rejects it, but the token has left your server. Set both lines before `client.run`.

```python
import discord
import yarl
from discord import http as discord_http
from discord.gateway import DiscordWebSocket

discord_http.Route.BASE = "https://chat.example.com/api/v10"
DiscordWebSocket.DEFAULT_GATEWAY = yarl.URL("wss://chat.example.com/api/v10/gateway")

intents = discord.Intents.default()
intents.message_content = True

client = discord.Client(intents=intents)
client.run(token)
```

Use `http://` and `ws://` instead if your server doesn't use TLS.

## Other libraries

Any library that lets you set the REST base URL can work. It should either read the gateway address from `GET /api/v10/gateway/bot`, or let you set the gateway address to `wss://<your server>/api/v10/gateway`. Check that it doesn't fall back to Discord's address, for the reason in the warning above.

## Run it on the server

Instead of running the bot on another machine, you can give its code to SandShark, which runs it, restarts it when it crashes, and shows its log. Use this when the bot is written for Discord and you don't want to change a line of it.

1. In **Server settings → Bots**, turn on **Run bots on this server**. This needs the **Host bots** permission, which only the owner role has by default.
2. Open a bot's **Hosting** panel and give it its code: either **Upload zip** with the bot's folder, or a public **GitHub repository**, with an optional branch, tag or commit, then **Update from GitHub**.
3. Add the variables the bot reads, such as API keys, under **Variables**. Values are stored on the server and never shown again.
4. Choose **Start**.

To try hosting before you have a bot of your own, choose **Start from a ping bot** in step 2. It writes a small discord.js bot into the bot's folder, with a `/ping` command that answers "Pong!", and installs discord.js, which needs the server to reach npm. The files are the bot's own from then on: change them and upload them again like any code. The button is only offered while the bot has no code.

What the server does for a hosted bot:

- **Points it at this server.** Before the bot's own code runs, a small shim moves `https://discord.com/api` to this server's API and `gateway.discord.gg` to this server's gateway. A bot that calls `client.login()` or `client.run(token)` works unchanged.
- **Blocks Discord itself.** Every other connection to a Discord host is refused, so the bot's token can't be sent to Discord, even by a library the shim doesn't know about. Other addresses are left alone, so weather, AI and game APIs keep working.
- **Gives it a token.** A fresh token is made on every start and given as `DISCORD_TOKEN`, `TOKEN` and `BOT_TOKEN`, plus any names you add under **Extra token variables**. Starting a hosted bot ends any copy of it running elsewhere.
- **Gives it nothing else of the server's.** The bot runs from its own folder with a clean environment: its token, your variables, and the few system variables a program needs to run.
- **Runs the right file.** It picks the file a `start` script such as `node bot.js` runs, then `main` in `package.json`, then `index.js` or `index.ts`. TypeScript runs without a build step. A folder with none of those is run as a Python bot from `main.py`, or else `bot.py`.
- **Installs dependencies.** Dependencies are installed after every upload or update, and on **Install dependencies**: `package.json` with Bun, and `requirements.txt` (or else `pyproject.toml`) with pip into a `.venv` in the bot's folder. The install doesn't see the token or your variables.
- **Keeps the bot's data.** An upload replaces the files it contains and keeps everything else, so data the bot saves next to its code survives updates.
- **Keeps it running.** A crash is restarted after a short wait that grows each time, up to a minute. If it crashes within half a minute of starting five times in a row, the bot is left **Crashed** until you start it again. Enabled bots start with the server.
- **Records what people do with it.** Starting, stopping and restarting a hosted bot, changing its code, source, runtime or variables, and installing its dependencies are written to the server's activity log, with who did it.
- **Shows what it uses.** While the bot runs, its memory and its share of one CPU core are shown next to its status, on Linux servers only, which includes the Docker image. Processes the bot starts itself aren't counted. There are no limits on either.

**Compatibility** lists the calls a bot made that SandShark doesn't support yet, each counted once per endpoint and written to the log the first time. A few lists that bots fetch while starting, the server's emojis, stickers and scheduled events, are answered empty instead of refused and marked **answered empty**. When a bot that works on Discord misbehaves here, this is the first place to look.

JavaScript and TypeScript bots run on the server's own runtime, which is Bun. Most run as they are, but packages with native add-ons such as `canvas` may not. For those, set **Runtime** to **Node.js**, which needs Node.js 20 or newer installed on the server. Dependencies are still installed with Bun, which only runs the install scripts of well-known packages: list any other package that builds a native add-on under `trustedDependencies` in `package.json`.

Python bots need Python 3 installed on the server, found as `python3` or `python`, with its `venv` module (on Debian and Ubuntu, the `python3-venv` package). The Docker image doesn't include Python. On Windows, install it from python.org: the Microsoft Store's Python can't be started by other programs. The shim moves aiohttp's requests, which covers discord.py, its forks such as nextcord, disnake and py-cord, and hikari. Bots that call the API themselves with `requests` or `httpx`, or open the gateway with `websockets`, are moved too. Libraries that reach Discord another way are refused rather than redirected.

> **Hosted code is trusted code.** A hosted bot runs as the server's own user and can read everything the server can, including the database and uploaded files. There is no sandbox, as with plugins. Only run code you trust, and only give **Host bots** to people you would trust with the server itself.

## How SandShark maps onto Discord

- **One server is one guild.** Its id is stable. The `@everyone` role has the guild's id and carries the default role's permissions, as on Discord. The default role is also listed as a role of its own.
- **Ids are real snowflakes.** Each one encodes the item's creation time, so timestamps the libraries derive from ids (`message.createdAt`, ping latency and so on) are correct.
- **Visibility.** A bot sees exactly what a member with the same roles sees. A channel it can't see is reported as *Unknown Channel*, never as *Missing Permissions*. Channel permission overwrites are always empty, because hidden channels aren't sent at all.
- **Permissions.** SandShark's permissions are mapped onto Discord's permission bits. Bits with no SandShark equivalent are never set. The owner role is reported as Administrator.
- **Message formatting.** Bold, italic, inline and block code, links, user, role and channel mentions, and custom emoji (`<:name:id>`) convert both ways. Underline, strikethrough and spoilers keep their text but lose the formatting.
- **Embeds.** Up to 10 per message, with Discord's limits (6000 characters in all, 25 fields). Title, description, url, colour, timestamp, author, footer, fields, image and thumbnail are shown. Descriptions and field values take the same formatting as messages. Every url and image has to be `http` or `https`, so `attachment://` images aren't supported. A message can be embeds alone, and only bots can send them.
- **Buttons and select menus.** Action rows with up to five buttons, in all five styles including link buttons, or one select menu, on any message or ephemeral answer, with Discord's rules. Select menus can list the bot's own options, or the server's members, roles, members and roles, or channels; those picks reach the bot as snowflakes with `resolved`. Preset default values on those menus are dropped. A member's click arrives as an `INTERACTION_CREATE` of type 3 carrying the message, and the bot answers by updating that message (`interaction.update`, `edit_message`), deferring the update, or replying. Buttons on an ephemeral answer work for its member only, for as long as the answer is kept.
- **Reactions.** Built-in emoji are named by their character (`👍`), and a bot's 👍 and a member's `:+1:` are the same reaction. Custom emoji use `name:id`.
- **Avatars** aren't sent, because the libraries would build `cdn.discordapp.com` URLs from them.

## Supported

**REST (`/api/v10`)**

| Endpoint | Notes |
| --- | --- |
| `GET /gateway/bot` | one shard |
| `GET /users/@me`, `GET /users/{id}` | |
| `GET /applications/@me`, `GET /oauth2/applications/@me` | the bot is its own application, owned by whoever created it |
| `GET /guilds/{id}`, `/channels`, `/roles`, `/members`, `/members/{user}` | members page with `limit` and `after` |
| `GET /guilds/{id}/emojis`, `/stickers`, `/scheduled-events` | answered with an empty list, so bots that fetch them while starting carry on |
| `GET /channels/{id}` | text, voice, category or a DM the bot is in |
| `GET /channels/{id}/messages` | `limit` up to 100, and `before`, `after` or `around` |
| `GET`, `PATCH`, `DELETE /channels/{id}/messages/{id}` | a bot can edit and delete its own messages, and other people's only with Manage messages |
| `POST /channels/{id}/messages` | `content` up to 2000 characters, `embeds`, `components`, and `message_reference` for replies |
| `PUT`, `DELETE /channels/{id}/messages/{id}/reactions/{emoji}/@me` | |
| `POST /channels/{id}/typing` | |
| `POST /users/@me/channels` | opens a DM, if the server allows direct messages |
| `GET`, `POST`, `PUT /applications/{id}/commands`, and `GET`, `PATCH`, `DELETE /applications/{id}/commands/{id}` | slash commands. The same routes under `/applications/{id}/guilds/{id}/commands` hold the guild's own list |
| `POST /interactions/{id}/{token}/callback` | answers an interaction: a message (type 4) or a deferred "thinking" answer (type 5), either one ephemeral with flag 64; for a button or select menu, a deferred update (type 6) or an update of its message (type 7); autocomplete suggestions (type 8); or a modal (type 9) |
| `POST /webhooks/{id}/{token}`, and `GET`, `PATCH`, `DELETE /webhooks/{id}/{token}/messages/{id or @original}` | follow ups, and reading, editing or deleting the answers. After a deferred answer the first follow up fills it in, as on Discord |

**Gateway (`/api/v10/gateway`)**

JSON encoding, with optional `zlib-stream` compression. HELLO, heartbeats, IDENTIFY with intents, READY then one GUILD_CREATE, and REQUEST_GUILD_MEMBERS. These events are sent, each only with its intent:

- `INTERACTION_CREATE` for slash commands, which needs no intent
- `MESSAGE_CREATE`, `MESSAGE_UPDATE`, `MESSAGE_DELETE` (guild and direct messages)
- `MESSAGE_REACTION_ADD`, `MESSAGE_REACTION_REMOVE`
- `TYPING_START`
- `CHANNEL_CREATE`, `CHANNEL_UPDATE`, `CHANNEL_DELETE`
- `PRESENCE_UPDATE`
- `GUILD_MEMBER_ADD`, `GUILD_MEMBER_UPDATE`, `GUILD_MEMBER_REMOVE`, and `USER_UPDATE` for the bot itself

Without the **message content** intent, guild messages arrive with their content blank unless the bot wrote them or is mentioned, as on Discord. Privileged intents don't need approval: the server admin made the bot.

## Not supported yet

- Slash command options that take a file, and user and message commands (the right click "Apps" menu)
- Select menus and other components inside modals (text inputs only), Discord's newer layout components, and webhooks other than an interaction's own
- Uploading files from a bot (attachments can be read and downloaded)
- Threads: replies inside a thread aren't sent or listed
- Gateway resume: after a disconnect the bot identifies again, which the libraries do on their own
- Voice. SandShark's voice doesn't use Discord's voice protocol.
- Sharding, stage channels, forums, scheduled events, auto moderation, and the OAuth2 "add to server" flow

## Slash commands

A bot registers its commands as it would on Discord: discord.js with `application.commands.set` or `guild.commands.set`, discord.py with `tree.sync()`. Members find them in the message box's `/` menu next to plugin commands, each with fields for its options: members, channels and roles are picked from lists, and choices from a dropdown. A command with `default_member_permissions` is only offered to members with those permissions, and a bot's commands are offered in channels, not in threads, since the answer is posted in the channel.

Answer them the usual ways: `reply`, `deferReply` then `editReply`, `followUp`, and ephemeral answers with `MessageFlags.Ephemeral` or `ephemeral=True`. An answer is a message from the bot, headed with who ran which command. An ephemeral answer is shown only to that member, below the channel's messages, until they dismiss it or reload. A deferred answer shows the bot thinking until it's filled in. A bot has three seconds to answer and fifteen minutes to edit or follow up, as on Discord.

The bot posts its answer like any other message, so it needs to be able to see the channel and send messages there. A member can't run a command in a channel the bot can't see, or while the bot is offline.

### Modals and autocomplete

A command, button or select menu can be answered with a modal (`showModal`, `send_modal`), which opens as a form for that member only. Inputs inside labels and inputs inside action rows both work, and the submission reaches the bot in the shape it sent. A form is submitted once, within the interaction's fifteen minutes, and its answer can reply, or update the message when the form came from a button.

An option marked `autocomplete` asks the bot for suggestions as the member types, with the typed value as the focused option. The bot answers with `respond` or an `@app_commands.autocomplete` callback, and suggestions it doesn't send within three seconds are simply not shown.

## Limits

- **REST:** 50 requests a second per bot across every route, with Discord's rate-limit headers and 429 responses. The SandShark action behind each endpoint keeps its own limits, the same ones members have.
- **Gateway:** 120 sends a minute per connection. A connection that stops heartbeating is closed.
- **Failed logins:** repeated attempts with a bad token from one address are cut off for a while.

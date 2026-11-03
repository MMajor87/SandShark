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

## How SandShark maps onto Discord

- **One server is one guild.** Its id is stable. The `@everyone` role has the guild's id and carries the default role's permissions, as on Discord. The default role is also listed as a role of its own.
- **Ids are real snowflakes.** Each one encodes the item's creation time, so timestamps the libraries derive from ids (`message.createdAt`, ping latency and so on) are correct.
- **Visibility.** A bot sees exactly what a member with the same roles sees. A channel it can't see is reported as *Unknown Channel*, never as *Missing Permissions*. Channel permission overwrites are always empty, because hidden channels aren't sent at all.
- **Permissions.** SandShark's permissions are mapped onto Discord's permission bits. Bits with no SandShark equivalent are never set. The owner role is reported as Administrator.
- **Message formatting.** Bold, italic, inline and block code, links, user, role and channel mentions, and custom emoji (`<:name:id>`) convert both ways. Underline, strikethrough and spoilers keep their text but lose the formatting.
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
| `GET /channels/{id}` | text, voice, category or a DM the bot is in |
| `GET /channels/{id}/messages` | `limit` up to 100, and `before`, `after` or `around` |
| `GET`, `PATCH`, `DELETE /channels/{id}/messages/{id}` | a bot can edit and delete its own messages, and other people's only with Manage messages |
| `POST /channels/{id}/messages` | `content` up to 2000 characters, and `message_reference` for replies |
| `PUT`, `DELETE /channels/{id}/messages/{id}/reactions/{emoji}/@me` | |
| `POST /channels/{id}/typing` | |
| `POST /users/@me/channels` | opens a DM, if the server allows direct messages |
| `GET`, `POST`, `PUT /applications/{id}/commands`, and `GET`, `PATCH`, `DELETE /applications/{id}/commands/{id}` | slash commands. The same routes under `/applications/{id}/guilds/{id}/commands` hold the guild's own list |
| `POST /interactions/{id}/{token}/callback` | answers a slash command: a message (type 4) or a deferred "thinking" answer (type 5), either one ephemeral with flag 64 |
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

- Running slash commands from the app: the server runs them and bots answer them, but the composer's `/` menu doesn't list bot commands yet (#58)
- Slash command options that take a file, autocomplete, and user and message commands (the right click "Apps" menu)
- Embeds, buttons and other components, modals, and webhooks other than an interaction's own
- Uploading files from a bot (attachments can be read and downloaded)
- Threads: replies inside a thread aren't sent or listed
- Gateway resume: after a disconnect the bot identifies again, which the libraries do on their own
- Voice. SandShark's voice doesn't use Discord's voice protocol.
- Sharding, stage channels, forums, scheduled events, auto moderation, and the OAuth2 "add to server" flow

## Slash commands

A bot registers its commands as it would on Discord: discord.js with `application.commands.set` or `guild.commands.set`, discord.py with `tree.sync()`. Members see them once the client lists them (#58), and a command with `default_member_permissions` is only offered to members with those permissions.

Answer them the usual ways: `reply`, `deferReply` then `editReply`, `followUp`, and ephemeral answers with `MessageFlags.Ephemeral` or `ephemeral=True`. An answer is a message from the bot, headed with who ran which command. An ephemeral answer is shown only to that member and isn't kept after they reload. A bot has three seconds to answer and fifteen minutes to edit or follow up, as on Discord.

The bot posts its answer like any other message, so it needs to be able to see the channel and send messages there. A member can't run a command in a channel the bot can't see, or while the bot is offline.

## Limits

- **REST:** 50 requests a second per bot across every route, with Discord's rate-limit headers and 429 responses. The SandShark action behind each endpoint keeps its own limits, the same ones members have.
- **Gateway:** 120 sends a minute per connection. A connection that stops heartbeating is closed.
- **Failed logins:** repeated attempts with a bad token from one address are cut off for a while.

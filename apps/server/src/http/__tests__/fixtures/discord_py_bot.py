"""A plain discord.py ping bot, run by discord-py.test.ts against a SandShark server.

The only changes from a bot written for Discord are the two addresses. discord.py does
not ask /gateway/bot where the gateway is, it connects to a hardcoded Discord address,
so both the REST base url and the gateway have to point at the server. Without the
second line the bot would send its token to Discord.
"""

import sys

import discord
import yarl
from discord import http as discord_http
from discord.gateway import DiscordWebSocket

host, token = sys.argv[1], sys.argv[2]

discord_http.Route.BASE = f"http://{host}/api/v10"
DiscordWebSocket.DEFAULT_GATEWAY = yarl.URL(f"ws://{host}/api/v10/gateway")

intents = discord.Intents.default()
intents.message_content = True

client = discord.Client(intents=intents)


@client.event
async def on_ready():
    guild = client.guilds[0]
    names = sorted(channel.name for channel in guild.text_channels)

    print(f"READY {client.user.name} {len(client.guilds)} {','.join(names)}", flush=True)


@client.event
async def on_message(message):
    if message.content != "!ping":
        return

    await message.reply("pong")
    await message.add_reaction("\N{THUMBS UP SIGN}")

    history = [item async for item in message.channel.history(limit=10)]

    await message.channel.send(f"history:{len(history)}")

    print("DONE", flush=True)

    await client.close()


client.run(token, log_handler=None)

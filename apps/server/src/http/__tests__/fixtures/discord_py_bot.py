"""A plain discord.py ping bot, run by discord-py.test.ts against a SandShark server.

The only changes from a bot written for Discord are the two addresses. discord.py does
not ask /gateway/bot where the gateway is, it connects to a hardcoded Discord address,
so both the REST base url and the gateway have to point at the server. Without the
second line the bot would send its token to Discord.
"""

import sys

import discord
import yarl
from discord import app_commands
from discord import http as discord_http
from discord.gateway import DiscordWebSocket

host, token = sys.argv[1], sys.argv[2]

discord_http.Route.BASE = f"http://{host}/api/v10"
DiscordWebSocket.DEFAULT_GATEWAY = yarl.URL(f"ws://{host}/api/v10/gateway")

intents = discord.Intents.default()
intents.message_content = True

client = discord.Client(intents=intents)
tree = app_commands.CommandTree(client)


@tree.command(name="roll", description="Roll a die")
async def roll(interaction: discord.Interaction, sides: app_commands.Range[int, 2, 100]):
    embed = discord.Embed(title="Roll", description=f"**{sides}**", colour=0x3498DB)
    embed.add_field(name="Sides", value=str(sides), inline=True)

    await interaction.response.send_message(str(sides), embed=embed)


# the usual way to take longer than three seconds: think first, then follow up, which fills
# in the thinking message
@tree.command(name="slow", description="Takes a moment")
async def slow(interaction: discord.Interaction):
    await interaction.response.defer()
    await interaction.followup.send("done")
    await interaction.followup.send("and one more", ephemeral=True)


class PickView(discord.ui.View):
    @discord.ui.button(label="Pick me", style=discord.ButtonStyle.primary, custom_id="pick")
    async def pick(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.edit_message(content="picked", view=None)


# a view answers its button by editing the message it is on. discord.py finds the view by
# the message id and custom id, so the interaction has to carry the message it came from
@tree.command(name="choose", description="Offers a button")
async def choose(interaction: discord.Interaction):
    await interaction.response.send_message("Pick one", view=PickView())


@client.event
async def on_ready():
    guild = client.guilds[0]
    names = sorted(channel.name for channel in guild.text_channels)

    # how a discord.py bot registers its slash commands: globally, and copied to one guild
    synced = await tree.sync()
    tree.copy_global_to(guild=guild)
    guild_synced = await tree.sync(guild=guild)

    print(f"SYNCED {','.join(c.name for c in synced)} {len(guild_synced)}", flush=True)
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


# discord.py logs to stderr, which the test shows when the bot fails, so its tracebacks are
# not lost
client.run(token)

import fs from 'fs/promises';
import path from 'path';
import { HOSTED_BOTS_PATH } from './paths';

// the python twin of the javascript preload, loaded by python itself before the bot's own
// code: a `sitecustomize` module on PYTHONPATH is imported at every interpreter start.
//
// discord.py and its forks (nextcord, disnake, py-cord) and hikari all talk to discord
// through aiohttp, so aiohttp's one request method is where the api and the gateway are
// moved to this server. it is patched the moment the bot imports it, since aiohttp is not
// loaded yet when this runs. below that, every name lookup of a discord host is refused,
// which no library can get around without its own resolver: the bot's token is this
// server's and must never reach discord
const HOSTED_BOT_PYTHON_SHIM_SOURCE = String.raw`
import os
import re
import socket
import sys
from urllib.parse import urlsplit

API_URL = os.environ.get('SANDSHARK_API_URL', '')
GATEWAY_URL = os.environ.get('SANDSHARK_GATEWAY_URL', '')
API_HOSTS = {
    'discord.com',
    'www.discord.com',
    'canary.discord.com',
    'ptb.discord.com',
    'discordapp.com',
    'www.discordapp.com',
}
DISCORD_HOST = re.compile(
    r'(^|\.)(discord\.com|discordapp\.com|discord\.gg|discordapp\.net|discord\.media)$',
    re.I,
)


def refuse(host):
    message = (
        'sandshark: refused a connection to ' + host +
        ', a hosted bot only talks to this server'
    )

    print(message, file=sys.stderr, flush=True)

    return ConnectionRefusedError(message)


def is_discord_host(host):
    return bool(DISCORD_HOST.search(host.rstrip('.')))


def rewrite(url):
    parts = urlsplit(url)
    host = (parts.hostname or '').lower()

    if not is_discord_host(host):
        return url

    query = '?' + parts.query if parts.query else ''

    if host in API_HOSTS and re.match(r'^/api(/|$)', parts.path):
        return API_URL + parts.path[4:] + query

    if host == 'gateway.discord.gg' or host.endswith('.gateway.discord.gg'):
        return GATEWAY_URL + query

    raise refuse(host)


original_getaddrinfo = socket.getaddrinfo


def getaddrinfo(host, *args, **kwargs):
    name = host.decode() if isinstance(host, bytes) else str(host or '')

    if is_discord_host(name.lower()):
        raise refuse(name)

    return original_getaddrinfo(host, *args, **kwargs)


socket.getaddrinfo = getaddrinfo


def patch_aiohttp(aiohttp):
    session = aiohttp.ClientSession
    original_request = session._request

    async def _request(self, method, str_or_url, *args, **kwargs):
        target = rewrite(str(str_or_url))

        if target != str(str_or_url):
            str_or_url = target

        return await original_request(self, method, str_or_url, *args, **kwargs)

    session._request = _request


class PatchOnImport:
    def find_spec(self, name, path=None, target=None):
        if name != 'aiohttp':
            return None

        for finder in sys.meta_path:
            if finder is self or not hasattr(finder, 'find_spec'):
                continue

            spec = finder.find_spec(name, path, target)

            if spec is not None and spec.loader is not None:
                break
        else:
            return None

        exec_module = spec.loader.exec_module

        def patched_exec_module(module):
            exec_module(module)
            patch_aiohttp(module)

        spec.loader.exec_module = patched_exec_module

        return spec


sys.meta_path.insert(0, PatchOnImport())
`;

const HOSTED_BOT_PYTHON_SHIM_DIR = path.join(
  HOSTED_BOTS_PATH,
  '.shim',
  'python'
);

const writeHostedBotPythonShim = async () => {
  await fs.mkdir(HOSTED_BOT_PYTHON_SHIM_DIR, { recursive: true });
  await fs.writeFile(
    path.join(HOSTED_BOT_PYTHON_SHIM_DIR, 'sitecustomize.py'),
    HOSTED_BOT_PYTHON_SHIM_SOURCE
  );
};

export { HOSTED_BOT_PYTHON_SHIM_DIR, writeHostedBotPythonShim };

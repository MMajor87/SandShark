import fs from 'fs/promises';
import path from 'path';
import { HOSTED_BOTS_PATH } from './paths';

// the python twin of the javascript preload, loaded by python itself before the bot's own
// code: a `sitecustomize` module on PYTHONPATH is imported at every interpreter start.
//
// discord.py and its forks (nextcord, disnake, py-cord) and hikari all talk to discord
// through aiohttp, so aiohttp's one request method is where the api and the gateway are
// moved to this server. bots that call the api themselves mostly use requests or httpx, and
// websockets for the gateway, which are moved the same way. each is patched the moment the
// bot imports it, since none is loaded yet when this runs. below that, every name lookup
// of a discord host is refused,
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


# every request a session makes goes through send, prepared or not. urllib3 takes the host
# header from the url, so the url is all there is to change
def patch_requests(requests):
    session = requests.Session
    original_send = session.send

    def send(self, request, **kwargs):
        request.url = rewrite(request.url)

        return original_send(self, request, **kwargs)

    session.send = send


# httpx sets the host header when the request is built, so it moves with the url
def patch_httpx(httpx):
    def move(request):
        url = str(request.url)
        target = rewrite(url)

        if target != url:
            request.url = httpx.URL(target)
            request.headers['Host'] = urlsplit(target).netloc

    original_send = httpx.Client.send
    original_async_send = httpx.AsyncClient.send

    def send(self, request, **kwargs):
        move(request)

        return original_send(self, request, **kwargs)

    async def async_send(self, request, **kwargs):
        move(request)

        return await original_async_send(self, request, **kwargs)

    httpx.Client.send = send
    httpx.AsyncClient.send = async_send


# the asyncio and legacy clients make connect a class, the sync client a function. either
# way the uri comes first
def patch_websockets_client(module):
    connect = module.connect

    if isinstance(connect, type):
        original_init = connect.__init__

        def __init__(self, uri, *args, **kwargs):
            original_init(self, rewrite(uri), *args, **kwargs)

        connect.__init__ = __init__
        return

    def patched_connect(uri, *args, **kwargs):
        return connect(rewrite(uri), *args, **kwargs)

    module.connect = patched_connect


PATCHES = {
    'aiohttp': patch_aiohttp,
    'requests': patch_requests,
    'httpx': patch_httpx,
    'websockets.asyncio.client': patch_websockets_client,
    'websockets.legacy.client': patch_websockets_client,
    'websockets.sync.client': patch_websockets_client,
}


class PatchOnImport:
    def find_spec(self, name, path=None, target=None):
        patch = PATCHES.get(name)

        if patch is None:
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
            patch(module)

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

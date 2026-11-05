import type http from 'http';
import ipaddr from 'ipaddr.js';

// a reverse proxy on the same machine connects from loopback as well, so a request carrying one
// of these was forwarded from somewhere else and is not local
const FORWARDING_HEADERS = [
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip'
];

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLoopbackAddress = (address: string | undefined) => {
  if (!address || !ipaddr.isValid(address)) return false;

  const parsed = ipaddr.process(address);

  return parsed.range() === 'loopback';
};

const getHostname = (host: string) => {
  try {
    const { hostname } = new URL(`http://${host}`);

    return hostname;
  } catch {
    return undefined;
  }
};

// a request from this machine, made by something other than a web page from another site.
// loopback alone is not enough: any site open in a browser on this machine can send requests to
// localhost, and a name the attacker controls can resolve to 127.0.0.1 (dns rebinding), so the
// host has to be a local name and any origin has to be this same host
const isLocalRequest = (req: http.IncomingMessage) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return false;

  if (FORWARDING_HEADERS.some((name) => req.headers[name] !== undefined)) {
    return false;
  }

  const { host, origin } = req.headers;

  if (!host) return false;

  const hostname = getHostname(host);

  if (!hostname || !LOCAL_HOSTNAMES.has(hostname)) return false;

  if (origin !== undefined && origin !== `http://${host}`) return false;

  return req.headers['sec-fetch-site'] !== 'cross-site';
};

export { isLocalRequest };

import { beforeEach, expect, mock, test } from 'bun:test';
import { EventEmitter } from 'node:events';

const exchange = mock(
  async () => new Response(JSON.stringify({ token: 'session-token' }))
);
class FakeWindow extends EventEmitter {
  static latest: FakeWindow;
  destroyed = false;
  url = '';
  webContents = Object.assign(new EventEmitter(), {
    setWindowOpenHandler: mock(() => {}),
    session: { fetch: exchange, setPermissionRequestHandler: mock(() => {}) }
  });
  constructor(public options: { webPreferences: Record<string, unknown> }) {
    super();
    FakeWindow.latest = this;
  }
  setMenuBarVisibility() {}
  isDestroyed() {
    return this.destroyed;
  }
  destroy() {
    this.destroyed = true;
    this.emit('closed');
  }
  async loadURL(url: string) {
    this.url = url;
  }
}
mock.module('electron', () => ({ BrowserWindow: FakeWindow }));
const { startOidcLogin } = await import('./oidc-login.js');
const parent = {} as Parameters<typeof startOidcLogin>[0];

beforeEach(() => {
  exchange.mockClear();
  exchange.mockImplementation(
    async () => new Response(JSON.stringify({ token: 'session-token' }))
  );
});

test('exchanges a server callback using the isolated cookie session', async () => {
  const pending = startOidcLogin(parent, 'https://server.example');
  const window = FakeWindow.latest;
  expect(window.url).toBe('https://server.example/oidc/login');
  expect(window.options.webPreferences).toMatchObject({
    sandbox: true,
    nodeIntegration: false,
    contextIsolation: true
  });
  expect(String(window.options.webPreferences.partition)).not.toStartWith(
    'persist:'
  );
  const event = { preventDefault: mock(() => {}) };
  window.webContents.emit(
    'will-redirect',
    event,
    'https://server.example/#oidc=handoff'
  );
  expect(await pending).toBe('session-token');
  expect(event.preventDefault).toHaveBeenCalled();
  expect(exchange).toHaveBeenCalledWith(
    'https://server.example/oidc/exchange',
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'handoff' })
    }
  );
  expect(window.destroyed).toBe(true);
});

test('ignores handoffs from other origins and paths and blocks non-web navigation', async () => {
  const pending = startOidcLogin(parent, 'https://server.example');
  const window = FakeWindow.latest;
  const event = { preventDefault: mock(() => {}) };
  window.webContents.emit(
    'will-navigate',
    event,
    'https://other.example/#oidc=wrong'
  );
  window.webContents.emit(
    'will-navigate',
    event,
    'https://server.example/other#oidc=wrong'
  );
  expect(exchange).not.toHaveBeenCalled();
  window.webContents.emit('will-navigate', event, 'file:///test');
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  window.destroy();
  expect(await pending).toBeNull();
});

test('reports callback and exchange failures without exposing credentials', async () => {
  const pending = startOidcLogin(parent, 'https://server.example');
  FakeWindow.latest.webContents.emit(
    'will-redirect',
    { preventDefault() {} },
    'https://server.example/?oidc_error=secret'
  );
  await expect(pending).rejects.toThrow(
    'The authentication provider could not sign you in.'
  );
  exchange.mockImplementation(async () => new Response('{}', { status: 403 }));
  const next = startOidcLogin(parent, 'https://server.example');
  FakeWindow.latest.webContents.emit(
    'will-redirect',
    { preventDefault() {} },
    'https://server.example/#oidc=secret'
  );
  await expect(next).rejects.toThrow('Authentication could not be completed.');
});

test.each([
  'file:///test',
  'https://user:password@server.example',
  'https://server.example/path',
  'https://server.example/?query=1'
])('rejects invalid authentication origin %s', (url) => {
  expect(() => startOidcLogin(parent, url)).toThrow(
    'Invalid authentication server URL.'
  );
});

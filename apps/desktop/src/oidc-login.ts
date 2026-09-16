import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';

const startOidcLogin = (parent: BrowserWindow, serverUrl: string) => {
  const server = new URL(serverUrl);
  if (
    !['https:', 'http:'].includes(server.protocol) ||
    server.username ||
    server.password ||
    server.pathname !== '/' ||
    server.search ||
    server.hash
  ) {
    throw new Error('Invalid authentication server URL.');
  }

  return new Promise<string | null>((resolve, reject) => {
    const loginWindow = new BrowserWindow({
      parent,
      width: 560,
      height: 760,
      title: 'SandShark',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        webviewTag: false,
        partition: `oidc-${randomUUID()}`
      }
    });
    loginWindow.setMenuBarVisibility(false);
    loginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    loginWindow.webContents.session.setPermissionRequestHandler(
      (_contents, _permission, callback) => callback(false)
    );
    let settled = false;
    const finish = (code: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(code);
      if (!loginWindow.isDestroyed()) loginWindow.destroy();
    };
    const timeout = setTimeout(
      () => finish(null, new Error('Authentication timed out.')),
      5 * 60_000
    );
    let exchanging = false;
    const exchange = async (code: string) => {
      if (exchanging || settled) return;
      exchanging = true;
      try {
        // the state cookie belongs to this isolated browser session, not the renderer.
        const response = await loginWindow.webContents.session.fetch(
          `${server.origin}/oidc/exchange`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          }
        );
        if (!response.ok)
          throw new Error('Authentication could not be completed.');
        const result = (await response.json()) as { token?: unknown };
        if (typeof result.token !== 'string' || !result.token)
          throw new Error('Invalid authentication response.');
        finish(result.token);
      } catch (error) {
        finish(
          null,
          error instanceof Error ? error : new Error('Authentication failed.')
        );
      }
    };
    const handleNavigation = (event: Electron.Event, target: string) => {
      const url = new URL(target);
      if (!['https:', 'http:'].includes(url.protocol)) {
        event.preventDefault();
        return;
      }
      // only the selected server's root can deliver the one-time handoff code.
      if (url.origin !== server.origin || url.pathname !== '/') return;
      const code = new URLSearchParams(url.hash.slice(1)).get('oidc');
      if (code) {
        event.preventDefault();
        void exchange(code);
      } else if (url.searchParams.has('oidc_error')) {
        event.preventDefault();
        finish(
          null,
          new Error('The authentication provider could not sign you in.')
        );
      }
    };
    loginWindow.webContents.on('will-navigate', handleNavigation);
    loginWindow.webContents.on('will-redirect', handleNavigation);
    loginWindow.on('closed', () => finish(null));
    void loginWindow
      .loadURL(`${server.origin}/oidc/login`)
      .catch((error: Error) => finish(null, error));
  });
};

export { startOidcLogin };

import 'ws';

declare module 'ws' {
  interface WebSocket {
    userId?: number;
    token: string;
  }
}

type TCommandMap = {
  [pluginId: string]: {
    [commandName: string]: TCommand;
  };
};

type TCommand = (...args: unknown[]) => Promise<unknown> | unknown;

declare global {
  interface Window {
    __plugins?: {
      commands: TCommandMap;
    };
  }
  // eslint-disable-next-line no-var
  var disableRateLimiting: boolean | undefined;
}

declare module 'bun' {
  interface Env {
    // SANDSHARK_ prefixed environment variables
    SANDSHARK_PORT?: string;
    SANDSHARK_DEBUG?: string;
    SANDSHARK_AUTOUPDATE?: string;
    SANDSHARK_WEBRTC_PORT?: string;
    SANDSHARK_WEBRTC_ANNOUNCED_ADDRESS?: string;
    SANDSHARK_DATA_PATH?: string;
  }
}

declare module 'node:fs/promises' {
  export function exists(path: import('node:fs').PathLike): Promise<boolean>;
}

declare module 'fs/promises' {
  export function exists(path: import('node:fs').PathLike): Promise<boolean>;
}

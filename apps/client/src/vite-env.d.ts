/// <reference types="vite/client" />
/// <reference types="zzfx" />

// Extend the Window interface for global functions
declare global {
  interface Window {
    useToken: (token: string) => Promise<void>;
    openSoundsModal?: () => void;
    printVoiceStats?: () => void;
    DEBUG?: boolean;
    sandSharkDesktop?: {
      getVersion: () => Promise<string>;
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      showNotification: (options: {
        title: string;
        body?: string;
        silent?: boolean;
        target?: {
          profileId?: string;
          channelId: number;
          messageId: number;
          isDm: boolean;
        };
      }) => Promise<void>;
      onNotificationClick: (
        listener: (target: {
          profileId?: string;
          channelId: number;
          messageId: number;
          isDm: boolean;
        }) => void
      ) => () => void;
      openExternal: (url: string) => Promise<void>;
      getDesktopCaptureSources: () => Promise<
        Array<{
          id: string;
          name: string;
          type: 'screen' | 'window';
          thumbnailDataUrl?: string;
        }>
      >;
      setDesktopCaptureSource: (sourceId: string) => Promise<void>;
      startApplicationAudioCapture: (sourceId: string) => Promise<{
        active: boolean;
        captureId?: string;
        sampleRate?: number;
        channels?: number;
        format?: 'f32' | 's16';
        reason?: string;
      }>;
      stopApplicationAudioCapture: () => Promise<void>;
      onApplicationAudioData: (
        listener: (captureId: string, data: Uint8Array) => void
      ) => () => void;
      reportDesktopCaptureDiagnostic: (diagnostic: {
        stage: string;
        details?: Record<string, boolean | number | string | undefined>;
      }) => Promise<void>;
      showDesktopCaptureLog: () => Promise<void>;
      reportDesktopDiagnostic: (diagnostic: {
        category: string;
        message: string;
        details?: Record<string, boolean | number | string | undefined>;
      }) => Promise<void>;
      openLogFolder: () => Promise<void>;
      setPushToTalk: (config: {
        input:
          | { type: 'keyboard'; keyCode: number }
          | { type: 'mouse'; button: number };
        modifiers: {
          control: boolean;
          shift: boolean;
          alt: boolean;
          meta: boolean;
        };
      }) => Promise<{
        registered: boolean;
        error?: string;
      }>;
      clearPushToTalk: () => Promise<void>;
      onPushToTalk: (listener: (active: boolean) => void) => () => void;
      setTrayStatus: (status: {
        serverName?: string;
        micMuted: boolean;
        soundMuted: boolean;
        unreadCount: number;
      }) => Promise<void>;
      onTrayAction: (
        listener: (action: 'toggle-mic' | 'toggle-sound') => void
      ) => () => void;
      setTaskbarStatus: (status: {
        unreadCount: number;
        mentionCount: number;
      }) => Promise<void>;
      flashTaskbar: () => Promise<void>;
      getWindowBehavior: () => Promise<{
        closeToTray: boolean;
        minimizeToTray: boolean;
        startMinimized: boolean;
      }>;
      setWindowBehavior: (behavior: {
        closeToTray: boolean;
        minimizeToTray: boolean;
        startMinimized: boolean;
      }) => Promise<void>;
      getStartAtLogin: () => Promise<{
        enabled: boolean;
        supported: boolean;
      }>;
      setStartAtLogin: (enabled: boolean) => Promise<{
        enabled: boolean;
        supported: boolean;
      }>;
      getHardwareAcceleration: () => Promise<{
        enabled: boolean;
        restartRequired: boolean;
      }>;
      setHardwareAcceleration: (enabled: boolean) => Promise<{
        enabled: boolean;
        restartRequired: boolean;
      }>;
      getUpdateSettings: () => Promise<{
        automaticallyCheck: boolean;
        automaticallyDownload: boolean;
      }>;
      setUpdateSettings: (settings: {
        automaticallyCheck: boolean;
        automaticallyDownload: boolean;
      }) => Promise<{
        automaticallyCheck: boolean;
        automaticallyDownload: boolean;
      }>;
      getUpdateStatus: () => Promise<{
        state:
          | 'idle'
          | 'checking'
          | 'available'
          | 'not-available'
          | 'downloading'
          | 'downloaded'
          | 'error'
          | 'unsupported';
        version?: string;
        percent?: number;
        message?: string;
      }>;
      checkForUpdates: () => Promise<{
        state: string;
        version?: string;
        percent?: number;
        message?: string;
      }>;
      downloadUpdate: () => Promise<{
        state: string;
        version?: string;
        percent?: number;
        message?: string;
      }>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (
        listener: (status: {
          state: string;
          version?: string;
          percent?: number;
          message?: string;
        }) => void
      ) => () => void;
      getSecret: (key: string) => Promise<string | undefined>;
      setSecret: (request: { key: string; value: string }) => Promise<boolean>;
      removeSecret: (key: string) => Promise<void>;
      readyForDeepLinks: () => Promise<string[]>;
      onDeepLink: (listener: (url: string) => void) => () => void;
      downloadFile: (request: {
        url: string;
        filename: string;
      }) => Promise<{ id?: string }>;
      onDownloadProgress: (
        listener: (progress: {
          id: string;
          filename: string;
          receivedBytes: number;
          totalBytes: number;
          state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
        }) => void
      ) => () => void;
      openDownloadedFile: (id: string) => Promise<void>;
      showDownloadedFile: (id: string) => Promise<void>;
    };

    // plugin store exposed for plugins to use imperatively
    __SHARKORD_STORE__: import('@sharkord/shared').TPluginStore;

    // libs exposed for plugins to use
    __SHARKORD_EXPOSED_LIBS__: {
      createSelector: typeof import('@reduxjs/toolkit').createSelector;
      createCachedSelector: typeof import('re-reselect').createCachedSelector;
    };

    // react and react-dom for plugins to use, injected in main.tsx
    __SHARKORD_REACT__: typeof import('react');
    __SHARKORD_REACT_JSX__: typeof import('react/jsx-runtime');
    __SHARKORD_REACT_JSX_DEV__: typeof import('react/jsx-dev-runtime');
    __SHARKORD_REACT_DOM__: typeof import('react-dom');
    __SHARKORD_REACT_DOM_CLIENT__: typeof import('react-dom/client');
  }

  const VITE_APP_VERSION: string;
}

// this provides type definitions for i18n setup
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof import('./locales/en/common.json');
      connect: typeof import('./locales/en/connect.json');
      disconnected: typeof import('./locales/en/disconnected.json');
      sidebar: typeof import('./locales/en/sidebar.json');
      topbar: typeof import('./locales/en/topbar.json');
      dialogs: typeof import('./locales/en/dialogs.json');
      settings: typeof import('./locales/en/settings.json');
      permissions: typeof import('./locales/en/permissions.json');
    };
  }
}

export {};

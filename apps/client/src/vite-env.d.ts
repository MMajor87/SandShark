/// <reference types="vite/client" />
/// <reference types="zzfx" />

import type { TSandSharkDesktopAPI } from '../../../packages/shared/desktop-api.js';

// Extend the Window interface for global functions
declare global {
  interface Window {
    useToken: (token: string) => Promise<void>;
    sandsharkDebug?: {
      openSoundsModal?: () => void;
      printVoiceStats?: () => void;
    };
    DEBUG?: boolean;
    sandSharkDesktop?: TSandSharkDesktopAPI;

    // plugin store exposed for plugins to use imperatively
    __SANDSHARK_STORE__: import('@sandshark/shared').TPluginStore;

    // libs exposed for plugins to use
    __SANDSHARK_EXPOSED_LIBS__: {
      createSelector: typeof import('@reduxjs/toolkit').createSelector;
      createCachedSelector: typeof import('re-reselect').createCachedSelector;
    };

    // react and react-dom for plugins to use, injected in main.tsx
    __SANDSHARK_REACT__: typeof import('react');
    __SANDSHARK_REACT_JSX__: typeof import('react/jsx-runtime');
    __SANDSHARK_REACT_JSX_DEV__: typeof import('react/jsx-dev-runtime');
    __SANDSHARK_REACT_DOM__: typeof import('react-dom');
    __SANDSHARK_REACT_DOM_CLIENT__: typeof import('react-dom/client');
  }

  const VITE_APP_VERSION: string;
}

// this provides type definitions for i18n setup
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      calendar: typeof import('./i18n/locales/en/calendar.json');
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

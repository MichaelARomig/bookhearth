import { AppService } from '@/types/system';
import { READEST_NODE_BASE_URL, READEST_WEB_BASE_URL } from './constants';
import { getRuntimeConfig } from './runtimeConfig';
import { getOSPlatform } from '@/utils/misc';

declare global {
  interface Window {
    __READEST_CLI_ACCESS?: boolean;
  }
}

export const isTauriAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasCli = () => window.__READEST_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;
/**
 * Official hosted defaults (web.readest.com / node.readest.com) are only used
 * for the public web build when no explicit base is configured. The Tauri /
 * local-first app MUST NOT fall back to those hosts — callers get an empty
 * base and must not invent official cloud traffic.
 */
export const getBaseUrl = () => {
  const configured =
    getRuntimeConfig()?.apiBaseUrl ??
    process.env['API_BASE_URL'] ??
    process.env['NEXT_PUBLIC_API_BASE_URL'] ??
    '';
  if (configured) return configured;
  // Web production still has a hosted surface; desktop/mobile do not.
  return isWebAppPlatform() ? READEST_WEB_BASE_URL : '';
};
export const getNodeBaseUrl = () => {
  const configured = process.env['NEXT_PUBLIC_NODE_BASE_URL'] ?? '';
  if (configured) return configured;
  return isWebAppPlatform() ? READEST_NODE_BASE_URL : '';
};

/**
 * Whether window move/resize has to be driven from JS with pointer events.
 * Linux runs on CEF, where the mouse press is owned by Chromium's X
 * connection: the runtime's `startDragging` (`_NET_WM_MOVERESIZE` from winit's
 * connection) is refused by the window manager, and the undecorated window has
 * no native resize borders either. Every other platform keeps the runtime's
 * own drag.
 */
export const needsPointerWindowControls = () =>
  isTauriAppPlatform() && typeof navigator !== 'undefined' && getOSPlatform() === 'linux';

export const isMacPlatform = () =>
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const getCommandPaletteShortcut = () => (isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P');

const isWebDevMode = () => process.env['NODE_ENV'] === 'development' && isWebAppPlatform();

// Dev API only in development mode and web platform
// with command `pnpm dev-web`
// for production build or tauri app use the production Web API
export const getAPIBaseUrl = () => {
  if (isWebDevMode()) return '/api';
  const base = getBaseUrl();
  return base ? `${base.replace(/\/$/, '')}/api` : '';
};

// For Node.js API that currently not supported in some edge runtimes
export const getNodeAPIBaseUrl = () => {
  if (isWebDevMode()) return '/api';
  const base = getNodeBaseUrl();
  return base ? `${base.replace(/\/$/, '')}/api` : '';
};

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let nativeAppService: AppService | null = null;
const getNativeAppService = async () => {
  if (!nativeAppService) {
    const { NativeAppService } = await import('@/services/nativeAppService');
    // Publish the singleton only after `init` resolves. Assigning first meant a
    // failed init left a half-built service cached forever: every later caller
    // got it back without re-running init, and `getInitializedAppService`
    // handed synchronous callers an object whose paths were never resolved.
    const service = new NativeAppService();
    await service.init();
    nativeAppService = service;
  }
  return nativeAppService;
};

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    const service = new WebAppService();
    await service.init();
    webAppService = service;
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (isTauriAppPlatform()) {
      return getNativeAppService();
    } else {
      return getWebAppService();
    }
  },
};

/**
 * Synchronously returns the app service if it has already been created by
 * {@link environmentConfig.getAppService}; null before first init. The async
 * getter is preferred everywhere — use this only from synchronous code paths
 * that run well after startup (e.g. capability checks during reader render),
 * where the singleton is guaranteed to exist.
 */
export const getInitializedAppService = (): AppService | null => nativeAppService ?? webAppService;

export default environmentConfig;

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Force the native (Tauri) transport path so the client injects the reqwest
// `danger` cert option; on the web build TLS is the browser's concern.
vi.mock('@/services/environment', () => ({
  isTauriAppPlatform: () => true,
}));

const tauriFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => tauriFetch(...args),
}));

import { checkConnection, type WebDAVConfig } from '@/services/sync/providers/webdav/client';

const ok207 = () => ({ status: 207 }) as Response;
const base: WebDAVConfig = {
  serverUrl: 'https://dav.lan',
  username: 'u',
  password: 'p',
};

describe('WebDAV TLS handling', () => {
  beforeEach(() => tauriFetch.mockReset().mockResolvedValue(ok207()));

  it('accepts self-signed / invalid certs by default (allowInsecureTls unset)', async () => {
    await checkConnection(base, '/');
    const init = tauriFetch.mock.calls[0]![1];
    expect(init.danger).toEqual({ acceptInvalidCerts: true, acceptInvalidHostnames: true });
  });

  it('accepts invalid certs when allowInsecureTls is explicitly true', async () => {
    await checkConnection({ ...base, allowInsecureTls: true }, '/');
    expect(tauriFetch.mock.calls[0]![1].danger).toBeDefined();
  });

  it('enforces strict TLS when allowInsecureTls is false (no danger option)', async () => {
    await checkConnection({ ...base, allowInsecureTls: false }, '/');
    expect(tauriFetch.mock.calls[0]![1].danger).toBeUndefined();
  });
});

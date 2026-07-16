import { describe, test, expect, beforeEach, vi } from 'vitest';

/**
 * Network boundary (SPEC §8): with all synchronization and AI providers
 * disabled, normal local reading must generate no application-originated
 * network traffic to official Readest / analytics / AI / translation services.
 *
 * A true packet-capture check is a Phase 7 manual step; this test guards the
 * mechanisms that make the guarantee hold, so a regression that would reopen
 * an official-endpoint call fails here:
 *   1. On desktop/mobile with no configured API base, the official API base
 *      resolves to empty — every libs/* caller (sync, share, storage,
 *      metadata) therefore has no official host to reach.
 *   2. All third-party sync/AI provider defaults are disabled, and telemetry
 *      is off, so nothing dials out until the user opts in to their own host.
 *   3. The LiteLLM (TTS + translation) gate is closed by default.
 */

const env = process.env as Record<string, string | undefined>;
const originalEnv = { ...env };

beforeEach(() => {
  vi.resetModules();
  Object.keys(env).forEach((key) => delete env[key]);
  Object.assign(env, originalEnv);
});

describe('network boundary — official API base', () => {
  test('desktop/mobile with no configured base resolves to an empty API base', async () => {
    env['NEXT_PUBLIC_APP_PLATFORM'] = 'tauri';
    delete env['API_BASE_URL'];
    delete env['NEXT_PUBLIC_API_BASE_URL'];
    const { getAPIBaseUrl, getNodeAPIBaseUrl, getBaseUrl } = await import('@/services/environment');
    expect(getBaseUrl()).toBe('');
    expect(getAPIBaseUrl()).toBe('');
    expect(getNodeAPIBaseUrl()).toBe('');
  });

  test('a user-configured base is honored (their own host, not an official one)', async () => {
    env['NEXT_PUBLIC_APP_PLATFORM'] = 'tauri';
    env['NEXT_PUBLIC_API_BASE_URL'] = 'https://my-node.lan';
    const { getAPIBaseUrl } = await import('@/services/environment');
    expect(getAPIBaseUrl()).toBe('https://my-node.lan/api');
  });
});

describe('network boundary — provider defaults are inert', () => {
  test('every third-party sync/AI provider is disabled by default', async () => {
    const { DEFAULT_SYSTEM_SETTINGS } = await import('@/services/constants');
    expect(DEFAULT_SYSTEM_SETTINGS.kosync?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.webdav?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.googleDrive?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.s3?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.readwise?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.hardcover?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.litellm?.enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.aiSettings?.enabled).toBe(false);
  });

  test('telemetry is off by default', async () => {
    const { DEFAULT_SYSTEM_SETTINGS } = await import('@/services/constants');
    expect(DEFAULT_SYSTEM_SETTINGS.telemetryEnabled).toBe(false);
  });

  test('no provider default prefills an official/public server URL', async () => {
    const { DEFAULT_SYSTEM_SETTINGS } = await import('@/services/constants');
    expect(DEFAULT_SYSTEM_SETTINGS.kosync?.serverUrl).toBe('');
    expect(DEFAULT_SYSTEM_SETTINGS.webdav?.serverUrl).toBe('');
    expect(DEFAULT_SYSTEM_SETTINGS.s3?.endpoint).toBe('');
    expect(DEFAULT_SYSTEM_SETTINGS.litellm?.baseUrl).toBe('');
  });
});

describe('network boundary — LiteLLM gate closed by default', () => {
  test('the shared LiteLLM endpoint is not configured with defaults', async () => {
    const { DEFAULT_LITELLM_SETTINGS } = await import('@/services/constants');
    const { isLiteLLMConfigured } = await import('@/services/litellm');
    expect(isLiteLLMConfigured({ litellm: DEFAULT_LITELLM_SETTINGS })).toBe(false);
  });

  test('an enabled endpoint still needs a base URL before it is considered configured', async () => {
    const { DEFAULT_LITELLM_SETTINGS } = await import('@/services/constants');
    const { isLiteLLMConfigured } = await import('@/services/litellm');
    expect(isLiteLLMConfigured({ litellm: { ...DEFAULT_LITELLM_SETTINGS, enabled: true } })).toBe(
      false,
    );
  });
});

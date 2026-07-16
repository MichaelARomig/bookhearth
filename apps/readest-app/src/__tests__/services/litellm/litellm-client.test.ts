import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiteLLMSettings } from '@/types/settings';

const mockFetch = vi.fn();

vi.mock('@/services/ai/utils/httpFetch', () => ({
  getAIFetch: () => mockFetch,
}));

const storeState = { settings: { litellm: undefined as LiteLLMSettings | undefined } };
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: () => storeState },
}));

import {
  buildLiteLLMHeaders,
  getLiteLLMSettings,
  isLiteLLMConfigured,
  litellmFetch,
  testLiteLLMConnection,
} from '@/services/litellm';

const makeSettings = (overrides: Partial<LiteLLMSettings> = {}): LiteLLMSettings => ({
  enabled: true,
  baseUrl: 'https://litellm.lan/v1',
  apiKey: 'sk-test',
  customHeaders: {},
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  translationModel: 'gpt-4o-mini',
  timeoutMs: 30000,
  ...overrides,
});

describe('isLiteLLMConfigured', () => {
  it('is false when settings are absent', () => {
    expect(isLiteLLMConfigured(null)).toBe(false);
    expect(isLiteLLMConfigured({ litellm: undefined as unknown as LiteLLMSettings })).toBe(false);
  });

  it('is false when disabled or base URL is blank', () => {
    expect(isLiteLLMConfigured({ litellm: makeSettings({ enabled: false }) })).toBe(false);
    expect(isLiteLLMConfigured({ litellm: makeSettings({ baseUrl: '   ' }) })).toBe(false);
  });

  it('is true when enabled with a base URL', () => {
    expect(isLiteLLMConfigured({ litellm: makeSettings() })).toBe(true);
  });
});

describe('getLiteLLMSettings', () => {
  it('reads the live settings from the store', () => {
    storeState.settings.litellm = makeSettings({ apiKey: 'from-store' });
    expect(getLiteLLMSettings()?.apiKey).toBe('from-store');
    storeState.settings.litellm = undefined;
    expect(getLiteLLMSettings()).toBeUndefined();
  });
});

describe('buildLiteLLMHeaders', () => {
  it('sets bearer auth when an api key is present', () => {
    const headers = buildLiteLLMHeaders(makeSettings({ apiKey: 'sk-abc' }));
    expect(headers['Authorization']).toBe('Bearer sk-abc');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('omits auth when the api key is blank (keyless LAN deployment)', () => {
    const headers = buildLiteLLMHeaders(makeSettings({ apiKey: '   ' }));
    expect(headers['Authorization']).toBeUndefined();
  });

  it('applies custom headers and lets them override defaults', () => {
    const headers = buildLiteLLMHeaders(
      makeSettings({ customHeaders: { 'x-key': 'v', 'Content-Type': 'text/plain' } }),
    );
    expect(headers['x-key']).toBe('v');
    expect(headers['Content-Type']).toBe('text/plain');
  });
});

describe('litellmFetch', () => {
  beforeEach(() => mockFetch.mockReset());

  it('strips trailing slashes from the base URL and forwards method + body', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await litellmFetch(makeSettings({ baseUrl: 'https://litellm.lan/v1///' }), '/models', {
      method: 'GET',
    });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://litellm.lan/v1/models');
    expect(init.method).toBe('GET');
    expect(init.headers['Authorization']).toBe('Bearer sk-test');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('forwards an aborted external signal to the fetch call', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const controller = new AbortController();
    controller.abort();
    await litellmFetch(makeSettings(), '/models', { method: 'GET' }, controller.signal);
    expect(mockFetch).toHaveBeenCalledOnce();
    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });
});

describe('testLiteLLMConnection', () => {
  beforeEach(() => mockFetch.mockReset());

  it('requires a base URL', async () => {
    const result = await testLiteLLMConnection(makeSettings({ baseUrl: '' }));
    expect(result).toEqual({ ok: false, error: 'Base URL is required' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns ok on a 200 from /models', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    expect(await testLiteLLMConnection(makeSettings())).toEqual({ ok: true });
  });

  it('reports an auth failure on 401/403', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    const result = await testLiteLLMConnection(makeSettings());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Authentication failed/);
  });

  it('reports the HTTP status on other errors', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502 });
    const result = await testLiteLLMConnection(makeSettings());
    expect(result).toEqual({ ok: false, error: 'Endpoint returned HTTP 502' });
  });

  it('maps an abort/timeout rejection to a friendly message', async () => {
    mockFetch.mockImplementationOnce(async () => {
      throw new Error('The operation was aborted');
    });
    const result = await testLiteLLMConnection(makeSettings());
    expect(result).toEqual({ ok: false, error: 'Connection timed out' });
  });
});

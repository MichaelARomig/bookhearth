import { describe, it, expect, vi, beforeEach } from 'vitest';

const hooks = vi.hoisted(() => ({ enabled: true, key: 'test-key:fx' }));

vi.mock('@/services/translators/enablement', () => ({
  isTranslationProviderEnabled: () => hooks.enabled,
  getDeeplApiKey: () => hooks.key,
}));

vi.mock('@/services/environment', () => ({
  isTauriAppPlatform: () => false,
}));

vi.mock('@/utils/misc', () => ({ stubTranslation: (s: string) => s }));

vi.mock('@/utils/lang', () => ({
  normalizeToShortLang: (lang: string) => lang.split('-')[0]!.toLowerCase(),
}));

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const okResponse = (texts: string[]) => ({
  ok: true,
  json: async () => ({ translations: texts.map((t) => ({ text: t })) }),
});

describe('deeplProvider', () => {
  beforeEach(() => {
    hooks.enabled = true;
    hooks.key = 'test-key:fx';
    mockFetch.mockReset();
  });

  it('is disabled unless enabled AND a key is present', async () => {
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    hooks.enabled = true;
    hooks.key = 'k';
    expect(deeplProvider.disabled).toBe(false);
    hooks.enabled = false;
    expect(deeplProvider.disabled).toBe(true);
    hooks.enabled = true;
    hooks.key = '';
    expect(deeplProvider.disabled).toBe(true);
  });

  it('returns [] for empty input without calling the API', async () => {
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    expect(await deeplProvider.translate([], 'en', 'de')).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when no key is configured', async () => {
    hooks.key = '';
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    await expect(deeplProvider.translate(['Hi'], 'en', 'de')).rejects.toThrow(
      'DeepL API key is not configured',
    );
  });

  it('uses the FREE endpoint for a :fx key and sends the auth header', async () => {
    hooks.key = 'abc123:fx';
    mockFetch.mockResolvedValue(okResponse(['Hallo']));
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    const result = await deeplProvider.translate(['Hello'], 'en', 'de');
    expect(result).toEqual(['Hallo']);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api-free.deepl.com/v2/translate');
    expect(init.headers.Authorization).toBe('DeepL-Auth-Key abc123:fx');
    const body = JSON.parse(init.body);
    expect(body.text).toEqual(['Hello']);
    expect(body.target_lang).toBe('DE');
    expect(body.source_lang).toBe('EN');
  });

  it('uses the PRO endpoint for a non-:fx key', async () => {
    hooks.key = 'prokey';
    mockFetch.mockResolvedValue(okResponse(['Hallo']));
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    await deeplProvider.translate(['Hello'], 'en', 'de');
    expect(mockFetch.mock.calls[0]![0]).toBe('https://api.deepl.com/v2/translate');
  });

  it('omits source_lang when the source is AUTO', async () => {
    mockFetch.mockResolvedValue(okResponse(['x']));
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    await deeplProvider.translate(['Hello'], 'AUTO', 'de');
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.source_lang).toBeUndefined();
  });

  it('preserves blank lines and maps translated text by index', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: '' }, { text: 'Welt' }] }),
    });
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    const result = await deeplProvider.translate(['', 'World'], 'en', 'de');
    expect(result[0]).toBe('');
    expect(result[1]).toBe('Welt');
  });

  it('maps auth (403) and quota (456) errors to clear messages', async () => {
    const { deeplProvider } = await import('@/services/translators/providers/deepl');
    mockFetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(deeplProvider.translate(['Hi'], 'en', 'de')).rejects.toThrow(
      /authentication failed/i,
    );
    mockFetch.mockResolvedValue({ ok: false, status: 456 });
    await expect(deeplProvider.translate(['Hi'], 'en', 'de')).rejects.toThrow(/quota exceeded/i);
  });
});

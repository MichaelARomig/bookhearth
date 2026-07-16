import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiteLLMSettings } from '@/types/settings';

const litellmSettings: LiteLLMSettings = {
  enabled: true,
  baseUrl: 'https://litellm.lan/v1',
  apiKey: 'sk-test',
  customHeaders: {},
  ttsModel: 'tts-1',
  ttsVoice: 'alloy',
  translationModel: 'gpt-4o-mini',
  timeoutMs: 30000,
};

const hooks = vi.hoisted(() => ({
  configured: true,
  fetch: vi.fn(),
  settings: undefined as LiteLLMSettings | undefined,
}));

vi.mock('@/services/litellm', () => ({
  isLiteLLMConfigured: () => hooks.configured,
  getLiteLLMSettings: () => hooks.settings,
  litellmFetch: (...args: unknown[]) => hooks.fetch(...args),
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: {} }) },
}));

vi.mock('@/utils/misc', () => ({ stubTranslation: (s: string) => s }));

vi.mock('@/utils/lang', () => ({
  normalizeToShortLang: (lang: string) => lang.split('-')[0]!.toLowerCase(),
}));

vi.mock('@/services/constants', () => ({
  TRANSLATOR_LANGS: { en: 'English', fr: 'Français' },
}));

const okResponse = (content: unknown) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

describe('litellmProvider', () => {
  beforeEach(() => {
    hooks.configured = true;
    hooks.settings = litellmSettings;
    hooks.fetch.mockReset();
  });

  it('has litellm metadata', async () => {
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    expect(litellmProvider.name).toBe('litellm');
    expect(litellmProvider.authRequired).toBe(false);
  });

  it('reflects configuration state via the disabled getter', async () => {
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    hooks.configured = true;
    expect(litellmProvider.disabled).toBe(false);
    hooks.configured = false;
    expect(litellmProvider.disabled).toBe(true);
  });

  it('returns an empty array for empty input without calling the endpoint', async () => {
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    expect(await litellmProvider.translate([], 'en', 'fr')).toEqual([]);
    expect(hooks.fetch).not.toHaveBeenCalled();
  });

  it('throws an actionable error when the endpoint is not configured', async () => {
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    hooks.configured = false;
    await expect(litellmProvider.translate(['Hello'], 'en', 'fr')).rejects.toThrow(
      'LiteLLM endpoint is not configured',
    );
  });

  it('maps the chat-completion content to the result', async () => {
    hooks.fetch.mockResolvedValue(okResponse('Bonjour'));
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    expect(await litellmProvider.translate(['Hello'], 'en', 'fr')).toEqual(['Bonjour']);

    const [settings, path, init] = hooks.fetch.mock.calls[0]!;
    expect(settings).toBe(litellmSettings);
    expect(path).toBe('/chat/completions');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0);
    expect(body.messages[1].content).toBe('Hello');
    expect(body.messages[0].content).toContain('Français (fr)');
  });

  it('preserves empty lines and does not translate them', async () => {
    hooks.fetch.mockResolvedValue(okResponse('Monde'));
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    const result = await litellmProvider.translate(['', 'World'], 'en', 'fr');
    expect(result[0]).toBe('');
    expect(result[1]).toBe('Monde');
    expect(hooks.fetch).toHaveBeenCalledOnce();
  });

  it('falls back to the original text when the response has no content', async () => {
    hooks.fetch.mockResolvedValue(okResponse(undefined));
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    expect(await litellmProvider.translate(['Hello'], 'en', 'fr')).toEqual(['Hello']);
  });

  it('throws on a server error', async () => {
    hooks.fetch.mockResolvedValue({ ok: false, status: 500 });
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    await expect(litellmProvider.translate(['Hello'], 'en', 'fr')).rejects.toThrow(
      'Translation failed with status 500',
    );
  });

  it('surfaces a language-pair error on 400/422', async () => {
    hooks.fetch.mockResolvedValue({ ok: false, status: 400 });
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    await expect(litellmProvider.translate(['Hello'], 'en', 'xx')).rejects.toThrow(/language pair/);
  });

  it('translates multiple lines in parallel', async () => {
    hooks.fetch.mockResolvedValue(okResponse('T'));
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    const result = await litellmProvider.translate(['a', 'b'], 'en', 'fr');
    expect(result).toEqual(['T', 'T']);
    expect(hooks.fetch).toHaveBeenCalledTimes(2);
  });

  it('omits the source clause and requests auto-detection for AUTO source', async () => {
    hooks.fetch.mockResolvedValue(okResponse('x'));
    const { litellmProvider } = await import('@/services/translators/providers/litellm');
    await litellmProvider.translate(['Hello'], 'AUTO', 'fr');
    const body = JSON.parse(hooks.fetch.mock.calls[0]![2].body);
    expect(body.messages[0].content).toContain('Detect the source language');
  });
});

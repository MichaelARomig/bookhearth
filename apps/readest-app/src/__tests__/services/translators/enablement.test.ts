import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { isTranslationProviderEnabled, getDeeplApiKey } from '@/services/translators/enablement';

const setSettings = (settings: unknown) =>
  (useSettingsStore.setState as unknown as (s: unknown) => void)({ settings });

describe('translation provider enablement', () => {
  beforeEach(() => setSettings({}));

  it('applies defaults when the translation block is absent', () => {
    expect(isTranslationProviderEnabled('google')).toBe(true);
    expect(isTranslationProviderEnabled('azure')).toBe(true);
    expect(isTranslationProviderEnabled('yandex')).toBe(true);
    expect(isTranslationProviderEnabled('deepl')).toBe(false);
  });

  it('defaults unknown providers to enabled', () => {
    expect(isTranslationProviderEnabled('some-future-provider')).toBe(true);
  });

  it('respects explicit user enablement', () => {
    setSettings({ translation: { providers: { google: false, deepl: true }, deeplApiKey: '' } });
    expect(isTranslationProviderEnabled('google')).toBe(false);
    expect(isTranslationProviderEnabled('deepl')).toBe(true);
    // Absent key still falls back to its default.
    expect(isTranslationProviderEnabled('azure')).toBe(true);
  });

  it('reads and trims the DeepL API key', () => {
    expect(getDeeplApiKey()).toBe('');
    setSettings({ translation: { providers: {}, deeplApiKey: '  key:fx  ' } });
    expect(getDeeplApiKey()).toBe('key:fx');
  });
});

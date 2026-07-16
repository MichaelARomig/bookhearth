import { useSettingsStore } from '@/store/settingsStore';

/**
 * Per-provider user enablement for translation providers (SPEC §6.2). Kept
 * separate from a provider's health `disabled` flag: `disabled` means "the
 * service can't be used right now", while enablement means "the user chose to
 * turn this provider on/off in settings". A provider is only selectable when it
 * is both enabled and healthy.
 *
 * Defaults when the settings block is absent (fresh install / older settings
 * blob): Google/Azure/Yandex on, DeepL off — mirrors DEFAULT_TRANSLATION_SETTINGS.
 * LiteLLM is intentionally not covered here; it is gated by `isLiteLLMConfigured`.
 */
const DEFAULT_ENABLEMENT: Record<string, boolean> = {
  google: true,
  azure: true,
  yandex: true,
  deepl: false,
};

export const isTranslationProviderEnabled = (name: string): boolean => {
  const providers = useSettingsStore.getState().settings?.translation?.providers as
    | Record<string, boolean>
    | undefined;
  if (providers && name in providers) return !!providers[name];
  return DEFAULT_ENABLEMENT[name] ?? true;
};

/** The user's DeepL API key, trimmed. Empty string when unset. */
export const getDeeplApiKey = (): string =>
  useSettingsStore.getState().settings?.translation?.deeplApiKey?.trim() ?? '';

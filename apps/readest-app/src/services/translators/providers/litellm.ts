import { stubTranslation as _ } from '@/utils/misc';
import { normalizeToShortLang } from '@/utils/lang';
import { TRANSLATOR_LANGS } from '@/services/constants';
import { getLiteLLMSettings, isLiteLLMConfigured, litellmFetch } from '@/services/litellm';
import { useSettingsStore } from '@/store/settingsStore';
import { TranslationProvider } from '../types';

// A human-readable language label improves model accuracy over a bare ISO
// code; the code is appended as a disambiguator (e.g. "English (en)"). AUTO
// source is expressed as "detect the source language" so the model performs
// its own detection where it can.
const describeLang = (lang: string): string => {
  const short = normalizeToShortLang(lang).toLowerCase();
  const name = TRANSLATOR_LANGS[short];
  return name ? `${name} (${short})` : short;
};

const buildMessages = (line: string, sourceLang: string, targetLang: string) => {
  const source = normalizeToShortLang(sourceLang).toUpperCase();
  const sourceClause =
    source === 'AUTO' || source === ''
      ? 'Detect the source language automatically.'
      : `The source language is ${describeLang(sourceLang)}.`;
  const system =
    `You are a translation engine. Translate the user's text into ${describeLang(targetLang)}. ` +
    `${sourceClause} ` +
    'Return only the translated text with no explanations, labels, quotation marks, ' +
    'or added content, and preserve the original formatting.';
  return [
    { role: 'system', content: system },
    { role: 'user', content: line },
  ];
};

export const litellmProvider: TranslationProvider = {
  name: 'litellm',
  label: _('AI (LiteLLM)'),
  authRequired: false,
  quotaExceeded: false,
  // Unavailable until the shared endpoint is configured — mirrors the config
  // gate so the settings dropdown greys it out and `useTranslator` falls back
  // to another provider instead of failing every request.
  get disabled() {
    return !isLiteLLMConfigured(useSettingsStore.getState().settings);
  },
  translate: async (texts: string[], sourceLang: string, targetLang: string): Promise<string[]> => {
    if (!texts.length) return [];

    const settings = getLiteLLMSettings();
    if (!settings || !isLiteLLMConfigured({ litellm: settings })) {
      throw new Error(_('LiteLLM endpoint is not configured'));
    }

    const results: string[] = new Array(texts.length);
    await Promise.all(
      texts.map(async (line, index) => {
        if (!line?.trim().length) {
          results[index] = line;
          return;
        }
        const response = await litellmFetch(settings, '/chat/completions', {
          method: 'POST',
          body: JSON.stringify({
            model: settings.translationModel,
            messages: buildMessages(line, sourceLang, targetLang),
            temperature: 0,
            stream: false,
          }),
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 422) {
            throw new Error(
              `Translation model cannot satisfy this language pair (HTTP ${response.status})`,
            );
          }
          throw new Error(`Translation failed with status ${response.status}`);
        }

        const data = await response.json();
        const translated = data?.choices?.[0]?.message?.content;
        results[index] = typeof translated === 'string' && translated.trim() ? translated : line;
      }),
    );

    return results;
  },
};

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriAppPlatform } from '@/services/environment';
import { stubTranslation as _ } from '@/utils/misc';
import { normalizeToShortLang } from '@/utils/lang';
import { TranslationProvider } from '../types';
import { getDeeplApiKey, isTranslationProviderEnabled } from '../enablement';

// DeepL translation using the user's own DeepL Developer key — no Readest
// account or proxy (SPEC §6.2, §7.1). DeepL's convention: Free keys end in
// `:fx` and must use the Free host; any other key uses the Pro host. Requests
// go direct, so on native we use the Tauri HTTP plugin (reqwest) to bypass the
// browser CORS/cleartext restrictions the same way the Google provider does.
const DEEPL_FREE_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
const DEEPL_PRO_ENDPOINT = 'https://api.deepl.com/v2/translate';

const endpointForKey = (key: string): string =>
  key.endsWith(':fx') ? DEEPL_FREE_ENDPOINT : DEEPL_PRO_ENDPOINT;

/**
 * DeepL language codes are upper-case, but the service answers 500 when the
 * *script* subtag is upper-cased too. Measured against the live endpoint:
 * `ZH-HANT` and `ZH-TW` both fail, while `ZH-Hant` answers 200 with real
 * Traditional Chinese — and the same holds for `source_lang`. Upper-casing the
 * whole code therefore turned every zh-TW/zh-HK/zh-MO translation into a hard
 * failure. `normalizeToShortLang` already returns the canonical `zh-Hans` /
 * `zh-Hant`, so only the primary subtag is upper-cased and the script subtag
 * keeps the casing it came with. Languages without a script subtag ('en' -> 'EN',
 * and 'AUTO' -> 'AUTO') are unaffected.
 */
const toDeeplLang = (lang: string): string => {
  const [primary, ...rest] = normalizeToShortLang(lang).split('-');
  return [primary!.toUpperCase(), ...rest].join('-');
};

export const deeplProvider: TranslationProvider = {
  name: 'deepl',
  label: _('DeepL'),
  authRequired: false,
  // No `preservesMarkup`: round-tripping inline markup through this endpoint
  // corrupts it, silently and inconsistently. Measured against the live API —
  // `<b>` and `<i>` alone survive, but `<em>` is dropped outright, and when a
  // sentence carries both bold and italic the bold content is moved outside
  // its own tag, leaving an empty `<b></b>` so nothing renders bold. Losing
  // the formatting while keeping the text (the plain-text path) is better than
  // emitting markup that lies about it.
  quotaExceeded: false,
  // Unavailable unless the user both enabled DeepL and entered an API key.
  get disabled() {
    return !isTranslationProviderEnabled('deepl') || !getDeeplApiKey();
  },
  translate: async (texts: string[], sourceLang: string, targetLang: string): Promise<string[]> => {
    if (!texts.length) return [];

    const key = getDeeplApiKey();
    if (!key) throw new Error('DeepL API key is not configured');

    const source = normalizeToShortLang(sourceLang).toUpperCase();
    const body = JSON.stringify({
      text: texts,
      target_lang: toDeeplLang(targetLang),
      ...(source && source !== 'AUTO' ? { source_lang: toDeeplLang(sourceLang) } : {}),
    });

    const fetch = isTauriAppPlatform() ? tauriFetch : window.fetch;
    const response = await fetch(endpointForKey(key), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${key}`,
      },
      body,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('DeepL authentication failed — check the API key');
      }
      if (response.status === 456) {
        deeplProvider.quotaExceeded = true;
        throw new Error('DeepL quota exceeded for this billing period');
      }
      throw new Error(`DeepL translation failed with status ${response.status}`);
    }

    const data = await response.json();
    const translations = data?.translations ?? [];
    return texts.map((line, i) => {
      if (!line?.trim().length) return line;
      const text = translations[i]?.text;
      return typeof text === 'string' && text.length ? text : line;
    });
  },
};

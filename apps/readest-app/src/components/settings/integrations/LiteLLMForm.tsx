import clsx from 'clsx';
import React, { useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { eventDispatcher } from '@/utils/event';
import { DEFAULT_LITELLM_SETTINGS } from '@/services/constants';
import { testLiteLLMConnection } from '@/services/litellm';
import type { LiteLLMSettings } from '@/types/settings';
import SubPageHeader from '../SubPageHeader';
import { SectionTitle, SettingLabel, SettingsSelect } from '../primitives';

const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

const inputClass = 'input input-bordered eink-bordered h-11 w-full text-sm focus:outline-none';

interface LiteLLMFormProps {
  onBack: () => void;
}

const LiteLLMForm: React.FC<LiteLLMFormProps> = ({ onBack }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const current = settings.litellm ?? DEFAULT_LITELLM_SETTINGS;

  const [enabled, setEnabled] = useState(current.enabled);
  const [baseUrl, setBaseUrl] = useState(current.baseUrl);
  const [apiKey, setApiKey] = useState(current.apiKey);
  const [ttsModel, setTtsModel] = useState(current.ttsModel);
  const [ttsVoice, setTtsVoice] = useState(current.ttsVoice);
  const [translationModel, setTranslationModel] = useState(current.translationModel);
  const [timeoutMs, setTimeoutMs] = useState(String(current.timeoutMs));
  const [headersText, setHeadersText] = useState(
    Object.keys(current.customHeaders ?? {}).length
      ? JSON.stringify(current.customHeaders, null, 2)
      : '',
  );
  const [headersError, setHeadersError] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Parse the optional custom-headers JSON into a string map. Returns null on
  // malformed input so the caller can surface an inline error instead of
  // silently dropping headers.
  const parseHeaders = (): Record<string, string> | null => {
    const text = headersText.trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const result: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) result[k] = String(v);
        return result;
      }
    } catch {
      /* fall through to error */
    }
    return null;
  };

  const buildConfig = (overrides: Partial<LiteLLMSettings> = {}): LiteLLMSettings | null => {
    const customHeaders = parseHeaders();
    if (customHeaders === null) {
      setHeadersError(_('Custom headers must be valid JSON'));
      return null;
    }
    setHeadersError('');
    return {
      enabled,
      baseUrl: baseUrl.trim(),
      apiKey,
      customHeaders,
      ttsModel: ttsModel.trim() || DEFAULT_LITELLM_SETTINGS.ttsModel,
      ttsVoice,
      translationModel: translationModel.trim() || DEFAULT_LITELLM_SETTINGS.translationModel,
      timeoutMs: Math.max(1000, Number(timeoutMs) || DEFAULT_LITELLM_SETTINGS.timeoutMs),
      ...overrides,
    };
  };

  const persist = async (config: LiteLLMSettings) => {
    const newSettings = { ...settings, litellm: config };
    setSettings(newSettings);
    await saveSettings(envConfig, newSettings);
  };

  const handleSave = async () => {
    const config = buildConfig();
    if (!config) return;
    await persist(config);
    eventDispatcher.dispatch('toast', { message: _('Settings saved'), type: 'success' });
  };

  const handleToggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    const config = buildConfig({ enabled: next });
    if (config) await persist(config);
  };

  const handleTest = async () => {
    const config = buildConfig();
    if (!config) return;
    setIsTesting(true);
    // Persist first so the tested config is what the app will actually use.
    await persist(config);
    const result = await testLiteLLMConnection(config);
    setIsTesting(false);
    eventDispatcher.dispatch('toast', {
      message: result.ok
        ? _('Connection successful')
        : `${_('Connection failed')}: ${_(result.error || 'Unknown error')}`,
      type: result.ok ? 'success' : 'error',
    });
  };

  return (
    <div className='w-full'>
      <SubPageHeader
        parentLabel={_('Integrations')}
        currentLabel={_('AI (LiteLLM)')}
        description={_(
          'Route text-to-speech and translation through your own OpenAI-compatible LiteLLM endpoint. Credentials stay on this device.',
        )}
        onBack={onBack}
      />

      <div className='space-y-5'>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <label className='flex min-h-14 items-center justify-between px-4'>
            <SettingLabel>{_('Enable AI Services')}</SettingLabel>
            <input
              type='checkbox'
              className='toggle'
              checked={enabled}
              onChange={handleToggleEnabled}
            />
          </label>
        </div>

        <form
          className='space-y-4'
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className='space-y-1.5'>
            <SectionTitle as='label' htmlFor='litellm-base-url' className='block'>
              {_('Base URL')}
            </SectionTitle>
            <input
              id='litellm-base-url'
              type='text'
              placeholder='https://litellm.your-lan/v1'
              className={inputClass}
              spellCheck='false'
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <SectionTitle as='label' htmlFor='litellm-api-key' className='block'>
              {_('API Key')}
            </SectionTitle>
            <input
              id='litellm-api-key'
              type='password'
              placeholder={_('Bearer token (optional for keyless LAN)')}
              className={inputClass}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete='off'
            />
          </div>

          <div className='space-y-1.5'>
            <SectionTitle as='label' htmlFor='litellm-translation-model' className='block'>
              {_('Translation Model')}
            </SectionTitle>
            <input
              id='litellm-translation-model'
              type='text'
              placeholder='gpt-4o-mini'
              className={inputClass}
              spellCheck='false'
              value={translationModel}
              onChange={(e) => setTranslationModel(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <SectionTitle as='label' htmlFor='litellm-tts-model' className='block'>
              {_('TTS Model')}
            </SectionTitle>
            <input
              id='litellm-tts-model'
              type='text'
              placeholder='tts-1'
              className={inputClass}
              spellCheck='false'
              value={ttsModel}
              onChange={(e) => setTtsModel(e.target.value)}
            />
          </div>

          <div className='flex min-h-14 items-center justify-between gap-3'>
            <SectionTitle as='span' className='block'>
              {_('TTS Voice')}
            </SectionTitle>
            <SettingsSelect
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              ariaLabel={_('TTS Voice')}
              options={TTS_VOICES.map((v) => ({ value: v, label: v }))}
            />
          </div>

          <div className='space-y-1.5'>
            <SectionTitle as='label' htmlFor='litellm-timeout' className='block'>
              {_('Request Timeout (ms)')}
            </SectionTitle>
            <input
              id='litellm-timeout'
              type='number'
              min={1000}
              placeholder='30000'
              className={inputClass}
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(e.target.value)}
            />
          </div>

          <div className='space-y-1.5'>
            <SectionTitle as='label' htmlFor='litellm-headers' className='block'>
              {_('Custom Headers (JSON, optional)')}
            </SectionTitle>
            <textarea
              id='litellm-headers'
              placeholder='{ "x-litellm-api-key": "..." }'
              className='textarea textarea-bordered eink-bordered min-h-20 w-full font-mono text-xs focus:outline-none'
              spellCheck='false'
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
            />
            {headersError && <p className='text-error text-xs'>{headersError}</p>}
          </div>

          <div className='flex justify-end gap-3 pt-1'>
            <button
              type='button'
              onClick={handleTest}
              disabled={isTesting || !baseUrl.trim()}
              className={clsx(
                'eink-bordered h-10 rounded-lg px-4 text-sm font-medium',
                'hover:bg-base-200 transition-colors duration-150',
                'focus-visible:ring-base-content/20 focus-visible:outline-none focus-visible:ring-2',
                isTesting && 'opacity-60',
              )}
            >
              {isTesting ? (
                <span className='loading loading-spinner loading-sm' />
              ) : (
                _('Test Connection')
              )}
            </button>
            <button
              type='submit'
              className={clsx(
                'btn btn-primary h-10 min-h-10 rounded-lg border-0 px-5 text-sm font-medium',
                'focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2',
              )}
            >
              {_('Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LiteLLMForm;

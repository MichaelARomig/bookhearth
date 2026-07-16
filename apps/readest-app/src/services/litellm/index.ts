import { getAIFetch } from '@/services/ai/utils/httpFetch';
import { useSettingsStore } from '@/store/settingsStore';
import type { LiteLLMSettings, SystemSettings } from '@/types/settings';

/**
 * Shared client for the user-controlled, OpenAI-compatible LiteLLM endpoint
 * that backs AI text-to-speech and translation (SPEC §6). Both adapters share
 * one endpoint + credential; this module owns the config gate, header
 * assembly, timeout-bounded fetch, and connection test so neither adapter
 * re-implements them. Request bodies and headers are never logged, so the
 * configured credential cannot leak into diagnostics (SPEC §6, §7.3).
 */

export interface LiteLLMConnectionResult {
  ok: boolean;
  error?: string;
}

/** Strip trailing slashes so `${baseUrl}${path}` never doubles the separator. */
const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '');

/**
 * True when the shared endpoint is enabled and has a base URL. Both adapters
 * gate on this before issuing any request; the translator additionally
 * exposes it as its `disabled` flag so the UI greys the provider out and the
 * fallback logic skips it when unconfigured.
 */
export const isLiteLLMConfigured = (settings?: Pick<SystemSettings, 'litellm'> | null): boolean => {
  const s = settings?.litellm;
  return !!s && s.enabled && normalizeBaseUrl(s.baseUrl).length > 0;
};

/** Read the live LiteLLM settings from the store (for use outside React). */
export const getLiteLLMSettings = (): LiteLLMSettings | undefined =>
  useSettingsStore.getState().settings?.litellm;

/**
 * Assemble request headers: JSON content type, bearer auth when a key is set,
 * plus any user-configured custom headers. Custom headers are applied last so
 * a deployment can override defaults (e.g. a `x-litellm-api-key` virtual key).
 */
export const buildLiteLLMHeaders = (settings: LiteLLMSettings): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${settings.apiKey.trim()}`;
  }
  for (const [key, value] of Object.entries(settings.customHeaders ?? {})) {
    if (key.trim()) headers[key] = value;
  }
  return headers;
};

/**
 * Issue a request to an OpenAI-compatible path on the configured endpoint.
 * Applies the per-request timeout, composed with any caller-supplied abort
 * signal (TTS cancellation), and routes through the platform fetch — Tauri's
 * reqwest on native (no CORS/cleartext restrictions for a user-typed endpoint)
 * and `window.fetch` on web.
 */
export const litellmFetch = async (
  settings: LiteLLMSettings,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> => {
  const url = `${normalizeBaseUrl(settings.baseUrl)}${path}`;
  const fetch = getAIFetch();
  const timeoutController = new AbortController();
  const timer = setTimeout(
    () => timeoutController.abort(),
    Math.max(1000, settings.timeoutMs || 30000),
  );
  const onExternalAbort = () => timeoutController.abort();
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }
  try {
    return await fetch(url, {
      ...init,
      headers: { ...buildLiteLLMHeaders(settings), ...(init.headers as Record<string, string>) },
      signal: timeoutController.signal,
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
};

/**
 * Verify the endpoint is reachable and the credential is accepted by listing
 * models (`GET /models`, the OpenAI-compatible discovery route LiteLLM
 * exposes). Returns a structured result so the settings UI can render an
 * actionable message without parsing thrown errors.
 */
export const testLiteLLMConnection = async (
  settings: LiteLLMSettings,
): Promise<LiteLLMConnectionResult> => {
  if (normalizeBaseUrl(settings.baseUrl).length === 0) {
    return { ok: false, error: 'Base URL is required' };
  }
  try {
    const response = await litellmFetch(settings, '/models', { method: 'GET' });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Authentication failed — check the API key' };
    }
    return { ok: false, error: `Endpoint returned HTTP ${response.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const timedOut = /abort/i.test(message);
    return { ok: false, error: timedOut ? 'Connection timed out' : message };
  }
};

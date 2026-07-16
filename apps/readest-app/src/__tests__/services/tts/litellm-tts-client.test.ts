import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiteLLMSettings } from '@/types/settings';

const settings: LiteLLMSettings = {
  enabled: true,
  baseUrl: 'https://litellm.lan/v1',
  apiKey: 'sk-test',
  customHeaders: {},
  ttsModel: 'tts-1',
  ttsVoice: 'nova',
  translationModel: 'gpt-4o-mini',
  timeoutMs: 30000,
};

const hooks = vi.hoisted(() => ({
  configured: true,
  settings: undefined as LiteLLMSettings | undefined,
  fetch: vi.fn(),
  marks: [] as Array<{ offset: number; name: string; text: string; language: string }>,
}));

vi.mock('@/services/litellm', () => ({
  isLiteLLMConfigured: () => hooks.configured,
  getLiteLLMSettings: () => hooks.settings,
  litellmFetch: (...args: unknown[]) => hooks.fetch(...args),
}));

vi.mock('@/utils/ssml', () => ({
  parseSSMLMarks: () => ({ marks: hooks.marks }),
}));

// Avoid loading the heavy foliate-backed controller module for a type-only dep.
vi.mock('@/services/tts/TTSController', () => ({ TTSController: class {} }));

import { LiteLLMTTSClient } from '@/services/tts/LiteLLMTTSClient';

const audioResponse = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
const mark = (name: string, text: string) => ({ offset: 0, name, text, language: 'en' });

beforeEach(() => {
  hooks.configured = true;
  hooks.settings = settings;
  hooks.fetch.mockReset();
  hooks.marks = [];
});

describe('LiteLLMTTSClient init + metadata', () => {
  it('initializes only when the endpoint is configured', async () => {
    const client = new LiteLLMTTSClient();
    hooks.configured = true;
    expect(await client.init()).toBe(true);
    expect(client.initialized).toBe(true);

    const client2 = new LiteLLMTTSClient();
    hooks.configured = false;
    expect(await client2.init()).toBe(false);
    expect(client2.initialized).toBe(false);
  });

  it('reports sentence granularity and no word boundaries', async () => {
    const client = new LiteLLMTTSClient();
    expect(client.supportsWordBoundaries()).toBe(false);
    expect(client.getGranularities()).toEqual(['sentence']);
  });

  it('exposes the OpenAI voice set, disabled until initialized', async () => {
    const client = new LiteLLMTTSClient();
    const before = await client.getAllVoices();
    expect(before.map((v) => v.id)).toEqual(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);
    expect(before.every((v) => v.disabled)).toBe(true);

    await client.init();
    const after = await client.getAllVoices();
    expect(after.every((v) => v.disabled)).toBe(false);
  });

  it('groups voices by the requested language for getVoices()', async () => {
    const client = new LiteLLMTTSClient();
    await client.init();
    const groups = await client.getVoices('fr');
    expect(groups[0]!.voices.every((v) => v.lang === 'fr')).toBe(true);
  });

  it('falls back to the configured voice for getVoiceId()', async () => {
    const client = new LiteLLMTTSClient();
    expect(client.getVoiceId()).toBe('nova');
  });

  it('only accepts known voice ids in setVoice()', async () => {
    const client = new LiteLLMTTSClient();
    await client.setVoice('echo');
    expect(client.getVoiceId()).toBe('echo');
    await client.setVoice('not-a-voice');
    expect(client.getVoiceId()).toBe('echo');
  });
});

describe('LiteLLMTTSClient preload fetch + cache', () => {
  const drain = async (client: LiteLLMTTSClient, signal: AbortSignal) => {
    for await (const _e of client.speak('<ssml/>', signal, true)) {
      /* consume */
    }
  };

  it('fetches audio for the first marks with the OpenAI-compatible body', async () => {
    hooks.fetch.mockResolvedValue(audioResponse());
    hooks.marks = [mark('m0', 'Hello'), mark('m1', 'World')];
    const client = new LiteLLMTTSClient();
    await client.init();
    await drain(client, new AbortController().signal);

    expect(hooks.fetch).toHaveBeenCalledTimes(2);
    const [, path, init] = hooks.fetch.mock.calls[0]!;
    expect(path).toBe('/audio/speech');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('tts-1');
    expect(body.voice).toBe('nova');
    expect(body.input).toBe('Hello');
    expect(body.response_format).toBe('mp3');
  });

  it('serves a repeated sentence from cache instead of refetching', async () => {
    hooks.fetch.mockResolvedValue(audioResponse());
    hooks.marks = [mark('m0', 'Hello')];
    const client = new LiteLLMTTSClient();
    await client.init();
    await drain(client, new AbortController().signal);
    await drain(client, new AbortController().signal);
    expect(hooks.fetch).toHaveBeenCalledTimes(1);

    client.clearCache();
    await drain(client, new AbortController().signal);
    expect(hooks.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not fetch when the signal is already aborted', async () => {
    hooks.fetch.mockResolvedValue(audioResponse());
    hooks.marks = [mark('m0', 'Hello')];
    const client = new LiteLLMTTSClient();
    await client.init();
    const controller = new AbortController();
    controller.abort();
    await drain(client, controller.signal);
    expect(hooks.fetch).not.toHaveBeenCalled();
  });

  it('swallows fetch errors during preload', async () => {
    hooks.fetch.mockResolvedValue({ ok: false, status: 500 });
    hooks.marks = [mark('m0', 'Hello')];
    const client = new LiteLLMTTSClient();
    await client.init();
    await expect(drain(client, new AbortController().signal)).resolves.toBeUndefined();
  });
});

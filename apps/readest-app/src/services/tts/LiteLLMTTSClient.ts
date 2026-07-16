import { TTSClient, TTSMessageEvent } from './TTSClient';
import { TTSGranularity, TTSMark, TTSVoice, TTSVoicesGroup } from './types';
import { parseSSMLMarks } from '@/utils/ssml';
import { TTSController } from './TTSController';
import { applyEdgeFade, findSpeechBounds } from './pcm';
import { timeStretch } from './timeStretch';
import { recordMeasuredDuration, calibrateVoiceRate } from './ttsDuration';
import { TTSAudioBuffer, WebAudioPlayer, WebAudioPlayerEvent } from './WebAudioPlayer';
import { getLiteLLMSettings, isLiteLLMConfigured, litellmFetch } from '@/services/litellm';

// TTS backed by the user-controlled LiteLLM endpoint (SPEC §6.1). The playback
// pipeline mirrors EdgeTTSClient — fetch audio per sentence at rate 1.0, decode,
// trim leading/trailing silence, WSOLA time-stretch to the playback rate, then
// schedule gaplessly on the shared AudioContext — so pause/resume/stop and
// gapless sentence transitions behave identically. Unlike Edge, the
// OpenAI-compatible `/audio/speech` route returns no word-boundary timings, so
// this client highlights at sentence granularity only.

const INTER_SENTENCE_GAP_SEC = 0.15;

// OpenAI-compatible voices exposed by LiteLLM's `/audio/speech` route. They are
// multilingual (voice is not tied to a language), so the same set is offered
// regardless of the book's language.
const OPENAI_VOICE_IDS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

// Bounded in-memory cache of fetched MP3 bytes keyed by model|voice|text, so
// re-reading a sentence (replay, prev/next) skips the network. Bounded by entry
// count and fully cleared on shutdown / clearCache (SPEC §6.1 "bounded local
// caching that can be cleared by the user").
const MAX_CACHE_ENTRIES = 64;

type SpeakQueueEvent =
  | { kind: 'chunk-start'; index: number }
  | { kind: 'chunk-skip'; markName: string }
  | { kind: 'session-end' }
  | { kind: 'error'; message: string };

class AsyncQueue<T> {
  #items: T[] = [];
  #resolvers: Array<(item: T) => void> = [];

  push(item: T): void {
    const resolve = this.#resolvers.shift();
    if (resolve) resolve(item);
    else this.#items.push(item);
  }

  next(): Promise<T> {
    const item = this.#items.shift();
    if (item !== undefined) return Promise.resolve(item);
    return new Promise((resolve) => this.#resolvers.push(resolve));
  }
}

interface ChunkMeta {
  mark: TTSMark;
  trimStartSec: number;
  trimmedDurationSec: number;
}

export class LiteLLMTTSClient implements TTSClient {
  name = 'litellm-tts';
  initialized = false;
  controller?: TTSController;

  #primaryLang = 'en';
  #speakingLang = '';
  #currentVoiceId = '';
  #rate = 1.0;

  #player = new WebAudioPlayer();
  #activeGeneration: number | null = null;
  #activeQueue: AsyncQueue<SpeakQueueEvent> | null = null;
  #chunkMeta: ChunkMeta[] = [];
  #isPlaying = false;
  #audioCache = new Map<string, ArrayBuffer>();

  constructor(controller?: TTSController) {
    this.controller = controller;
  }

  async init(): Promise<boolean> {
    // "Initialized" == configured: the client is only listed as an available
    // engine when the shared endpoint is set up, mirroring the translator gate.
    const settings = getLiteLLMSettings();
    this.initialized = isLiteLLMConfigured(settings ? { litellm: settings } : null);
    if (this.initialized && !this.#currentVoiceId) {
      this.#currentVoiceId = settings?.ttsVoice || OPENAI_VOICE_IDS[0]!;
    }
    return this.initialized;
  }

  #cacheKey(voiceId: string, text: string): string {
    const settings = getLiteLLMSettings();
    return `${settings?.ttsModel ?? ''}|${voiceId}|${text}`;
  }

  // Fetch MP3 bytes for one sentence at rate 1.0 (rate is applied client-side),
  // memoized in the bounded cache. Returns undefined when aborted.
  async #fetchAudio(
    voiceId: string,
    text: string,
    signal: AbortSignal,
  ): Promise<ArrayBuffer | undefined> {
    if (signal.aborted) return undefined;
    const key = this.#cacheKey(voiceId, text);
    const cached = this.#audioCache.get(key);
    if (cached) return cached.slice(0);

    const settings = getLiteLLMSettings();
    if (!settings) throw new Error('LiteLLM endpoint is not configured');
    const response = await litellmFetch(
      settings,
      '/audio/speech',
      {
        method: 'POST',
        body: JSON.stringify({
          model: settings.ttsModel,
          voice: voiceId,
          input: text,
          response_format: 'mp3',
          speed: 1.0,
        }),
      },
      signal,
    );
    if (!response.ok) {
      if (response.status === 400 || response.status === 404 || response.status === 422) {
        throw new Error(
          `TTS model or voice not supported by the endpoint (HTTP ${response.status})`,
        );
      }
      throw new Error(`TTS request failed with status ${response.status}`);
    }
    const data = await response.arrayBuffer();
    if (this.#audioCache.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.#audioCache.keys().next().value;
      if (oldest !== undefined) this.#audioCache.delete(oldest);
    }
    this.#audioCache.set(key, data.slice(0));
    return data;
  }

  async *speak(ssml: string, signal: AbortSignal, preload = false) {
    const { marks } = parseSSMLMarks(ssml, this.#primaryLang);

    if (preload) {
      // Warm the cache for the first couple of sentences so playback can begin
      // promptly, then yield. Errors are swallowed — a failed prefetch simply
      // means the real speak() path refetches.
      const voiceId = this.getVoiceId();
      for (let i = 0; i < Math.min(2, marks.length); i++) {
        if (signal.aborted) break;
        try {
          await this.#fetchAudio(voiceId, marks[i]!.text, signal);
        } catch {
          /* ignore preload failures */
        }
      }
      yield { code: 'end', message: 'Preload finished' } as TTSMessageEvent;
      return;
    }

    await this.stopInternal();

    const queue = new AsyncQueue<SpeakQueueEvent>();
    const chunkMeta: ChunkMeta[] = [];
    this.#activeQueue = queue;
    this.#chunkMeta = chunkMeta;

    const generation = this.#player.startSession((event: WebAudioPlayerEvent) => {
      if (event.type === 'chunk-start') {
        queue.push({ kind: 'chunk-start', index: event.chunkIndex });
      } else if (event.type === 'session-end') {
        queue.push({ kind: 'session-end' });
      } else {
        queue.push({ kind: 'error', message: event.message });
      }
    });
    this.#activeGeneration = generation;
    await this.#player.ensureContext();
    this.#isPlaying = true;

    this.#runScheduler(marks, signal, generation, queue, chunkMeta);

    let abortHandler: (() => void) | null = null;
    try {
      if (signal.aborted) {
        yield { code: 'error', message: 'Aborted' } as TTSMessageEvent;
        return;
      }
      abortHandler = () => queue.push({ kind: 'error', message: 'Aborted' });
      signal.addEventListener('abort', abortHandler);

      for (;;) {
        const event = await queue.next();
        if (event.kind === 'chunk-start') {
          const meta = chunkMeta[event.index];
          if (!meta) continue;
          this.controller?.dispatchSpeakMark(meta.mark);
          yield {
            code: 'boundary',
            message: `Start chunk: ${meta.mark.name}`,
            mark: meta.mark.name,
          } as TTSMessageEvent;
        } else if (event.kind === 'chunk-skip') {
          yield { code: 'end', message: `Chunk skipped: ${event.markName}` } as TTSMessageEvent;
        } else if (event.kind === 'session-end') {
          yield { code: 'end', message: 'Speak finished' } as TTSMessageEvent;
          return;
        } else {
          yield { code: 'error', message: event.message } as TTSMessageEvent;
          return;
        }
      }
    } finally {
      if (abortHandler) signal.removeEventListener('abort', abortHandler);
      this.#isPlaying = false;
      if (this.#activeGeneration === generation) {
        this.#activeGeneration = null;
        this.#activeQueue = null;
        this.#player.abortSession();
      }
    }
  }

  // Detached scheduler: fetch, decode/trim/stretch, and schedule chunks ahead of
  // the playhead under the player's backpressure. Never throws; failures surface
  // through the event queue (mirrors EdgeTTSClient#runScheduler).
  async #runScheduler(
    marks: TTSMark[],
    signal: AbortSignal,
    generation: number,
    queue: AsyncQueue<SpeakQueueEvent>,
    chunkMeta: ChunkMeta[],
  ): Promise<void> {
    const rate = this.#rate;
    const voiceId = this.getVoiceId();
    try {
      for (const mark of marks) {
        if (signal.aborted || this.#activeGeneration !== generation) return;
        this.#speakingLang = mark.language;

        let data: ArrayBuffer | undefined;
        try {
          data = await this.#fetchAudio(voiceId, mark.text, signal);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('LiteLLM TTS fetch failed for mark:', mark.text, message);
          queue.push({ kind: 'error', message });
          return;
        }
        if (!data || signal.aborted || this.#activeGeneration !== generation) return;

        let prepared: { buffer: TTSAudioBuffer; trimStartSec: number; trimmedDurationSec: number };
        try {
          prepared = await this.#prepareChunkBuffer(data, rate);
        } catch (error) {
          // Malformed audio must not dead-end the session; skip like Edge does.
          console.warn('Failed to decode LiteLLM TTS audio for:', mark.text, error);
          queue.push({ kind: 'chunk-skip', markName: mark.name });
          continue;
        }
        recordMeasuredDuration(voiceId, mark.text, prepared.trimmedDurationSec);
        calibrateVoiceRate(voiceId, mark.text, prepared.trimmedDurationSec);

        const ready = await this.#player.waitUntilReady(generation);
        if (!ready || signal.aborted) return;
        chunkMeta.push({
          mark,
          trimStartSec: prepared.trimStartSec,
          trimmedDurationSec: prepared.trimmedDurationSec,
        });
        this.#player.scheduleChunk(generation, prepared.buffer, {
          trimStartSec: prepared.trimStartSec,
          mediaScale: prepared.trimmedDurationSec / prepared.buffer.duration,
          gapSec: INTER_SENTENCE_GAP_SEC / rate,
        });
      }
      if (!signal.aborted && this.#activeGeneration === generation) {
        this.#player.endSession(generation);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      queue.push({ kind: 'error', message });
    }
  }

  async #prepareChunkBuffer(
    data: ArrayBuffer,
    rate: number,
  ): Promise<{ buffer: TTSAudioBuffer; trimStartSec: number; trimmedDurationSec: number }> {
    const decoded = await this.#player.decode(data);
    const sampleRate = decoded.sampleRate;
    const channel = decoded.getChannelData(0);
    const bounds = findSpeechBounds(channel, sampleRate);
    const startSample = Math.floor(bounds.startSec * sampleRate);
    const endSample = Math.min(channel.length, Math.ceil(bounds.endSec * sampleRate));
    const trimmed = channel.subarray(startSample, endSample);
    const trimmedDurationSec = trimmed.length / sampleRate;
    const samples = rate !== 1 ? timeStretch(trimmed, sampleRate, rate) : trimmed;
    const buffer = await this.#player.createMonoBuffer(samples, sampleRate);
    applyEdgeFade(buffer.getChannelData(0), sampleRate);
    return { buffer, trimStartSec: startSample / sampleRate, trimmedDurationSec };
  }

  async pause() {
    if (!this.#isPlaying) return true;
    await this.#player.pauseContext();
    return true;
  }

  async resume() {
    await this.#player.resumeContext();
    return true;
  }

  async stop() {
    await this.stopInternal();
  }

  private async stopInternal() {
    this.#isPlaying = false;
    if (this.#activeGeneration !== null) {
      this.#activeGeneration = null;
      this.#activeQueue?.push({ kind: 'error', message: 'Aborted' });
      this.#activeQueue = null;
      this.#player.abortSession();
    }
  }

  getChunkPosition(): number | null {
    const generation = this.#activeGeneration;
    if (generation === null) return null;
    const pos = this.#player.getPlaybackPosition(generation);
    if (!pos) return null;
    const meta = this.#chunkMeta[pos.chunkIndex];
    if (!meta) return null;
    return Math.min(Math.max(pos.mediaTimeSec - meta.trimStartSec, 0), meta.trimmedDurationSec);
  }

  async setRate(rate: number) {
    this.#rate = rate;
  }

  async setPitch() {
    // The OpenAI-compatible speech route has no pitch parameter; no-op.
  }

  async setVoice(voice: string) {
    if (voice && OPENAI_VOICE_IDS.includes(voice)) {
      this.#currentVoiceId = voice;
    }
  }

  #buildVoices(lang: string): TTSVoice[] {
    // Voices are language-agnostic, so tag them with the requested language;
    // that keeps them visible under whatever language the reader filters by.
    return OPENAI_VOICE_IDS.map((id) => ({
      id,
      name: `LiteLLM ${id.charAt(0).toUpperCase()}${id.slice(1)}`,
      lang,
      disabled: !this.initialized,
    }));
  }

  async getAllVoices(): Promise<TTSVoice[]> {
    return this.#buildVoices(this.#primaryLang || 'en');
  }

  async getVoices(lang: string): Promise<TTSVoicesGroup[]> {
    return [
      {
        id: 'litellm-tts',
        name: 'LiteLLM',
        voices: this.#buildVoices(lang),
        disabled: !this.initialized,
      },
    ];
  }

  setPrimaryLang(lang: string) {
    this.#primaryLang = lang;
  }

  supportsWordBoundaries(): boolean {
    return false;
  }

  getGranularities(): TTSGranularity[] {
    return ['sentence'];
  }

  getVoiceId(): string {
    return this.#currentVoiceId || getLiteLLMSettings()?.ttsVoice || OPENAI_VOICE_IDS[0]!;
  }

  getSpeakingLang(): string {
    return this.#speakingLang;
  }

  clearCache(): void {
    this.#audioCache.clear();
  }

  async shutdown(): Promise<void> {
    await this.stopInternal();
    await this.#player.shutdown();
    this.initialized = false;
    this.clearCache();
  }
}

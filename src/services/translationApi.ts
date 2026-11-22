import type { ToneId, TranslationAnalysis } from '../data/languages';

export interface StreamCallbacks {
  onChunk: (delta: string, accumulated: string) => void;
  onDone: (finalText: string) => void;
}

const HTML_API_FALLBACK_MESSAGE =
  'The translation API returned an HTML page instead of JSON. Ensure the Zaban server is running, or configure VITE_ZABAN_API_URL if hosted on a static site like GitHub Pages.';

function isLocalhostHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function getConfiguredApiBase(): string {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    const configured =
      typeof env?.VITE_ZABAN_API_URL === 'string' ? env.VITE_ZABAN_API_URL.trim() : '';
    if (!configured) return '';

    // Never redirect a remote HTTPS app (e.g. Cloud Run / GitHub Pages) to localhost
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const pageIsLocal = isLocalhostHost(window.location.hostname);
      if (!pageIsLocal) {
        try {
          const parsed = new URL(configured);
          if (isLocalhostHost(parsed.hostname)) {
            return '';
          }
        } catch {
          // relative path is fine
        }
      }
    }

    return configured;
  } catch {
    return '';
  }
}

export function buildApiUrl(path: string, baseOverride?: string): string {
  const base = (baseOverride ?? getConfiguredApiBase()).trim().replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) return normalizedPath;
  if (base.endsWith('/api') && (normalizedPath === '/api' || normalizedPath.startsWith('/api/'))) {
    return `${base}${normalizedPath.slice(4)}`;
  }
  return `${base}${normalizedPath}`;
}

export function isHtmlPayload(text: string, contentType?: string | null): boolean {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('text/html') || ct.includes('application/xhtml')) {
    return true;
  }
  const sample = text.trimStart().slice(0, 32).toLowerCase();
  return sample.startsWith('<!doctype') || sample.startsWith('<html') || sample.startsWith('<!--');
}

export async function parseJsonResponse<T>(
  response: Response,
  fallbackError: string
): Promise<T> {
  const contentType = response.headers.get('content-type');
  const rawText = await response.text();

  if (isHtmlPayload(rawText, contentType)) {
    throw new Error(HTML_API_FALLBACK_MESSAGE);
  }

  let parsed: unknown = null;
  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      if (!response.ok) {
        throw new Error(`${fallbackError} (${response.status}).`);
      }
      throw new Error('Received an unexpected non-JSON response from the translation server.');
    }
  }

  if (!response.ok) {
    const errMsg =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
        ? parsed.error
        : `${fallbackError} (${response.status}).`;
    throw new Error(errMsg);
  }

  if (parsed === null) {
    throw new Error('The translation server returned an empty response.');
  }

  return parsed as T;
}

export async function streamTranslation(
  params: {
    text: string;
    languageId: string;
    dialectId: string;
    tone: ToneId;
  },
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(buildApiUrl('/api/translate/stream'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    const rawText = await response.text();
    if (isHtmlPayload(rawText, contentType)) {
      throw new Error(HTML_API_FALLBACK_MESSAGE);
    }
    let message = `Translation request failed (${response.status}).`;
    try {
      const errBody = JSON.parse(rawText) as { error?: string };
      if (errBody?.error) message = errBody.error;
    } catch {
      // keep default error message
    }
    throw new Error(message);
  }

  if (contentType && contentType.toLowerCase().includes('text/html')) {
    throw new Error(HTML_API_FALLBACK_MESSAGE);
  }

  if (!response.body) {
    throw new Error('Streaming response body was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulated = '';
  let finalText = '';
  let checkedFirstChunk = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunkText = decoder.decode(value, { stream: true });
    if (!checkedFirstChunk && chunkText.trim().length > 0) {
      checkedFirstChunk = true;
      if (isHtmlPayload(chunkText, contentType)) {
        await reader.cancel().catch(() => {});
        throw new Error(HTML_API_FALLBACK_MESSAGE);
      }
    }
    buffer += chunkText;

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const rawEvent of events) {
      const line = rawEvent
        .split('\n')
        .find((l) => l.startsWith('data: '));
      if (!line) continue;

      let payload: { type?: string; delta?: string; translation?: string; error?: string };
      try {
        payload = JSON.parse(line.slice(6));
      } catch {
        continue;
      }

      if (payload.type === 'chunk' && typeof payload.delta === 'string') {
        accumulated += payload.delta;
        callbacks.onChunk(payload.delta, accumulated);
      } else if (payload.type === 'done' && typeof payload.translation === 'string') {
        finalText = payload.translation;
        callbacks.onDone(finalText);
      } else if (payload.type === 'error') {
        throw new Error(payload.error || 'Streaming translation error.');
      }
    }
  }

  return finalText || accumulated;
}

export async function fetchTranslationAnalysis(
  params: {
    sourceText: string;
    translatedText: string;
    languageId: string;
    dialectId: string;
    tone: ToneId;
  },
  signal?: AbortSignal
): Promise<TranslationAnalysis> {
  const response = await fetch(buildApiUrl('/api/translate/analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  return parseJsonResponse<TranslationAnalysis>(response, 'Could not load linguistic notes');
}

export interface BatchCompareResult {
  languageId: string;
  dialectId: string;
  translation: string;
  transliteration: string;
}

export async function fetchBatchComparison(
  params: {
    text: string;
    targets: Array<{ languageId: string; dialectId: string }>;
    tone: ToneId;
  },
  signal?: AbortSignal
): Promise<BatchCompareResult[]> {
  const response = await fetch(buildApiUrl('/api/translate/batch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const data = await parseJsonResponse<{ results?: BatchCompareResult[] }>(
    response,
    'Could not complete multi-language comparison'
  );
  return data.results ?? [];
}

export async function fetchSpeechAudio(
  params: {
    text: string;
    languageId: string;
    dialectId: string;
  },
  signal?: AbortSignal
): Promise<{ audioBase64: string; mimeType: string }> {
  const response = await fetch(buildApiUrl('/api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  return parseJsonResponse<{ audioBase64: string; mimeType: string }>(
    response,
    'Audio pronunciation failed'
  );
}

export async function translateSubtitleCues(
  params: {
    cues: Array<{ id: number; text: string }>;
    languageId: string;
    dialectId: string;
    tone: ToneId;
  },
  signal?: AbortSignal
): Promise<Array<{ id: number; translation: string }>> {
  const response = await fetch(buildApiUrl('/api/translate/cues'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const data = await parseJsonResponse<{
    translations?: Array<{ id: number; translation: string }>;
  }>(response, 'Subtitle batch translation failed');
  return data.translations ?? [];
}

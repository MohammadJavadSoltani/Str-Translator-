import type { ToneId, TranslationAnalysis } from '../data/languages';

export interface StreamCallbacks {
  onChunk: (delta: string, accumulated: string) => void;
  onDone: (finalText: string) => void;
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
  const response = await fetch('/api/translate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  if (!response.ok) {
    let message = `Translation request failed (${response.status}).`;
    try {
      const errBody = await response.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore JSON parse failure on non-JSON error
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Streaming response body was empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulated = '';
  let finalText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const rawEvent of events) {
      const line = rawEvent
        .split('\n')
        .find((l) => l.startsWith('data: '));
      if (!line) continue;

      const payload = JSON.parse(line.slice(6));
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
  const response = await fetch('/api/translate/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Could not load linguistic notes.');
  }
  return data as TranslationAnalysis;
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
  const response = await fetch('/api/translate/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Could not complete multi-language comparison.');
  }
  return (data.results ?? []) as BatchCompareResult[];
}

export async function fetchSpeechAudio(
  params: {
    text: string;
    languageId: string;
    dialectId: string;
  },
  signal?: AbortSignal
): Promise<{ audioBase64: string; mimeType: string }> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Audio pronunciation failed.');
  }
  return data as { audioBase64: string; mimeType: string };
}

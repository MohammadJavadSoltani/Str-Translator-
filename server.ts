import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  buildAnalysisSystemPrompt,
  buildTranslationSystemPrompt,
  getDialectById,
  getLanguageById,
  normalizePersianTypography,
  validateSourceText,
} from './src/utils/translationUtils.ts';
import type { ToneId } from './src/data/languages.ts';
import {
  isRateLimitError,
  isRetryableModelError,
  isTransientServiceError,
  LruCache,
  selectModelPlan,
} from './src/utils/rateLimitUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Fast, high-RPM model primary for responsive real-time streaming & fluent Persian;
// gemini-4-hydrogen serves as automatic fallback with strict timeout protection.
const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-4-hydrogen';
const PRIMARY_COOLDOWN_MS = 30_000;
const UNARY_TIMEOUT_MS = 18_000;
const STREAM_FIRST_CHUNK_TIMEOUT_MS = 12_000;

let primaryCooldownUntil = 0;

// In-memory LRU caches avoid duplicate Gemini requests for repeated translations/dialects
const translationCache = new LruCache<string>(250);
const analysisCache = new LruCache<Record<string, unknown>>(150);
const batchCache = new LruCache<
  Array<{ languageId: string; dialectId: string; translation: string; transliteration: string }>
>(100);
const cueBatchCache = new LruCache<Array<{ id: number; translation: string }>>(120);
const ttsCache = new LruCache<{ audioBase64: string; mimeType: string }>(60);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`REQUEST_TIMEOUT: ${label} exceeded ${ms}ms`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function markCooldownIfPrimary(model: string, err: unknown): void {
  if (model === PRIMARY_MODEL && isRetryableModelError(err)) {
    primaryCooldownUntil = Date.now() + PRIMARY_COOLDOWN_MS;
  }
}

async function generateWithRetry<T>(
  run: (model: string, useThinkingLow: boolean) => Promise<T>,
  options?: { preferFallback?: boolean; timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? UNARY_TIMEOUT_MS;
  const plan = selectModelPlan({
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    preferFallback: options?.preferFallback,
    primaryCooldownUntil,
  });

  let lastErr: unknown;
  for (let i = 0; i < plan.length; i += 1) {
    const candidate = plan[i];
    try {
      return await withTimeout(
        run(candidate.model, candidate.useThinkingLow),
        timeoutMs,
        candidate.model
      );
    } catch (err) {
      lastErr = err;
      markCooldownIfPrimary(candidate.model, err);
      if (!isRetryableModelError(err)) throw err;
      if (i < plan.length - 1) {
        await sleep(250);
      }
    }
  }

  // Final short backoff retry on the primary high-throughput model for brief burst 429s
  if (isRetryableModelError(lastErr)) {
    await sleep(1000);
    return await withTimeout(run(PRIMARY_MODEL, false), timeoutMs, PRIMARY_MODEL);
  }

  throw lastErr;
}

function mapGeminiError(err: unknown, context?: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[Zaban API${context ? ` ${context}` : ''}]`, raw.slice(0, 400));
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, message: raw };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'API key was rejected. Please verify your key in Settings > Secrets.',
    };
  }
  if (isRateLimitError(err)) {
    return {
      status: 429,
      message:
        'API rate limit reached on the current key. Wait a few seconds and retry, or select a billing-enabled API key in Settings > Secrets for higher limits.',
    };
  }
  if (isTransientServiceError(err)) {
    return {
      status: 503,
      message: 'The translation model is temporarily busy. Please retry in a moment.',
    };
  }
  return {
    status: 500,
    message: 'Translation request failed. Please try again.',
  };
}

const VALID_TONES: ToneId[] = ['natural', 'formal', 'casual', 'literary', 'concise'];

function parseTone(tone: unknown): ToneId {
  return typeof tone === 'string' && VALID_TONES.includes(tone as ToneId)
    ? (tone as ToneId)
    : 'natural';
}

function parseModelJson<T>(raw: string | undefined, fallback: string): T {
  const cleaned = (raw ?? fallback)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned || fallback) as T;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Allow cross-origin requests to /api/* when the static client (e.g. GitHub Pages)
  // is configured with VITE_API_BASE_URL pointing to a hosted Zaban server.
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Real-time SSE streaming translation endpoint
  app.post('/api/translate/stream', async (req, res) => {
    const { text, languageId = 'fa', dialectId, tone } = req.body ?? {};
    const validation = validateSourceText(typeof text === 'string' ? text : '');
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const lang = getLanguageById(String(languageId));
    const dialect = getDialectById(lang.id, String(dialectId || lang.defaultDialectId));
    const safeTone = parseTone(tone);

    let ai: GoogleGenAI;
    try {
      ai = getAiClient();
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
      return;
    }

    const cacheKey = `${lang.id}|${dialect.id}|${safeTone}|${validation.trimmed}`;
    const cachedTranslation = translationCache.get(cacheKey);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (cachedTranslation) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', delta: cachedTranslation })}\n\n`);
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          translation: cachedTranslation,
          languageId: lang.id,
          dialectId: dialect.id,
          tone: safeTone,
        })}\n\n`
      );
      res.end();
      return;
    }

    let clientClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
      }
    });

    try {
      const systemInstruction = buildTranslationSystemPrompt(lang.id, dialect.id, safeTone);

      let fullText = '';
      const streamFromModel = async (model: string, useThinkingLow: boolean) => {
        const stream = await withTimeout(
          ai.models.generateContentStream({
            model,
            contents: validation.trimmed,
            config: {
              systemInstruction,
              ...(useThinkingLow ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            },
          }),
          STREAM_FIRST_CHUNK_TIMEOUT_MS,
          `${model} stream init`
        );

        const iterator = stream[Symbol.asyncIterator]();
        let gotFirstChunk = false;
        while (true) {
          const nextStep = gotFirstChunk
            ? await withTimeout(iterator.next(), UNARY_TIMEOUT_MS, `${model} chunk`)
            : await withTimeout(
                iterator.next(),
                STREAM_FIRST_CHUNK_TIMEOUT_MS,
                `${model} first chunk`
              );
          if (nextStep.done || clientClosed) break;
          const delta = nextStep.value?.text ?? '';
          if (delta) {
            gotFirstChunk = true;
            fullText += delta;
            res.write(`data: ${JSON.stringify({ type: 'chunk', delta })}\n\n`);
          }
        }
      };

      const plan = selectModelPlan({
        primaryModel: PRIMARY_MODEL,
        fallbackModel: FALLBACK_MODEL,
        primaryCooldownUntil,
      });

      let streamedOk = false;
      let lastErr: unknown;
      for (let i = 0; i < plan.length; i += 1) {
        const candidate = plan[i];
        try {
          await streamFromModel(candidate.model, candidate.useThinkingLow);
          streamedOk = true;
          break;
        } catch (err) {
          lastErr = err;
          markCooldownIfPrimary(candidate.model, err);
          if (clientClosed || fullText.length > 0 || !isRetryableModelError(err)) {
            throw err;
          }
          if (i < plan.length - 1) {
            await sleep(250);
          }
        }
      }

      if (!streamedOk && !clientClosed && fullText.length === 0) {
        if (isRetryableModelError(lastErr)) {
          await sleep(1000);
          await streamFromModel(PRIMARY_MODEL, false);
        } else {
          throw lastErr;
        }
      }

      if (!clientClosed) {
        const finalTranslation =
          lang.id === 'fa' ? normalizePersianTypography(fullText) : fullText.trim();
        if (finalTranslation) {
          translationCache.set(cacheKey, finalTranslation);
        }
        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            translation: finalTranslation,
            languageId: lang.id,
            dialectId: dialect.id,
            tone: safeTone,
          })}\n\n`
        );
        res.end();
      }
    } catch (err) {
      if (!clientClosed) {
        const mapped = mapGeminiError(err, 'stream');
        res.write(`data: ${JSON.stringify({ type: 'error', error: mapped.message })}\n\n`);
        res.end();
      }
    }
  });

  // Detailed linguistic breakdown: transliteration, idiom notes, alternatives, key phrases
  app.post('/api/translate/analyze', async (req, res) => {
    const { sourceText, translatedText, languageId = 'fa', dialectId, tone } = req.body ?? {};
    const validation = validateSourceText(typeof sourceText === 'string' ? sourceText : '');
    if (!validation.valid || typeof translatedText !== 'string' || !translatedText.trim()) {
      res.status(400).json({ error: 'Both sourceText and translatedText are required.' });
      return;
    }

    const lang = getLanguageById(String(languageId));
    const dialect = getDialectById(lang.id, String(dialectId || lang.defaultDialectId));
    const safeTone = parseTone(tone);

    const analysisKey = `${lang.id}|${dialect.id}|${safeTone}|${validation.trimmed}|${translatedText.trim()}`;
    const cachedAnalysis = analysisCache.get(analysisKey);
    if (cachedAnalysis) {
      res.json(cachedAnalysis);
      return;
    }

    try {
      const ai = getAiClient();
      const systemInstruction = buildAnalysisSystemPrompt(lang.id, dialect.id, safeTone);
      const prompt = [
        `English source:\n${validation.trimmed}`,
        `\n${lang.name} (${dialect.name}) translation:\n${translatedText.trim()}`,
      ].join('\n');

      const response = await generateWithRetry((model, useThinkingLow) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            ...(useThinkingLow ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transliteration: {
                  type: Type.STRING,
                  description: 'Natural phonetic Latin transliteration, or empty string if Latin script.',
                },
                registerNote: {
                  type: Type.STRING,
                  description: 'One concise sentence explaining the register and dialect tone.',
                },
                idiomNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '1 to 3 concise notes about idiomatic or structural fluency choices.',
                },
                alternatives: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      style: { type: Type.STRING },
                      text: { type: Type.STRING },
                      explanation: { type: Type.STRING },
                    },
                    required: ['style', 'text', 'explanation'],
                  },
                  description: '2 to 3 nuanced alternative translations.',
                },
                keyPhrases: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      source: { type: Type.STRING },
                      target: { type: Type.STRING },
                      note: { type: Type.STRING },
                    },
                    required: ['source', 'target', 'note'],
                  },
                  description: '2 to 5 key phrase pairings.',
                },
              },
              required: ['transliteration', 'registerNote', 'idiomNotes', 'alternatives', 'keyPhrases'],
            },
          },
        })
      );

      const parsed = parseModelJson<Record<string, unknown>>(response.text, '{}');

      if (lang.id === 'fa') {
        if (Array.isArray(parsed.alternatives)) {
          parsed.alternatives = parsed.alternatives.map(
            (alt: { style: string; text: string; explanation: string }) => ({
              ...alt,
              text: normalizePersianTypography(alt.text ?? ''),
            })
          );
        }
        if (Array.isArray(parsed.keyPhrases)) {
          parsed.keyPhrases = parsed.keyPhrases.map(
            (kp: { source: string; target: string; note: string }) => ({
              ...kp,
              target: normalizePersianTypography(kp.target ?? ''),
            })
          );
        }
      }

      analysisCache.set(analysisKey, parsed);
      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Multi-language comparison endpoint — consolidated into ONE Gemini API call to preserve RPM quota
  app.post('/api/translate/batch', async (req, res) => {
    const { text, targets, tone } = req.body ?? {};
    const validation = validateSourceText(typeof text === 'string' ? text : '');
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
    if (!Array.isArray(targets) || targets.length === 0 || targets.length > 6) {
      res.status(400).json({ error: 'Provide between 1 and 6 target languages.' });
      return;
    }

    const safeTone = parseTone(tone);
    const resolvedTargets = targets.map(
      (item: { languageId?: string; dialectId?: string }, index: number) => {
        const lang = getLanguageById(String(item.languageId || 'fa'));
        const dialect = getDialectById(lang.id, String(item.dialectId || lang.defaultDialectId));
        return { index, lang, dialect };
      }
    );

    const batchKey = `${safeTone}|${resolvedTargets
      .map((t) => `${t.lang.id}:${t.dialect.id}`)
      .join(',')}|${validation.trimmed}`;
    const cachedBatch = batchCache.get(batchKey);
    if (cachedBatch) {
      res.json({ results: cachedBatch });
      return;
    }

    try {
      const ai = getAiClient();
      const targetSpec = resolvedTargets
        .map(
          ({ index, lang, dialect }) =>
            `[${index}] ${lang.name} (${lang.nativeName}) — Dialect: ${dialect.name} (${dialect.region}). Style directive: ${dialect.promptDirectives}. ${
              lang.needsTransliteration
                ? 'Provide a natural Latin phonetic transliteration.'
                : 'Set transliteration to an empty string.'
            }`
        )
        .join('\n');

      const systemInstruction = [
        `You are an elite multilingual translator producing natural, native-fluent translations in a "${safeTone}" tone.`,
        'For any Persian (fa) target, strictly use Persian ی/ک and half-space ZWNJ (نیم‌فاصله) with completely idiomatic Persian phrasing.',
        'Translate the English input for every numbered target below and return a JSON array with one entry per index.',
        targetSpec,
      ].join('\n\n');

      const response = await generateWithRetry((model, useThinkingLow) =>
        ai.models.generateContent({
          model,
          contents: validation.trimmed,
          config: {
            systemInstruction,
            ...(useThinkingLow ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  translation: { type: Type.STRING },
                  transliteration: { type: Type.STRING },
                },
                required: ['index', 'translation', 'transliteration'],
              },
            },
          },
        })
      );

      const parsed = parseModelJson<
        Array<{ index: number; translation?: string; transliteration?: string }>
      >(response.text, '[]');

      const byIndex = new Map<number, { translation: string; transliteration: string }>();
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          byIndex.set(Number(row.index), {
            translation: String(row.translation ?? '').trim(),
            transliteration: String(row.transliteration ?? '').trim(),
          });
        }
      }

      const results = resolvedTargets.map(({ index, lang, dialect }) => {
        const hit = byIndex.get(index) ?? { translation: '', transliteration: '' };
        return {
          languageId: lang.id,
          dialectId: dialect.id,
          translation:
            lang.id === 'fa' ? normalizePersianTypography(hit.translation) : hit.translation,
          transliteration: hit.transliteration,
        };
      });

      batchCache.set(batchKey, results);
      res.json({ results });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Subtitle / .str cue batch translation preserving exact cue IDs and natural screen cadence
  app.post('/api/translate/cues', async (req, res) => {
    const { cues, languageId = 'fa', dialectId, tone } = req.body ?? {};
    if (!Array.isArray(cues) || cues.length === 0 || cues.length > 50) {
      res.status(400).json({ error: 'Provide between 1 and 50 subtitle cues per batch.' });
      return;
    }

    const sanitized = cues
      .map((item: { id?: unknown; text?: unknown }) => ({
        id: Number(item?.id),
        text: typeof item?.text === 'string' ? item.text.trim() : '',
      }))
      .filter((item) => Number.isFinite(item.id) && item.text.length > 0);

    if (sanitized.length === 0) {
      res.status(400).json({ error: 'No valid subtitle cue text was provided.' });
      return;
    }

    const lang = getLanguageById(String(languageId));
    const dialect = getDialectById(lang.id, String(dialectId || lang.defaultDialectId));
    const safeTone = parseTone(tone);

    const cueKey = `${lang.id}|${dialect.id}|${safeTone}|${JSON.stringify(sanitized)}`;
    const cachedCues = cueBatchCache.get(cueKey);
    if (cachedCues) {
      res.json({ translations: cachedCues });
      return;
    }

    try {
      const ai = getAiClient();
      const baseInstruction = buildTranslationSystemPrompt(lang.id, dialect.id, safeTone);
      const subtitleInstruction = [
        baseInstruction,
        'SUBTITLE BATCH RULES:',
        '- You are translating sequential subtitle cues from a single scene or file.',
        '- Preserve conversational continuity, speaker tone, and concise readability across cues.',
        '- Return a JSON array with one entry per input cue, matching every numeric "id" exactly.',
      ].join('\n');

      const response = await generateWithRetry((model, useThinkingLow) =>
        ai.models.generateContent({
          model,
          contents: JSON.stringify(sanitized),
          config: {
            systemInstruction: subtitleInstruction,
            ...(useThinkingLow ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  translation: { type: Type.STRING },
                },
                required: ['id', 'translation'],
              },
            },
          },
        })
      );

      const parsed = parseModelJson<Array<{ id: number; translation: string }>>(
        response.text,
        '[]'
      );
      const items = Array.isArray(parsed)
        ? parsed.map((row: { id: number; translation: string }) => {
            const raw = String(row.translation ?? '').trim();
            return {
              id: Number(row.id),
              translation: lang.id === 'fa' ? normalizePersianTypography(raw) : raw,
            };
          })
        : [];

      if (items.length > 0) {
        cueBatchCache.set(cueKey, items);
      }
      res.json({ translations: items });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // High-quality Gemini TTS pronunciation playback (supports Persian & all languages)
  app.post('/api/tts', async (req, res) => {
    const { text, languageId = 'fa', dialectId } = req.body ?? {};
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
      res.status(400).json({ error: 'Text is required for audio pronunciation.' });
      return;
    }
    if (trimmed.length > 1200) {
      res.status(400).json({ error: 'Audio playback supports up to 1,200 characters at once.' });
      return;
    }

    const lang = getLanguageById(String(languageId));
    const dialect = getDialectById(lang.id, String(dialectId || lang.defaultDialectId));

    const ttsKey = `${lang.id}|${dialect.id}|${trimmed}`;
    const cachedTts = ttsCache.get(ttsKey);
    if (cachedTts) {
      res.json(cachedTts);
      return;
    }

    try {
      // Gemini 3.8 TTS speechConfig & speechMetadata require v1beta
      const ai = getAiClient('v1beta');
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: trimmed,
                  speechMetadata: {
                    style: `Clear, natural native ${lang.name} (${dialect.name}) speaker with warm, measured cadence`,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        }),
        UNARY_TIMEOUT_MS,
        'gemini-3.8-flash-lite-tts'
      );

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Audio pronunciation could not be generated.' });
        return;
      }

      const payload = {
        audioBase64: base64Audio,
        mimeType: inlineData?.mimeType || 'audio/wav',
      };
      ttsCache.set(ttsKey, payload);
      res.json(payload);
    } catch (err) {
      const mapped = mapGeminiError(err, 'tts');
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Guarantee unmatched /api/* routes never fall through to HTML (index.html)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Guarantee Express body-parser or middleware errors on /api/* return JSON, never HTML
  app.use(
    (
      err: { status?: number; statusCode?: number; type?: string; message?: string },
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (!req.path.startsWith('/api')) {
        next(err);
        return;
      }
      const status =
        typeof err?.status === 'number'
          ? err.status
          : typeof err?.statusCode === 'number'
          ? err.statusCode
          : 500;
      const message =
        err?.type === 'entity.too.large'
          ? 'Request payload is too large. Please try a smaller text or file.'
          : err?.type === 'entity.parse.failed'
          ? 'Invalid JSON request body.'
          : err?.message || 'Unexpected server error.';
      res.status(status).json({ error: message });
    }
  );

  if (IS_PROD) {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zaban server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

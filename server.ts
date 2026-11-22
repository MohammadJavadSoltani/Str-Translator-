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
} from './src/utils/translationUtils';
import type { ToneId } from './src/data/languages';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, message: raw };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'API key was rejected. Please verify your key in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit reached. Please pause a moment and try again.',
    };
  }
  return {
    status: 500,
    message: raw || 'Translation request failed. Please try again.',
  };
}

const VALID_TONES: ToneId[] = ['natural', 'formal', 'casual', 'literary', 'concise'];

function parseTone(tone: unknown): ToneId {
  return typeof tone === 'string' && VALID_TONES.includes(tone as ToneId)
    ? (tone as ToneId)
    : 'natural';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
    });

    try {
      const systemInstruction = buildTranslationSystemPrompt(lang.id, dialect.id, safeTone);
      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: validation.trimmed,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      let fullText = '';
      for await (const chunk of stream) {
        if (clientClosed) break;
        const delta = chunk.text ?? '';
        if (delta) {
          fullText += delta;
          res.write(`data: ${JSON.stringify({ type: 'chunk', delta })}\n\n`);
        }
      }

      if (!clientClosed) {
        const finalTranslation =
          lang.id === 'fa' ? normalizePersianTypography(fullText) : fullText.trim();
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
        const mapped = mapGeminiError(err);
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

    try {
      const ai = getAiClient();
      const systemInstruction = buildAnalysisSystemPrompt(lang.id, dialect.id, safeTone);
      const prompt = [
        `English source:\n${validation.trimmed}`,
        `\n${lang.name} (${dialect.name}) translation:\n${translatedText.trim()}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
      });

      const rawJson = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawJson);

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

      res.json(parsed);
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Multi-language parallel comparison endpoint
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

    try {
      const ai = getAiClient();
      const results = await Promise.all(
        targets.map(async (item: { languageId?: string; dialectId?: string }) => {
          const lang = getLanguageById(String(item.languageId || 'fa'));
          const dialect = getDialectById(lang.id, String(item.dialectId || lang.defaultDialectId));

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: validation.trimmed,
            config: {
              systemInstruction: buildTranslationSystemPrompt(lang.id, dialect.id, safeTone) +
                (lang.needsTransliteration
                  ? '\nReturn JSON with fields "translation" and "transliteration".'
                  : '\nReturn JSON with fields "translation" and "transliteration" (empty string).'),
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  translation: { type: Type.STRING },
                  transliteration: { type: Type.STRING },
                },
                required: ['translation', 'transliteration'],
              },
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim());
          const rawText = String(parsed.translation ?? '').trim();
          return {
            languageId: lang.id,
            dialectId: dialect.id,
            translation: lang.id === 'fa' ? normalizePersianTypography(rawText) : rawText,
            transliteration: String(parsed.transliteration ?? '').trim(),
          };
        })
      );

      res.json({ results });
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

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
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
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Audio pronunciation could not be generated.' });
        return;
      }

      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

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

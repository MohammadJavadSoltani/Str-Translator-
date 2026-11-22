import {
  LANGUAGES,
  TONES,
  type DialectOption,
  type HistoryEntry,
  type LanguageOption,
  type ToneId,
} from '../data/languages';

export const MAX_SOURCE_CHARS = 4000;

export interface TextMetrics {
  chars: number;
  words: number;
  sentences: number;
  readingSeconds: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  trimmed: string;
}

export function getLanguageById(id: string): LanguageOption {
  return LANGUAGES.find((lang) => lang.id === id) ?? LANGUAGES[0];
}

export function getDialectById(languageId: string, dialectId: string): DialectOption {
  const language = getLanguageById(languageId);
  return (
    language.dialects.find((d) => d.id === dialectId) ??
    language.dialects.find((d) => d.id === language.defaultDialectId) ??
    language.dialects[0]
  );
}

export function isRtlLanguage(languageId: string): boolean {
  return getLanguageById(languageId).dir === 'rtl';
}

/**
 * Normalizes Persian script conventions:
 * - Converts Arabic Yeh (ي) and Kaf (ك) into standard Persian ی and ک
 * - Inserts standard Persian ZWNJ (half-space, \u200c) after می/نمی prefixes when typed with a regular space
 * - Collapses stray spaces before punctuation while preserving intentional line breaks
 */
export function normalizePersianTypography(text: string): string {
  if (!text) return '';
  return text
    .replace(/\u064a/g, '\u06cc') // Arabic yeh -> Persian yeh
    .replace(/\u0643/g, '\u06a9') // Arabic kaf -> Persian kaf
    .replace(/(^|[\s\u200c،؛.؟!«(])(ن?می)\s+([\u0600-\u06FF])/g, '$1$2\u200c$3')
    .replace(/([ \t]+)([،؛؟!.])/g, '$2')
    .trim();
}

export function analyzeTextMetrics(text: string): TextMetrics {
  const trimmed = text.trim();
  if (!trimmed) {
    return { chars: 0, words: 0, sentences: 0, readingSeconds: 0 };
  }
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const sentences = trimmed
    .split(/[.!?؟؛\n]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const readingSeconds = Math.max(1, Math.ceil((words / 180) * 60));
  return {
    chars: text.length,
    words,
    sentences: Math.max(1, sentences),
    readingSeconds,
  };
}

export function validateSourceText(text: string): ValidationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Enter an English sentence or paragraph to translate.',
      trimmed: '',
    };
  }
  if (trimmed.length > MAX_SOURCE_CHARS) {
    return {
      valid: false,
      error: `Text exceeds the ${MAX_SOURCE_CHARS.toLocaleString()} character limit.`,
      trimmed,
    };
  }
  return { valid: true, trimmed };
}

export function buildTranslationSystemPrompt(
  languageId: string,
  dialectId: string,
  toneId: ToneId
): string {
  const language = getLanguageById(languageId);
  const dialect = getDialectById(languageId, dialectId);
  const tone = TONES.find((t) => t.id === toneId) ?? TONES[0];

  const persianQualityBlock =
    language.id === 'fa'
      ? [
          'PERSIAN FLUENCY & ORTHOGRAPHY MANDATE:',
          '- Your Persian MUST read as if originally written by an accomplished native Persian writer or speaker—never stiff, robotic, or translated word-for-word from English.',
          '- Respect natural Persian SOV syntax, ezafe cadence, and authentic idioms.',
          '- Always use standard Persian letters (ی and ک, never Arabic ي or ك).',
          '- Strictly apply the Persian half-space / ZWNJ (نیم‌فاصله) for verb prefixes (می‌روم، نمی‌توانم), plural suffixes (کتاب‌ها، سال‌ها), and compound words (خوش‌آمدید، پیش‌نویس).',
          '- Preserve paragraph breaks and formatting of the source text.',
        ].join('\n')
      : 'Preserve natural native idioms, rhythm, punctuation conventions, and paragraph structure of the target language.';

  return [
    `You are an elite literary and conversational translator specializing in translating English into ${language.name} (${language.nativeName}).`,
    `Target Dialect / Variant: ${dialect.name} (${dialect.nativeName} — ${dialect.region}).`,
    `Dialect Instructions: ${dialect.promptDirectives}`,
    `Requested Tone: ${tone.label} — ${tone.promptDirective}`,
    persianQualityBlock,
    'OUTPUT RULE: Return ONLY the fluent translated text itself. Do not wrap it in quotes, do not include markdown code fences, and do not add commentary or explanations.',
  ].join('\n\n');
}

export function buildAnalysisSystemPrompt(
  languageId: string,
  dialectId: string,
  toneId: ToneId
): string {
  const language = getLanguageById(languageId);
  const dialect = getDialectById(languageId, dialectId);
  const tone = TONES.find((t) => t.id === toneId) ?? TONES[0];

  return [
    `You are a bilingual linguistic editor analyzing an English-to-${language.name} (${dialect.name}, ${tone.label} tone) translation.`,
    language.needsTransliteration
      ? `Provide a clear, readable Latin-script phonetic transliteration of the translation that reflects natural ${dialect.name} pronunciation.`
      : 'Leave transliteration as an empty string since the target language already uses Latin script.',
    'Provide:',
    '1. A concise 1-sentence registerNote describing the dialect/register voice achieved.',
    '2. 1 to 3 concise idiomNotes explaining specific fluent phrasing choices (especially where an English idiom or rhythm was adapted naturally instead of literally).',
    '3. 2 to 3 distinct alternative renderings in the same language (e.g., Warmer, More Formal, More Concise) with a short English explanation of the nuance.',
    '4. 2 to 5 keyPhrases mapping notable English phrases to their fluent target equivalents with a brief note.',
    language.id === 'fa'
      ? 'Ensure all Persian strings use proper Persian ی/ک and half-space (ZWNJ) orthography.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function upsertHistoryEntry(
  history: HistoryEntry[],
  entry: Omit<HistoryEntry, 'id' | 'createdAt' | 'starred'>,
  maxEntries = 40
): HistoryEntry[] {
  const normalizedSource = entry.sourceText.trim();
  const normalizedTarget = entry.translatedText.trim();
  if (!normalizedSource || !normalizedTarget) return history;

  const existingIndex = history.findIndex(
    (item) =>
      item.sourceText.trim() === normalizedSource &&
      item.languageId === entry.languageId &&
      item.dialectId === entry.dialectId &&
      item.tone === entry.tone
  );

  const now = Date.now();
  if (existingIndex !== -1) {
    const existing = history[existingIndex];
    const updated: HistoryEntry = {
      ...existing,
      translatedText: normalizedTarget,
      transliteration: entry.transliteration ?? existing.transliteration,
      createdAt: now,
    };
    const rest = history.filter((_, idx) => idx !== existingIndex);
    return [updated, ...rest].slice(0, maxEntries);
  }

  const created: HistoryEntry = {
    id: `tr-${now}-${Math.random().toString(36).slice(2, 7)}`,
    sourceText: normalizedSource,
    translatedText: normalizedTarget,
    transliteration: entry.transliteration,
    languageId: entry.languageId,
    dialectId: entry.dialectId,
    tone: entry.tone,
    createdAt: now,
    starred: false,
  };

  return [created, ...history].slice(0, maxEntries);
}

export function toggleHistoryStar(history: HistoryEntry[], id: string): HistoryEntry[] {
  return history.map((item) =>
    item.id === id ? { ...item, starred: !item.starred } : item
  );
}

export function deleteHistoryEntry(history: HistoryEntry[], id: string): HistoryEntry[] {
  return history.filter((item) => item.id !== id);
}

export function filterHistoryEntries(
  history: HistoryEntry[],
  query: string,
  options?: { languageId?: string; starredOnly?: boolean }
): HistoryEntry[] {
  const q = query.trim().toLowerCase();
  return history.filter((item) => {
    if (options?.starredOnly && !item.starred) return false;
    if (options?.languageId && options.languageId !== 'all' && item.languageId !== options.languageId) {
      return false;
    }
    if (!q) return true;
    const lang = getLanguageById(item.languageId);
    const dialect = getDialectById(item.languageId, item.dialectId);
    return (
      item.sourceText.toLowerCase().includes(q) ||
      item.translatedText.toLowerCase().includes(q) ||
      (item.transliteration?.toLowerCase().includes(q) ?? false) ||
      lang.name.toLowerCase().includes(q) ||
      dialect.name.toLowerCase().includes(q)
    );
  });
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, INITIAL_HISTORY } from '../data/languages';
import {
  analyzeTextMetrics,
  buildTranslationSystemPrompt,
  deleteHistoryEntry,
  filterHistoryEntries,
  getDialectById,
  getLanguageById,
  isRtlLanguage,
  MAX_SOURCE_CHARS,
  normalizePersianTypography,
  toggleHistoryStar,
  upsertHistoryEntry,
  validateSourceText,
} from './translationUtils';

test('language registry has valid default dialects and RTL detection', () => {
  assert.ok(LANGUAGES.length >= 10);
  assert.equal(getLanguageById('fa').name, 'Persian');
  assert.equal(isRtlLanguage('fa'), true);
  assert.equal(isRtlLanguage('ar'), true);
  assert.equal(isRtlLanguage('fr'), false);
  assert.equal(isRtlLanguage('ja'), false);

  for (const lang of LANGUAGES) {
    assert.ok(lang.dialects.length >= 2, `${lang.name} should expose multiple dialects`);
    const def = getDialectById(lang.id, lang.defaultDialectId);
    assert.equal(def.id, lang.defaultDialectId);
  }
});

test('normalizePersianTypography enforces Persian yeh/kaf and half-space ZWNJ', () => {
  const raw = 'من مي خواهم كتاب را بخريم و نمي دانم چه مي شود .';
  const normalized = normalizePersianTypography(raw);
  assert.equal(normalized.includes('\u064a'), false, 'Arabic yeh should be converted');
  assert.equal(normalized.includes('\u0643'), false, 'Arabic kaf should be converted');
  assert.equal(normalized.includes('می\u200cخواهم'), true, 'ZWNJ inserted after می');
  assert.equal(normalized.includes('نمی\u200cدانم'), true, 'ZWNJ inserted after نمی');
  assert.equal(normalized.includes('می\u200cشود.'), true, 'ZWNJ inserted and stray space before period removed');
});

test('validateSourceText rejects empty or oversized input', () => {
  assert.equal(validateSourceText('   \n  ').valid, false);
  assert.equal(validateSourceText('Hello world').valid, true);
  assert.equal(validateSourceText('a'.repeat(MAX_SOURCE_CHARS + 1)).valid, false);
});

test('analyzeTextMetrics computes words, chars, and sentences accurately', () => {
  const metrics = analyzeTextMetrics('Hello world. How are you today?');
  assert.equal(metrics.words, 6);
  assert.equal(metrics.sentences, 2);
  assert.equal(metrics.chars, 31);
  assert.equal(metrics.readingSeconds >= 1, true);

  const empty = analyzeTextMetrics('   ');
  assert.equal(empty.words, 0);
  assert.equal(empty.chars, 0);
});

test('buildTranslationSystemPrompt includes Persian dialect & orthography directives', () => {
  const tehraniPrompt = buildTranslationSystemPrompt('fa', 'fa-tehrani', 'casual');
  assert.match(tehraniPrompt, /Tehrani Conversational/);
  assert.match(tehraniPrompt, /ZWNJ|نیم‌فاصله/);
  assert.match(tehraniPrompt, /Casual/);

  const dariPrompt = buildTranslationSystemPrompt('fa', 'fa-dari', 'formal');
  assert.match(dariPrompt, /Dari/);
  assert.match(dariPrompt, /Formal/);
});

test('history helpers deduplicate, star, filter, and delete entries', () => {
  const added = upsertHistoryEntry(INITIAL_HISTORY, {
    sourceText: 'Good morning, friend.',
    translatedText: 'صبح بخیر رفیق.',
    languageId: 'fa',
    dialectId: 'fa-tehrani',
    tone: 'casual',
  });
  assert.equal(added.length, INITIAL_HISTORY.length + 1);
  assert.equal(added[0].sourceText, 'Good morning, friend.');

  // Updating identical source/lang/dialect/tone replaces in place instead of duplicating
  const deduped = upsertHistoryEntry(added, {
    sourceText: 'Good morning, friend.',
    translatedText: 'صبح بخیر دوست من.',
    languageId: 'fa',
    dialectId: 'fa-tehrani',
    tone: 'casual',
  });
  assert.equal(deduped.length, added.length);
  assert.equal(deduped[0].translatedText, 'صبح بخیر دوست من.');

  const starred = toggleHistoryStar(deduped, deduped[0].id);
  assert.equal(starred[0].starred, true);

  const onlyStarred = filterHistoryEntries(starred, 'friend', { starredOnly: true });
  assert.equal(onlyStarred.length, 1);

  const deleted = deleteHistoryEntry(starred, starred[0].id);
  assert.equal(deleted.length, INITIAL_HISTORY.length);
});

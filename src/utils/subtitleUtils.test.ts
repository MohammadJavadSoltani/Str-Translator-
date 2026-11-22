import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTranslatedFileName,
  chunkCuesForTranslation,
  isSupportedUploadFile,
  parseUploadedFile,
  serializeSubtitleFile,
} from './subtitleUtils';

test('recognizes .str, .srt, .vtt, and .txt upload files', () => {
  assert.equal(isSupportedUploadFile('dialogue.str'), true);
  assert.equal(isSupportedUploadFile('movie.SRT'), true);
  assert.equal(isSupportedUploadFile('captions.vtt'), true);
  assert.equal(isSupportedUploadFile('notes.txt'), true);
  assert.equal(isSupportedUploadFile('archive.zip'), false);
});

test('parses SubRip subtitle cues inside a .str file and preserves timestamps', () => {
  const sampleSrt = [
    '\uFEFF1',
    '00:00:01,000 --> 00:00:03,500',
    'Hello old friend.',
    'How have you been?',
    '',
    '2',
    '00:00:04,000 --> 00:00:06,200',
    'Come inside, the tea is ready.',
  ].join('\r\n');

  const parsed = parseUploadedFile('episode01.str', sampleSrt);
  assert.equal(parsed.kind, 'srt');
  assert.equal(parsed.extension, '.str');
  assert.equal(parsed.cues.length, 2);
  assert.equal(parsed.cues[0].timestamp, '00:00:01,000 --> 00:00:03,500');
  assert.equal(parsed.cues[0].text, 'Hello old friend.\nHow have you been?');
  assert.equal(parsed.cues[1].cueNumber, '2');
});

test('parses plain text .str files without timestamps as plain kind', () => {
  const parsed = parseUploadedFile('strings.str', 'Good morning.\nWelcome to the studio.');
  assert.equal(parsed.kind, 'plain');
  assert.equal(parsed.cues.length, 0);
  assert.equal(parsed.rawText, 'Good morning.\nWelcome to the studio.');
});

test('chunks cues cleanly and serializes translated subtitles with exact timestamps', () => {
  const parsed = parseUploadedFile(
    'scene.str',
    '1\n00:00:01,000 --> 00:00:02,000\nHello.\n\n2\n00:00:03,000 --> 00:00:05,000\nSee you soon.'
  );
  const batches = chunkCuesForTranslation(parsed.cues, 1);
  assert.equal(batches.length, 2);

  const translated = {
    ...parsed,
    cues: [
      { ...parsed.cues[0], translatedText: 'سلام.' },
      { ...parsed.cues[1], translatedText: 'به‌زودی می‌بینمت.' },
    ],
  };

  const output = serializeSubtitleFile(translated);
  assert.match(output, /1\n00:00:01,000 --> 00:00:02,000\nسلام\./);
  assert.match(output, /2\n00:00:03,000 --> 00:00:05,000\nبه‌زودی می‌بینمت\./);

  const bilingual = serializeSubtitleFile(translated, { bilingual: true });
  assert.match(bilingual, /سلام\.\nHello\./);
});

test('buildTranslatedFileName preserves original .str or .srt extension', () => {
  assert.equal(
    buildTranslatedFileName('film_en.str', 'fa', 'fa-tehrani'),
    'film_en_fa-tehrani.str'
  );
  assert.equal(
    buildTranslatedFileName('trailer.srt', 'fa', 'fa-literary'),
    'trailer_fa-literary.srt'
  );
});

export type UploadedFileKind = 'srt' | 'vtt' | 'plain';

export interface SubtitleCue {
  id: number;
  cueNumber: string;
  timestamp: string;
  text: string;
  translatedText: string;
}

export interface ParsedUploadedFile {
  fileName: string;
  extension: string;
  kind: UploadedFileKind;
  rawText: string;
  cues: SubtitleCue[];
}

export const ACCEPTED_FILE_EXTENSIONS = ['.str', '.srt', '.vtt', '.txt'] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

const TIMESTAMP_LINE_RE =
  /^(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}(?:\s+.*)?$/;

export function getFileExtension(fileName: string): string {
  const match = fileName.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '.txt';
}

export function isSupportedUploadFile(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return (ACCEPTED_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Parses uploaded .str, .srt, .vtt, or .txt content.
 * Detects SubRip/WebVTT subtitle blocks automatically even when the extension is .str or .txt.
 */
export function parseUploadedFile(fileName: string, content: string): ParsedUploadedFile {
  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const extension = getFileExtension(fileName);
  const isVttHeader = /^WEBVTT(?:\s|$)/i.test(clean.trimStart());

  const body = isVttHeader ? clean.replace(/^WEBVTT[^\n]*\n+/i, '') : clean;
  const blocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const tsIndex = lines.findIndex((line) => TIMESTAMP_LINE_RE.test(line.trim()));
    if (tsIndex === -1) continue;

    const cueNumber = tsIndex > 0 ? lines[tsIndex - 1].trim() : String(cues.length + 1);
    const timestamp = lines[tsIndex].trim();
    const text = lines
      .slice(tsIndex + 1)
      .join('\n')
      .trim();

    if (!text) continue;
    cues.push({
      id: cues.length + 1,
      cueNumber: cueNumber || String(cues.length + 1),
      timestamp,
      text,
      translatedText: '',
    });
  }

  if (cues.length > 0) {
    const kind: UploadedFileKind = isVttHeader || extension === '.vtt' ? 'vtt' : 'srt';
    return {
      fileName,
      extension,
      kind,
      rawText: clean,
      cues,
    };
  }

  return {
    fileName,
    extension,
    kind: 'plain',
    rawText: clean.trim(),
    cues: [],
  };
}

export function chunkCuesForTranslation(
  cues: SubtitleCue[],
  maxCuesPerBatch = 18,
  maxCharsPerBatch = 2200
): SubtitleCue[][] {
  const batches: SubtitleCue[][] = [];
  let current: SubtitleCue[] = [];
  let currentChars = 0;

  for (const cue of cues) {
    const cueLen = cue.text.length;
    if (
      current.length > 0 &&
      (current.length >= maxCuesPerBatch || currentChars + cueLen > maxCharsPerBatch)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(cue);
    currentChars += cueLen;
  }

  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

export function serializeSubtitleFile(
  file: ParsedUploadedFile,
  options?: { bilingual?: boolean }
): string {
  const bilingual = Boolean(options?.bilingual);
  if (file.kind === 'plain') {
    return file.rawText;
  }

  const header = file.kind === 'vtt' ? 'WEBVTT\n\n' : '';
  const blocks = file.cues.map((cue, idx) => {
    const translated = cue.translatedText.trim() || cue.text;
    const body = bilingual ? `${translated}\n${cue.text}` : translated;
    if (file.kind === 'vtt') {
      return `${cue.timestamp}\n${body}`;
    }
    return `${cue.cueNumber || String(idx + 1)}\n${cue.timestamp}\n${body}`;
  });

  return `${header}${blocks.join('\n\n')}\n`;
}

export function buildTranslatedFileName(
  originalFileName: string,
  languageId: string,
  dialectId: string
): string {
  const trimmed = originalFileName.trim() || 'translation.str';
  const ext = getFileExtension(trimmed);
  const base = trimmed.endsWith(ext) ? trimmed.slice(0, -ext.length) : trimmed;
  const suffix = dialectId || languageId;
  return `${base}_${suffix}${ext}`;
}

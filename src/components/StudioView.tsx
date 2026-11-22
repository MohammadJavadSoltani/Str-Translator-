import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  Moon,
  RotateCcw,
  Star,
  Sun,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  LANGUAGES,
  SAMPLE_PHRASES,
  TONES,
  type SamplePhrase,
  type ToneId,
  type TranslationAnalysis,
} from '../data/languages';
import {
  analyzeTextMetrics,
  getDialectById,
  getLanguageById,
  MAX_SOURCE_CHARS,
} from '../utils/translationUtils';
import {
  ACCEPTED_FILE_EXTENSIONS,
  type ParsedUploadedFile,
} from '../utils/subtitleUtils';

interface StudioViewProps {
  sourceText: string;
  onSourceChange: (value: string) => void;
  translatedText: string;
  onAdoptAlternative: (text: string) => void;
  languageId: string;
  onLanguageChange: (languageId: string) => void;
  dialectId: string;
  onDialectChange: (dialectId: string) => void;
  tone: ToneId;
  onToneChange: (tone: ToneId) => void;
  liveMode: boolean;
  onToggleLiveMode: () => void;
  showTransliteration: boolean;
  onToggleTransliteration: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isStreaming: boolean;
  isAnalyzing: boolean;
  error: string | null;
  analysisError: string | null;
  onRetry: () => void;
  analysis: TranslationAnalysis | null;
  onAnalyze: () => void;
  onLoadSample: (sample: SamplePhrase) => void;
  isStarred: boolean;
  onToggleStarCurrent: () => void;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  audioError: string | null;
  onSpeak: () => void;
  // .str / .srt / .vtt / .txt file upload props
  uploadedFile: ParsedUploadedFile | null;
  uploadError: string | null;
  isTranslatingFile: boolean;
  fileProgress: { completed: number; total: number } | null;
  bilingualExport: boolean;
  onToggleBilingualExport: () => void;
  onUploadFile: (file: File) => void;
  onClearUploadedFile: () => void;
  onTranslateUploadedFile: () => void;
  onEditSubtitleCue: (cueId: number, translatedText: string) => void;
  onDownloadTranslatedFile: () => void;
}

export function StudioView({
  sourceText,
  onSourceChange,
  translatedText,
  onAdoptAlternative,
  languageId,
  onLanguageChange,
  dialectId,
  onDialectChange,
  tone,
  onToneChange,
  liveMode,
  onToggleLiveMode,
  showTransliteration,
  onToggleTransliteration,
  isDark,
  onToggleTheme,
  isStreaming,
  isAnalyzing,
  error,
  analysisError,
  onRetry,
  analysis,
  onAnalyze,
  onLoadSample,
  isStarred,
  onToggleStarCurrent,
  isSpeaking,
  isLoadingAudio,
  audioError,
  onSpeak,
  uploadedFile,
  uploadError,
  isTranslatingFile,
  fileProgress,
  bilingualExport,
  onToggleBilingualExport,
  onUploadFile,
  onClearUploadedFile,
  onTranslateUploadedFile,
  onEditSubtitleCue,
  onDownloadTranslatedFile,
}: StudioViewProps) {
  const [copiedMain, setCopiedMain] = useState(false);
  const [copiedAltIndex, setCopiedAltIndex] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const language = getLanguageById(languageId);
  const dialect = getDialectById(languageId, dialectId);
  const sourceMetrics = analyzeTextMetrics(sourceText);
  const targetMetrics = analyzeTextMetrics(translatedText);
  const isOverLimit = sourceText.length > MAX_SOURCE_CHARS;
  const isPersianOrArabic = language.scriptFamily === 'persian' || language.scriptFamily === 'arabic';

  const isSubtitleMode = Boolean(uploadedFile && uploadedFile.kind !== 'plain');
  const translatedCueCount = uploadedFile
    ? uploadedFile.cues.filter((c) => c.translatedText.trim().length > 0).length
    : 0;

  async function handleCopyMain() {
    if (!translatedText.trim()) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopiedMain(true);
      window.setTimeout(() => setCopiedMain(false), 1800);
    } catch {
      // Clipboard unavailable in restricted contexts
    }
  }

  async function handleCopyAlt(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAltIndex(idx);
      window.setTimeout(() => setCopiedAltIndex(null), 1600);
    } catch {
      // ignore
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!isDraggingFile) setIsDraggingFile(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDraggingFile(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-9 space-y-6">
      {/* Hidden native file input supporting .str, .srt, .vtt, .txt */}
      <input
        ref={fileInputRef}
        id="str-file-upload"
        type="file"
        accept={ACCEPTED_FILE_EXTENSIONS.join(',')}
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload .str, .srt, .vtt, or .txt file"
      />

      {/* Compact Workspace Utility Bar: Tone segmented selector + Live/Script/Theme controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div
          role="group"
          aria-label="Translation tone"
          className="inline-flex items-center p-1 bg-stone-200/70 dark:bg-zinc-900 rounded-lg overflow-x-auto max-w-full"
        >
          {TONES.map((t) => {
            const active = tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToneChange(t.id)}
                aria-pressed={active}
                title={t.description}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                  active
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center flex-wrap gap-x-5 gap-y-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          {!isSubtitleMode && (
            <button
              type="button"
              role="switch"
              aria-checked={liveMode}
              onClick={onToggleLiveMode}
              className="inline-flex items-center gap-2 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
            >
              <span
                className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  liveMode ? 'bg-blue-700 dark:bg-blue-500' : 'bg-stone-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    liveMode ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
              <span>Real-time</span>
            </button>
          )}

          {language.needsTransliteration && !isSubtitleMode && (
            <button
              type="button"
              role="switch"
              aria-checked={showTransliteration}
              onClick={onToggleTransliteration}
              className="inline-flex items-center gap-2 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
            >
              <span
                className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                  showTransliteration
                    ? 'bg-blue-700 dark:bg-blue-500'
                    : 'bg-stone-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white transition-transform ${
                    showTransliteration ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
              <span>Phonetics</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 hover:text-blue-700 dark:hover:text-blue-400 font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload .str / .srt</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>

      {/* Upload validation feedback */}
      {uploadError && (
        <div
          role="alert"
          className="px-4 py-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 flex items-center justify-between gap-4 text-xs sm:text-sm text-red-700 dark:text-red-300"
        >
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={onClearUploadedFile}
            aria-label="Dismiss upload error"
            className="p-1 hover:text-red-900 dark:hover:text-red-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Target Language + Dialect Selector Strip (Shared clean bar across both free-text & subtitle modes) */}
      <section
        aria-label="Translation workspace"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-white dark:bg-zinc-900 border rounded-xl overflow-hidden transition-colors ${
          isDraggingFile
            ? 'border-blue-600 dark:border-blue-400 ring-2 ring-blue-600/20'
            : 'border-stone-200 dark:border-zinc-800'
        }`}
      >
        {/* Unified Top Control Band: Source info on left, Target Language selector on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-zinc-800 border-b border-stone-200 dark:border-zinc-800">
          {/* Left Header */}
          <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                English
              </span>
              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
              {uploadedFile ? (
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 truncate">
                  <FileText className="w-3.5 h-3.5 shrink-0 text-blue-700 dark:text-blue-400" />
                  <span className="truncate font-medium">{uploadedFile.fileName}</span>
                  {isSubtitleMode && (
                    <span className="font-mono tabular-nums text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      ({uploadedFile.cues.length} cues)
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400 truncate">
                  Text or drop .str / .srt
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {uploadedFile ? (
                <button
                  type="button"
                  onClick={onClearUploadedFile}
                  aria-label="Close uploaded file"
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors whitespace-nowrap px-1.5 py-1 rounded-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close file</span>
                </button>
              ) : sourceText.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSourceChange('')}
                  aria-label="Clear English source text"
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors whitespace-nowrap px-1.5 py-1 rounded-sm"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Right Header */}
          <div className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 bg-stone-50/40 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <label htmlFor="target-language-select" className="sr-only">
                Target language
              </label>
              <select
                id="target-language-select"
                value={language.id}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent text-sm font-semibold text-zinc-900 dark:text-zinc-100 pr-2 py-0.5 rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                {LANGUAGES.map((lang) => (
                  <option
                    key={lang.id}
                    value={lang.id}
                    className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  >
                    {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>

              <span aria-hidden="true" className="hidden sm:inline text-zinc-300 dark:text-zinc-700">·</span>

              <span className="hidden sm:inline text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {dialect.region}
              </span>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
              {isStreaming || isTranslatingFile
                ? 'Translating…'
                : language.dir === 'rtl'
                ? 'Right-to-left'
                : 'Left-to-right'}
            </div>
          </div>
        </div>

        {/* Full-Width Dialect Selector Band — all 6 Persian dialects cleanly visible with zero clipping */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-stone-100 dark:border-zinc-800/80 bg-stone-50/60 dark:bg-zinc-950/30 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label={`${language.name} dialects`}
            className="flex items-center flex-wrap gap-1.5"
          >
            {language.dialects.map((d) => {
              const selected = d.id === dialect.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onDialectChange(d.id)}
                  title={d.summary}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                    selected
                      ? 'bg-blue-700 text-white dark:bg-blue-600'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-stone-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {d.name}
                </button>
              );
            })}
          </div>

          <span
            dir={language.dir}
            lang={language.code}
            className={`text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0 ${
              isPersianOrArabic ? 'font-persian text-sm' : ''
            }`}
          >
            {dialect.nativeName}
          </span>
        </div>

        {/* MODE A: Uploaded Subtitle File (.str / .srt / .vtt with timestamps) */}
        {isSubtitleMode && uploadedFile ? (
          <div data-testid="subtitle-workspace" className="divide-y divide-stone-200 dark:divide-zinc-800">
            {/* Subtitle Action Strip */}
            <div className="px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900">
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-mono tabular-nums">
                  {fileProgress
                    ? `Translating ${fileProgress.completed} / ${fileProgress.total} cues…`
                    : `${translatedCueCount} / ${uploadedFile.cues.length} cues translated`}
                </span>
                <span aria-hidden="true">·</span>
                <span>Timestamps preserved</span>
              </div>

              <div className="flex items-center flex-wrap gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={bilingualExport}
                  onClick={onToggleBilingualExport}
                  className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 whitespace-nowrap"
                >
                  <span
                    className={`inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${
                      bilingualExport
                        ? 'bg-blue-700 dark:bg-blue-500'
                        : 'bg-stone-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full bg-white transition-transform ${
                        bilingualExport ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span>Bilingual export</span>
                </button>

                <button
                  type="button"
                  onClick={onTranslateUploadedFile}
                  disabled={isTranslatingFile}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  {isTranslatingFile
                    ? 'Translating file…'
                    : translatedCueCount > 0
                    ? 'Re-translate file'
                    : 'Translate file'}
                </button>

                <button
                  type="button"
                  onClick={onDownloadTranslatedFile}
                  disabled={translatedCueCount === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-100 border border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {uploadedFile.extension}</span>
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="px-5 sm:px-6 py-3 bg-red-50/70 dark:bg-red-950/30 flex items-center justify-between gap-4 text-xs text-red-700 dark:text-red-300"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={onTranslateUploadedFile}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-4 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Cue-by-Cue Bilingual Editor */}
            <div className="max-h-[480px] overflow-y-auto subtle-scroll divide-y divide-stone-100 dark:divide-zinc-800/80">
              {uploadedFile.cues.map((cue) => (
                <div
                  key={cue.id}
                  className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-100 dark:divide-zinc-800/80"
                >
                  <div className="px-5 sm:px-6 py-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
                      <span>#{cue.cueNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>{cue.timestamp}</span>
                    </div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {cue.text}
                    </p>
                  </div>

                  <div className="px-5 sm:px-6 py-3.5 bg-stone-50/40 dark:bg-zinc-900/50">
                    <label htmlFor={`cue-edit-${cue.id}`} className="sr-only">
                      Translated cue #{cue.cueNumber}
                    </label>
                    <textarea
                      id={`cue-edit-${cue.id}`}
                      rows={Math.max(2, cue.text.split('\n').length)}
                      dir={language.dir}
                      lang={language.code}
                      value={cue.translatedText}
                      onChange={(e) => onEditSubtitleCue(cue.id, e.target.value)}
                      placeholder={
                        isTranslatingFile ? 'Translating cue…' : 'Translated line will appear here…'
                      }
                      className={`w-full resize-none bg-transparent text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none ${
                        isPersianOrArabic
                          ? 'font-persian text-[17px] leading-[1.95]'
                          : 'text-sm leading-relaxed'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* MODE B: Real-Time Free-Text & Plain .str Editor */
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-200 dark:divide-zinc-800">
            {/* LEFT PANE: English Input */}
            <div className="flex flex-col min-h-[340px] sm:min-h-[390px]">
              <div className="flex-1 flex flex-col px-5 sm:px-6 py-5">
                <label htmlFor="english-source-input" className="sr-only">
                  English text to translate
                </label>
                <textarea
                  id="english-source-input"
                  value={sourceText}
                  onChange={(e) => onSourceChange(e.target.value)}
                  placeholder="Write, paste English text, or drop a .str / .srt file here. Translation begins automatically as you type…"
                  spellCheck
                  className="w-full flex-1 min-h-[210px] sm:min-h-[250px] resize-none bg-transparent text-base sm:text-[17px] leading-[1.75] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                />

                {/* Curated One-Click Samples when input is empty */}
                {!sourceText.trim() && (
                  <div className="pt-4 mt-4 border-t border-stone-100 dark:border-zinc-800/80">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2.5">
                      Try a curated sample or drop a .str / .srt file
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_PHRASES.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => onLoadSample(sample)}
                          className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-stone-100 dark:bg-zinc-800/90 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                        >
                          {sample.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 sm:px-6 py-3.5 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span>{sourceMetrics.words} words</span>
                  <span aria-hidden="true">·</span>
                  <span className={isOverLimit ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                    {sourceMetrics.chars.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()}
                  </span>
                </div>
                {sourceMetrics.words > 0 && (
                  <span className="font-mono tabular-nums">
                    ~{sourceMetrics.readingSeconds}s read
                  </span>
                )}
              </div>
            </div>

            {/* RIGHT PANE: Fluent Target Language Output */}
            <div className="flex flex-col min-h-[340px] sm:min-h-[390px] bg-stone-50/40 dark:bg-zinc-900/50">
              <div className="flex-1 px-5 sm:px-6 py-5 flex flex-col justify-between gap-5">
                {error ? (
                  <div
                    role="alert"
                    className="my-auto py-6 px-4 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 space-y-3"
                  >
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      Translation could not be completed
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry translation</span>
                    </button>
                  </div>
                ) : translatedText ? (
                  <div className="space-y-5">
                    <div
                      data-testid="translation-output"
                      dir={language.dir}
                      lang={language.code}
                      className={`whitespace-pre-wrap break-words text-zinc-900 dark:text-zinc-50 ${
                        isPersianOrArabic
                          ? 'font-persian text-[20px] sm:text-[22px] leading-[2.1] font-normal'
                          : 'text-base sm:text-[18px] leading-[1.8]'
                      }`}
                    >
                      {translatedText}
                    </div>

                    {/* Phonetic Transliteration */}
                    {language.needsTransliteration &&
                      showTransliteration &&
                      (analysis?.transliteration || isAnalyzing) && (
                        <div className="pt-4 border-t border-stone-200/80 dark:border-zinc-800">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                            Pronunciation guide
                          </p>
                          {analysis?.transliteration ? (
                            <p
                              data-testid="transliteration-output"
                              className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed italic"
                            >
                              {analysis.transliteration}
                            </p>
                          ) : (
                            <div className="h-4 w-3/4 bg-stone-200 dark:bg-zinc-800 rounded animate-pulse" />
                          )}
                        </div>
                      )}
                  </div>
                ) : isStreaming ? (
                  <div className="space-y-3 py-2" aria-live="polite" aria-busy="true">
                    <div className="h-5 w-4/5 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-5 w-3/5 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-5 w-2/5 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                ) : (
                  <div className="my-auto py-8 space-y-2.5">
                    <p
                      dir={language.dir}
                      lang={language.code}
                      className={`text-zinc-400 dark:text-zinc-500 ${
                        isPersianOrArabic
                          ? 'font-persian text-xl leading-[2.05]'
                          : 'text-base leading-relaxed'
                      }`}
                    >
                      {dialect.exampleTarget}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {dialect.name} — {dialect.summary}
                    </p>
                  </div>
                )}

                {audioError && (
                  <p role="status" className="text-xs text-red-600 dark:text-red-400">
                    {audioError}
                  </p>
                )}
              </div>

              {/* Target Output Action Strip */}
              <div className="px-5 sm:px-6 py-3.5 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={onSpeak}
                    disabled={!translatedText.trim() || isLoadingAudio}
                    aria-label={isSpeaking ? 'Stop pronunciation audio' : 'Listen to translation'}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-stone-200/70 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    {isSpeaking ? (
                      <VolumeX className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isLoadingAudio ? 'Loading…' : isSpeaking ? 'Stop' : 'Listen'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyMain}
                    disabled={!translatedText.trim()}
                    aria-label="Copy translation"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-stone-200/70 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    {copiedMain ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedMain ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleStarCurrent}
                    disabled={!translatedText.trim()}
                    aria-label={isStarred ? 'Remove from saved favorites' : 'Save translation to favorites'}
                    aria-pressed={isStarred}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-stone-200/70 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        isStarred
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}
                    />
                    <span>{isStarred ? 'Saved' : 'Save'}</span>
                  </button>

                  {translatedText.trim() && (
                    <button
                      type="button"
                      onClick={onDownloadTranslatedFile}
                      aria-label={`Download translated ${uploadedFile?.extension || '.str'} file`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-stone-200/70 dark:hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download {uploadedFile?.extension || '.str'}</span>
                    </button>
                  )}

                  {translatedText.trim() && !isStreaming && !analysis && (
                    <button
                      type="button"
                      onClick={onAnalyze}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{isAnalyzing ? 'Analyzing…' : 'Notes & phonetics'}</span>
                    </button>
                  )}
                </div>

                {targetMetrics.words > 0 ? (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums whitespace-nowrap shrink-0">
                    {targetMetrics.words} words
                  </div>
                ) : (
                  <div
                    dir={language.dir}
                    lang={language.code}
                    className={`text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0 ${
                      isPersianOrArabic ? 'font-persian text-sm' : ''
                    }`}
                  >
                    {dialect.nativeName}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Inline analysis error when user explicitly requested notes */}
      {!isSubtitleMode && analysisError && translatedText && !error && (
        <div
          role="status"
          className="px-4 py-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-center justify-between gap-4 text-xs text-amber-800 dark:text-amber-300"
        >
          <span>{analysisError}</span>
          <button
            type="button"
            onClick={onAnalyze}
            className="font-medium underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Retry notes
          </button>
        </div>
      )}

      {/* Detailed Linguistic Craft, Alternatives & Phrase Alignment */}
      {!isSubtitleMode && (analysis || isAnalyzing) && translatedText && !error && (
        <section
          aria-label="Linguistic nuances and alternative phrasings"
          className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-200 dark:divide-zinc-800"
        >
          {/* Row 1: Register & Idiom Nuance Notes */}
          <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-1.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Fluency &amp; Dialect Notes
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {language.name} · {dialect.name} · {TONES.find((t) => t.id === tone)?.label}
              </p>
            </div>

            <div className="lg:col-span-8 space-y-3">
              {isAnalyzing && !analysis ? (
                <div className="space-y-2.5">
                  <div className="h-4 w-5/6 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              ) : (
                analysis && (
                  <>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      {analysis.registerNote}
                    </p>
                    {analysis.idiomNotes.length > 0 && (
                      <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed list-disc pl-4">
                        {analysis.idiomNotes.map((note, idx) => (
                          <li key={idx}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )
              )}
            </div>
          </div>

          {/* Row 2: Nuanced Alternatives */}
          {analysis && analysis.alternatives.length > 0 && (
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Alternative Phrasings
                </h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select any variation to use in editor
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-200 dark:divide-zinc-800 border-t border-stone-100 dark:border-zinc-800/80 pt-4">
                {analysis.alternatives.map((alt, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col justify-between gap-3 py-3 md:py-0 ${
                      idx === 0
                        ? 'md:pr-5'
                        : idx === analysis.alternatives.length - 1
                        ? 'md:pl-5'
                        : 'md:px-5'
                    }`}
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                        {alt.style}
                      </p>
                      <p
                        dir={language.dir}
                        lang={language.code}
                        className={`text-zinc-900 dark:text-zinc-100 ${
                          isPersianOrArabic
                            ? 'font-persian text-[17px] leading-[1.95]'
                            : 'text-sm leading-relaxed'
                        }`}
                      >
                        {alt.text}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {alt.explanation}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => onAdoptAlternative(alt.text)}
                        className="text-xs font-medium text-zinc-900 dark:text-zinc-100 hover:text-blue-700 dark:hover:text-blue-400 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
                      >
                        Use this phrasing
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyAlt(alt.text, idx)}
                        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
                      >
                        {copiedAltIndex === idx ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 3: Key Phrase Alignment */}
          {analysis && analysis.keyPhrases.length > 0 && (
            <div className="p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Key Expressions &amp; Mapping
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                      <th className="py-2 pr-4 font-medium">English phrase</th>
                      <th className="py-2 px-4 font-medium">{language.name} equivalent</th>
                      <th className="py-2 pl-4 font-medium">Nuance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/80 text-sm">
                    {analysis.keyPhrases.map((pair, idx) => (
                      <tr key={idx}>
                        <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300 align-top">
                          {pair.source}
                        </td>
                        <td
                          dir={language.dir}
                          lang={language.code}
                          className={`py-3 px-4 text-zinc-900 dark:text-zinc-100 align-top ${
                            isPersianOrArabic
                              ? 'font-persian text-[16px] leading-[1.8]'
                              : 'font-medium'
                          }`}
                        >
                          {pair.target}
                        </td>
                        <td className="py-3 pl-4 text-xs text-zinc-500 dark:text-zinc-400 align-top leading-relaxed">
                          {pair.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

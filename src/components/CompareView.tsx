import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  LANGUAGES,
  SAMPLE_PHRASES,
  TONES,
  type ToneId,
} from '../data/languages';
import type { BatchCompareResult } from '../services/translationApi';
import {
  getDialectById,
  getLanguageById,
  MAX_SOURCE_CHARS,
} from '../utils/translationUtils';

export interface CompareTarget {
  id: string;
  languageId: string;
  dialectId: string;
}

interface CompareViewProps {
  sourceText: string;
  onSourceChange: (value: string) => void;
  tone: ToneId;
  onToneChange: (tone: ToneId) => void;
  targets: CompareTarget[];
  onUpdateTarget: (id: string, languageId: string, dialectId: string) => void;
  onAddTarget: () => void;
  onRemoveTarget: (id: string) => void;
  results: Record<string, BatchCompareResult>;
  isLoading: boolean;
  error: string | null;
  onRunCompare: () => void;
  onOpenInStudio: (languageId: string, dialectId: string, translatedText?: string) => void;
}

export function CompareView({
  sourceText,
  onSourceChange,
  tone,
  onToneChange,
  targets,
  onUpdateTarget,
  onAddTarget,
  onRemoveTarget,
  results,
  isLoading,
  error,
  onRunCompare,
  onOpenInStudio,
}: CompareViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(id: string, text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-9 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
            Compare Languages &amp; Dialects
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Translate one English passage across multiple Persian registers and global languages simultaneously.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onAddTarget}
            disabled={targets.length >= 6}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-800 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add language</span>
          </button>
        </div>
      </div>

      {/* Shared Source Input Sheet */}
      <section className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 sm:px-6 py-3.5 border-b border-stone-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">English</span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-zinc-500 dark:text-zinc-400">Shared input</span>
          </div>

          <div
            role="group"
            aria-label="Comparison tone"
            className="inline-flex items-center p-0.5 bg-stone-100 dark:bg-zinc-800 rounded-lg overflow-x-auto max-w-full"
          >
            {TONES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onToneChange(t.id)}
                aria-pressed={tone === t.id}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  tone === t.id
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4">
          <label htmlFor="compare-source-input" className="sr-only">
            English text to compare across languages
          </label>
          <textarea
            id="compare-source-input"
            rows={3}
            value={sourceText}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="Enter an English sentence to compare side by side across dialects and languages…"
            className="w-full resize-none bg-transparent text-base leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
          />
        </div>

        <div className="px-5 sm:px-6 py-3 border-t border-stone-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Quick sample:</span>
            {SAMPLE_PHRASES.slice(0, 3).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSourceChange(s.text)}
                className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-blue-700 dark:hover:text-blue-400 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
              >
                {s.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
              {sourceText.length.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={onRunCompare}
              disabled={isLoading || !sourceText.trim()}
              className="px-4 py-1.5 text-xs sm:text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isLoading ? 'Comparing…' : 'Compare all'}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 flex items-center justify-between gap-4"
        >
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={onRunCompare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-md whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Multi-Language Comparison Grid (Single-Elevation Hairline Grid) */}
      <section
        aria-label="Multi-language translation results"
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {targets.map((target) => {
          const lang = getLanguageById(target.languageId);
          const dialect = getDialectById(target.languageId, target.dialectId);
          const result = results[target.id];
          const isPersianOrArabic =
            lang.scriptFamily === 'persian' || lang.scriptFamily === 'arabic';

          return (
            <article
              key={target.id}
              data-testid={`compare-card-${target.id}`}
              className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl flex flex-col justify-between"
            >
              {/* Card Header with Language & Dialect selectors */}
              <div className="px-5 py-3.5 border-b border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <label htmlFor={`compare-lang-${target.id}`} className="sr-only">
                    Target language
                  </label>
                  <select
                    id={`compare-lang-${target.id}`}
                    value={lang.id}
                    onChange={(e) => {
                      const nextLang = getLanguageById(e.target.value);
                      onUpdateTarget(target.id, nextLang.id, nextLang.defaultDialectId);
                    }}
                    className="bg-transparent text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
                  >
                    {LANGUAGES.map((l) => (
                      <option
                        key={l.id}
                        value={l.id}
                        className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      >
                        {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>

                  <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>

                  <label htmlFor={`compare-dialect-${target.id}`} className="sr-only">
                    Dialect
                  </label>
                  <select
                    id={`compare-dialect-${target.id}`}
                    value={dialect.id}
                    onChange={(e) => onUpdateTarget(target.id, lang.id, e.target.value)}
                    className="bg-transparent text-xs font-medium text-blue-700 dark:text-blue-400 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
                  >
                    {lang.dialects.map((d) => (
                      <option
                        key={d.id}
                        value={d.id}
                        className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                      >
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {targets.length > 2 && (
                  <button
                    type="button"
                    onClick={() => onRemoveTarget(target.id)}
                    aria-label={`Remove ${lang.name} ${dialect.name} from comparison`}
                    className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Card Body */}
              <div className="px-5 py-5 flex-1 space-y-3">
                {isLoading ? (
                  <div className="space-y-2.5">
                    <div className="h-5 w-4/5 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                    <div className="h-5 w-3/5 bg-stone-200/80 dark:bg-zinc-800 rounded animate-pulse" />
                  </div>
                ) : result?.translation ? (
                  <>
                    <p
                      dir={lang.dir}
                      lang={lang.code}
                      className={`whitespace-pre-wrap text-zinc-900 dark:text-zinc-50 ${
                        isPersianOrArabic
                          ? 'font-persian text-[19px] leading-[2.05]'
                          : 'text-[15px] leading-[1.75]'
                      }`}
                    >
                      {result.translation}
                    </p>
                    {result.transliteration && (
                      <p className="text-xs italic text-zinc-500 dark:text-zinc-400 leading-relaxed pt-2 border-t border-stone-100 dark:border-zinc-800/80">
                        {result.transliteration}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">
                    Click &ldquo;Compare all&rdquo; to translate into {lang.name} ({dialect.name}).
                  </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 border-t border-stone-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 truncate">
                  {dialect.nativeName}
                </span>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={!result?.translation}
                    onClick={() => handleCopy(target.id, result?.translation ?? '')}
                    className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {copiedId === target.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === target.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenInStudio(lang.id, dialect.id, result?.translation)
                    }
                    className="inline-flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 hover:underline underline-offset-4 whitespace-nowrap"
                  >
                    <span>Open in Studio</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

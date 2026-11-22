import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Star, Trash2 } from 'lucide-react';
import { LANGUAGES, type HistoryEntry } from '../data/languages';
import {
  filterHistoryEntries,
  formatRelativeTime,
  getDialectById,
  getLanguageById,
} from '../utils/translationUtils';

interface HistoryViewProps {
  history: HistoryEntry[];
  onToggleStar: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (entry: HistoryEntry) => void;
  onStartNew: () => void;
}

export function HistoryView({
  history,
  onToggleStar,
  onDelete,
  onRestore,
  onStartNew,
}: HistoryViewProps) {
  const [query, setQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [starredOnly, setStarredOnly] = useState(false);

  const filtered = useMemo(
    () => filterHistoryEntries(history, query, { languageId: languageFilter, starredOnly }),
    [history, query, languageFilter, starredOnly]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-9 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50">
            Translation Archive
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            {history.length} saved locally · {history.filter((h) => h.starred).length} starred
          </p>
        </div>

        {/* Clean Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <label htmlFor="history-search" className="sr-only">
              Search translation archive
            </label>
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phrases or dialects…"
              className="pl-9 pr-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 w-56 sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <label htmlFor="history-lang-filter" className="sr-only">
            Filter archive by language
          </label>
          <select
            id="history-lang-filter"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            <option value="all">All languages</option>
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setStarredOnly((v) => !v)}
            aria-pressed={starredOnly}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              starredOnly
                ? 'bg-blue-700 border-blue-700 text-white dark:bg-blue-600 dark:border-blue-600'
                : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${starredOnly ? 'fill-current' : ''}`} />
            <span>Starred</span>
          </button>
        </div>
      </div>

      {/* Archive List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-10 text-center space-y-3">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            No matching translations
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {history.length === 0
              ? 'Translations you create in Studio will appear here automatically.'
              : 'Try adjusting your search query or language filter.'}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onStartNew}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              Open Studio
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-200 dark:divide-zinc-800">
          {filtered.map((entry) => {
            const lang = getLanguageById(entry.languageId);
            const dialect = getDialectById(entry.languageId, entry.dialectId);
            const isPersianOrArabic =
              lang.scriptFamily === 'persian' || lang.scriptFamily === 'arabic';

            return (
              <article
                key={entry.id}
                className="p-5 sm:p-6 space-y-4 hover:bg-stone-50/70 dark:hover:bg-zinc-800/30 transition-colors"
              >
                {/* Clean unboxed metadata row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {lang.name}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{dialect.name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{entry.tone}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestore(entry)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline underline-offset-4 whitespace-nowrap"
                    >
                      <span>Open in Studio</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleStar(entry.id)}
                      aria-label={
                        entry.starred
                          ? `Unstar translation "${entry.sourceText.slice(0, 28)}"`
                          : `Star translation "${entry.sourceText.slice(0, 28)}"`
                      }
                      aria-pressed={entry.starred}
                      className="p-1.5 text-zinc-400 hover:text-amber-500 rounded-md transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          entry.starred ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(entry.id)}
                      aria-label={`Delete translation "${entry.sourceText.slice(0, 28)}"`}
                      className="p-1.5 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {entry.sourceText}
                  </p>
                  <div className="space-y-1.5">
                    <p
                      dir={lang.dir}
                      lang={lang.code}
                      className={`text-zinc-900 dark:text-zinc-50 ${
                        isPersianOrArabic
                          ? 'font-persian text-[18px] leading-[1.95]'
                          : 'text-sm leading-relaxed'
                      }`}
                    >
                      {entry.translatedText}
                    </p>
                    {entry.transliteration && (
                      <p className="text-xs italic text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {entry.transliteration}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

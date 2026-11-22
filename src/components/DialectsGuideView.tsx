import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { LANGUAGES } from '../data/languages';

interface DialectsGuideViewProps {
  onSelectDialectInStudio: (languageId: string, dialectId: string, sampleText: string) => void;
}

export function DialectsGuideView({ onSelectDialectInStudio }: DialectsGuideViewProps) {
  const [selectedLangId, setSelectedLangId] = useState<string>('fa');
  const activeLanguage = LANGUAGES.find((l) => l.id === selectedLangId) ?? LANGUAGES[0];
  const isPersianOrArabic =
    activeLanguage.scriptFamily === 'persian' || activeLanguage.scriptFamily === 'arabic';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-9 space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
          Dialects &amp; Regional Registers
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Explore how phrasing shifts between conversational warmth, contemporary literary clarity, and regional speech across Persian and eleven additional languages.
        </p>
      </div>

      {/* Language Selector Strip */}
      <div
        role="tablist"
        aria-label="Browse language dialects"
        className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-stone-200 dark:border-zinc-800 subtle-scroll"
      >
        {LANGUAGES.map((lang) => {
          const active = lang.id === activeLanguage.id;
          return (
            <button
              key={lang.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedLangId(lang.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                active
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-stone-200/70 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {lang.name}
            </button>
          );
        })}
      </div>

      {/* Dialect Editorial Showcase */}
      <section
        aria-label={`${activeLanguage.name} dialect reference`}
        className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-200 dark:divide-zinc-800"
      >
        <div className="p-5 sm:p-6 flex flex-wrap items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-xl font-medium text-zinc-900 dark:text-zinc-50">
              {activeLanguage.name}
            </h2>
            <span
              dir={activeLanguage.dir}
              lang={activeLanguage.code}
              className={`text-zinc-500 dark:text-zinc-400 ${
                isPersianOrArabic ? 'font-persian text-lg' : 'text-sm'
              }`}
            >
              {activeLanguage.nativeName}
            </span>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            {activeLanguage.dialects.length} registers ·{' '}
            {activeLanguage.dir === 'rtl' ? 'Right-to-left script' : 'Left-to-right script'}
          </span>
        </div>

        {activeLanguage.dialects.map((dialect) => (
          <div
            key={dialect.id}
            className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-baseline flex-wrap gap-2">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {dialect.name}
                </h3>
                <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
                <span
                  dir={activeLanguage.dir}
                  lang={activeLanguage.code}
                  className={`text-sm text-zinc-500 dark:text-zinc-400 ${
                    isPersianOrArabic ? 'font-persian' : ''
                  }`}
                >
                  {dialect.nativeName}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{dialect.region}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1">
                {dialect.summary}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    onSelectDialectInStudio(
                      activeLanguage.id,
                      dialect.id,
                      dialect.exampleSource
                    )
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline underline-offset-4 whitespace-nowrap"
                >
                  <span>Try in Studio</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3 lg:pl-6 lg:border-l border-stone-100 dark:border-zinc-800/80">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                &ldquo;{dialect.exampleSource}&rdquo;
              </p>
              <p
                dir={activeLanguage.dir}
                lang={activeLanguage.code}
                className={`text-zinc-900 dark:text-zinc-50 ${
                  isPersianOrArabic
                    ? 'font-persian text-[20px] leading-[2.05]'
                    : 'text-base leading-relaxed'
                }`}
              >
                {dialect.exampleTarget}
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_COMPARE_TARGETS,
  INITIAL_HISTORY,
  SAMPLE_PHRASES,
  type HistoryEntry,
  type SamplePhrase,
  type ToneId,
  type TranslationAnalysis,
} from './data/languages';
import {
  deleteHistoryEntry,
  getLanguageById,
  toggleHistoryStar,
  upsertHistoryEntry,
  validateSourceText,
} from './utils/translationUtils';
import {
  fetchBatchComparison,
  fetchSpeechAudio,
  fetchTranslationAnalysis,
  streamTranslation,
  type BatchCompareResult,
} from './services/translationApi';
import { Header, type ActiveTab } from './components/Header';
import { StudioView } from './components/StudioView';
import { CompareView, type CompareTarget } from './components/CompareView';
import { HistoryView } from './components/HistoryView';
import { DialectsGuideView } from './components/DialectsGuideView';

const HISTORY_STORAGE_KEY = 'zaban_history_v1';
const THEME_STORAGE_KEY = 'zaban_theme_v1';

function loadInitialHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return INITIAL_HISTORY;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_HISTORY;
  } catch {
    return INITIAL_HISTORY;
  }
}

function loadInitialTheme(): boolean {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
  } catch {
    // ignore storage errors
  }
  return false;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [isDark, setIsDark] = useState<boolean>(loadInitialTheme);

  // Studio state — defaults to Persian (Tehrani Conversational)
  const [sourceText, setSourceText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [languageId, setLanguageId] = useState<string>('fa');
  const [dialectId, setDialectId] = useState<string>('fa-tehrani');
  const [tone, setTone] = useState<ToneId>('natural');
  const [liveMode, setLiveMode] = useState<boolean>(true);
  const [showTransliteration, setShowTransliteration] = useState<boolean>(true);

  // Request & streaming states
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TranslationAnalysis | null>(null);

  // Audio playback state
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Archive state
  const [history, setHistory] = useState<HistoryEntry[]>(loadInitialHistory);

  // Compare state
  const [compareTargets, setCompareTargets] = useState<CompareTarget[]>(() =>
    DEFAULT_COMPARE_TARGETS.map((item, idx) => ({
      id: `slot-${idx + 1}`,
      languageId: item.languageId,
      dialectId: item.dialectId,
    }))
  );
  const [compareResults, setCompareResults] = useState<Record<string, BatchCompareResult>>({});
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Abort refs for race-free real-time streaming
  const streamAbortRef = useRef<AbortController | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const compareAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const skipNextLiveEffectRef = useRef<boolean>(false);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  // Persist history
  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
      streamAbortRef.current?.abort();
      analysisAbortRef.current?.abort();
      compareAbortRef.current?.abort();
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [stopAudio]);

  const runTranslation = useCallback(
    async (params: {
      text: string;
      langId: string;
      dialId: string;
      toneId: ToneId;
    }) => {
      const validation = validateSourceText(params.text);
      if (!validation.valid) {
        if (!params.text.trim()) {
          setTranslatedText('');
          setAnalysis(null);
          setError(null);
        } else {
          setError(validation.error ?? 'Invalid input.');
        }
        return;
      }

      streamAbortRef.current?.abort();
      analysisAbortRef.current?.abort();
      stopAudio();
      setAudioError(null);

      const streamController = new AbortController();
      streamAbortRef.current = streamController;

      setError(null);
      setIsStreaming(true);
      setIsAnalyzing(false);
      setAnalysis(null);
      setTranslatedText('');

      try {
        const finalText = await streamTranslation(
          {
            text: validation.trimmed,
            languageId: params.langId,
            dialectId: params.dialId,
            tone: params.toneId,
          },
          {
            onChunk: (_delta, accumulated) => {
              setTranslatedText(accumulated);
            },
            onDone: (cleanText) => {
              setTranslatedText(cleanText);
            },
          },
          streamController.signal
        );

        if (streamController.signal.aborted) return;

        setIsStreaming(false);
        setHistory((prev) =>
          upsertHistoryEntry(prev, {
            sourceText: validation.trimmed,
            translatedText: finalText,
            languageId: params.langId,
            dialectId: params.dialId,
            tone: params.toneId,
          })
        );

        // Fetch linguistic analysis & transliteration in parallel behind the completed stream
        const analysisController = new AbortController();
        analysisAbortRef.current = analysisController;
        setIsAnalyzing(true);

        try {
          const details = await fetchTranslationAnalysis(
            {
              sourceText: validation.trimmed,
              translatedText: finalText,
              languageId: params.langId,
              dialectId: params.dialId,
              tone: params.toneId,
            },
            analysisController.signal
          );
          if (!analysisController.signal.aborted) {
            setAnalysis(details);
            if (details.transliteration) {
              setHistory((prev) =>
                upsertHistoryEntry(prev, {
                  sourceText: validation.trimmed,
                  translatedText: finalText,
                  transliteration: details.transliteration,
                  languageId: params.langId,
                  dialectId: params.dialId,
                  tone: params.toneId,
                })
              );
            }
          }
        } catch (analysisErr) {
          if (!analysisController.signal.aborted) {
            // Non-blocking: main translation remains intact even if secondary analysis fails
            console.warn('Linguistic analysis unavailable:', analysisErr);
          }
        } finally {
          if (!analysisController.signal.aborted) {
            setIsAnalyzing(false);
          }
        }
      } catch (err) {
        if (streamController.signal.aborted) return;
        setIsStreaming(false);
        setError(err instanceof Error ? err.message : 'Translation failed.');
      }
    },
    [stopAudio]
  );

  // Real-time debounced auto-translation when typing or switching settings in Live mode
  useEffect(() => {
    if (skipNextLiveEffectRef.current) {
      skipNextLiveEffectRef.current = false;
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    if (!sourceText.trim()) {
      streamAbortRef.current?.abort();
      analysisAbortRef.current?.abort();
      setTranslatedText('');
      setAnalysis(null);
      setError(null);
      setIsStreaming(false);
      setIsAnalyzing(false);
      return;
    }

    if (!liveMode || activeTab !== 'studio') return;

    debounceTimerRef.current = window.setTimeout(() => {
      void runTranslation({
        text: sourceText,
        langId: languageId,
        dialId: dialectId,
        toneId: tone,
      });
    }, 450);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [sourceText, languageId, dialectId, tone, liveMode, activeTab, runTranslation]);

  function handleLanguageChange(nextLangId: string) {
    const nextLang = getLanguageById(nextLangId);
    setLanguageId(nextLang.id);
    setDialectId(nextLang.defaultDialectId);
  }

  function handleLoadSample(sample: SamplePhrase) {
    skipNextLiveEffectRef.current = true;
    setSourceText(sample.text);
    setLanguageId(sample.recommendedLangId);
    setDialectId(sample.recommendedDialectId);
    setTone(sample.recommendedTone);
    setActiveTab('studio');
    void runTranslation({
      text: sample.text,
      langId: sample.recommendedLangId,
      dialId: sample.recommendedDialectId,
      toneId: sample.recommendedTone,
    });
  }

  async function handleSpeak() {
    if (isSpeaking) {
      stopAudio();
      return;
    }
    if (!translatedText.trim()) return;

    setAudioError(null);
    setIsLoadingAudio(true);

    try {
      const { audioBase64, mimeType } = await fetchSpeechAudio({
        text: translatedText,
        languageId,
        dialectId,
      });
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setAudioError('Could not play generated audio.');
      };
      await audio.play();
      setIsSpeaking(true);
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : 'Audio pronunciation is currently unavailable.'
      );
    } finally {
      setIsLoadingAudio(false);
    }
  }

  // Compare handlers
  async function handleRunCompare() {
    const validation = validateSourceText(sourceText);
    if (!validation.valid) {
      setCompareError(validation.error ?? 'Enter English text to compare.');
      return;
    }

    compareAbortRef.current?.abort();
    const controller = new AbortController();
    compareAbortRef.current = controller;

    setCompareError(null);
    setIsComparing(true);

    try {
      const batch = await fetchBatchComparison(
        {
          text: validation.trimmed,
          targets: compareTargets.map((t) => ({
            languageId: t.languageId,
            dialectId: t.dialectId,
          })),
          tone,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      const mapped: Record<string, BatchCompareResult> = {};
      compareTargets.forEach((slot, idx) => {
        if (batch[idx]) {
          mapped[slot.id] = batch[idx];
        }
      });
      setCompareResults(mapped);
    } catch (err) {
      if (!controller.signal.aborted) {
        setCompareError(err instanceof Error ? err.message : 'Comparison failed.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsComparing(false);
      }
    }
  }

  function handleUpdateCompareTarget(id: string, nextLangId: string, nextDialectId: string) {
    setCompareTargets((prev) =>
      prev.map((slot) =>
        slot.id === id
          ? { ...slot, languageId: nextLangId, dialectId: nextDialectId }
          : slot
      )
    );
  }

  function handleAddCompareTarget() {
    if (compareTargets.length >= 6) return;
    const usedLangs = new Set(compareTargets.map((t) => t.languageId));
    const fallbackOrder = ['ja', 'ar', 'de', 'tr', 'it', 'ko', 'fa'];
    const pickId = fallbackOrder.find((id) => !usedLangs.has(id)) ?? 'ja';
    const picked = getLanguageById(pickId);
    setCompareTargets((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}`,
        languageId: picked.id,
        dialectId: picked.defaultDialectId,
      },
    ]);
  }

  function handleRemoveCompareTarget(id: string) {
    setCompareTargets((prev) => prev.filter((slot) => slot.id !== id));
    setCompareResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleOpenInStudioFromCompare(
    targetLangId: string,
    targetDialectId: string,
    existingTranslation?: string
  ) {
    skipNextLiveEffectRef.current = Boolean(existingTranslation);
    setLanguageId(targetLangId);
    setDialectId(targetDialectId);
    if (existingTranslation) {
      setTranslatedText(existingTranslation);
      setAnalysis(null);
      setError(null);
    }
    setActiveTab('studio');
    if (sourceText.trim() && !existingTranslation) {
      void runTranslation({
        text: sourceText,
        langId: targetLangId,
        dialId: targetDialectId,
        toneId: tone,
      });
    }
  }

  function handleRestoreHistory(entry: HistoryEntry) {
    skipNextLiveEffectRef.current = true;
    setSourceText(entry.sourceText);
    setTranslatedText(entry.translatedText);
    setLanguageId(entry.languageId);
    setDialectId(entry.dialectId);
    setTone(entry.tone);
    setError(null);
    setAnalysis(
      entry.transliteration
        ? {
            transliteration: entry.transliteration,
            registerNote: 'Restored from your saved translation archive.',
            idiomNotes: [],
            alternatives: [],
            keyPhrases: [],
          }
        : null
    );
    setActiveTab('studio');
  }

  function handleTryDialectFromGuide(
    targetLangId: string,
    targetDialectId: string,
    sampleText: string
  ) {
    skipNextLiveEffectRef.current = true;
    setLanguageId(targetLangId);
    setDialectId(targetDialectId);
    setSourceText(sampleText);
    setActiveTab('studio');
    void runTranslation({
      text: sampleText,
      langId: targetLangId,
      dialId: targetDialectId,
      toneId: tone,
    });
  }

  // Primary header action adapts cleanly to current tab
  function handlePrimaryHeaderAction() {
    if (activeTab === 'compare') {
      if (!sourceText.trim()) {
        setSourceText(SAMPLE_PHRASES[0].text);
        return;
      }
      void handleRunCompare();
      return;
    }

    if (activeTab !== 'studio') {
      setActiveTab('studio');
      return;
    }

    if (!sourceText.trim()) {
      handleLoadSample(SAMPLE_PHRASES[0]);
      return;
    }

    void runTranslation({
      text: sourceText,
      langId: languageId,
      dialId: dialectId,
      toneId: tone,
    });
  }

  const currentHistoryMatch = history.find(
    (item) =>
      item.sourceText.trim() === sourceText.trim() &&
      item.languageId === languageId &&
      item.dialectId === dialectId &&
      item.tone === tone
  );

  function handleToggleStarCurrent() {
    if (currentHistoryMatch) {
      setHistory((prev) => toggleHistoryStar(prev, currentHistoryMatch.id));
    } else if (sourceText.trim() && translatedText.trim()) {
      setHistory((prev) => {
        const next = upsertHistoryEntry(prev, {
          sourceText,
          translatedText,
          transliteration: analysis?.transliteration,
          languageId,
          dialectId,
          tone,
        });
        return next[0] ? toggleHistoryStar(next, next[0].id) : next;
      });
    }
  }

  const primaryActionLabel =
    activeTab === 'compare'
      ? isComparing
        ? 'Comparing…'
        : 'Compare'
      : activeTab === 'studio'
      ? isStreaming
        ? 'Translating…'
        : sourceText.trim()
        ? 'Translate'
        : 'Try Sample'
      : 'Open Studio';

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onPrimaryAction={handlePrimaryHeaderAction}
        primaryActionLabel={primaryActionLabel}
        isBusy={isStreaming || isComparing}
      />

      <main className="flex-1">
        {activeTab === 'studio' && (
          <StudioView
            sourceText={sourceText}
            onSourceChange={setSourceText}
            translatedText={translatedText}
            onAdoptAlternative={(altText) => setTranslatedText(altText)}
            languageId={languageId}
            onLanguageChange={handleLanguageChange}
            dialectId={dialectId}
            onDialectChange={setDialectId}
            tone={tone}
            onToneChange={setTone}
            liveMode={liveMode}
            onToggleLiveMode={() => setLiveMode((v) => !v)}
            showTransliteration={showTransliteration}
            onToggleTransliteration={() => setShowTransliteration((v) => !v)}
            isDark={isDark}
            onToggleTheme={() => setIsDark((v) => !v)}
            isStreaming={isStreaming}
            isAnalyzing={isAnalyzing}
            error={error}
            onRetry={() =>
              void runTranslation({
                text: sourceText,
                langId: languageId,
                dialId: dialectId,
                toneId: tone,
              })
            }
            analysis={analysis}
            onLoadSample={handleLoadSample}
            isStarred={Boolean(currentHistoryMatch?.starred)}
            onToggleStarCurrent={handleToggleStarCurrent}
            isSpeaking={isSpeaking}
            isLoadingAudio={isLoadingAudio}
            audioError={audioError}
            onSpeak={() => void handleSpeak()}
          />
        )}

        {activeTab === 'compare' && (
          <CompareView
            sourceText={sourceText}
            onSourceChange={setSourceText}
            tone={tone}
            onToneChange={setTone}
            targets={compareTargets}
            onUpdateTarget={handleUpdateCompareTarget}
            onAddTarget={handleAddCompareTarget}
            onRemoveTarget={handleRemoveCompareTarget}
            results={compareResults}
            isLoading={isComparing}
            error={compareError}
            onRunCompare={() => void handleRunCompare()}
            onOpenInStudio={handleOpenInStudioFromCompare}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            history={history}
            onToggleStar={(id) => setHistory((prev) => toggleHistoryStar(prev, id))}
            onDelete={(id) => setHistory((prev) => deleteHistoryEntry(prev, id))}
            onRestore={handleRestoreHistory}
            onStartNew={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'dialects' && (
          <DialectsGuideView onSelectDialectInStudio={handleTryDialectFromGuide} />
        )}
      </main>

      <footer className="border-t border-stone-200 dark:border-zinc-800/80 py-5 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Zaban · Editorial Translation Studio</span>
          <span>12 languages · 35 regional dialects &amp; Persian registers</span>
        </div>
      </footer>
    </div>
  );
}

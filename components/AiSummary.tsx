import React, { useState, useEffect, useCallback } from 'react';
import type { Message } from '../types';
import { generateDiscoverySummary } from '../services/geminiService';
import { Sparkles, RefreshCw, AlertTriangle, Bot, Volume2, VolumeX } from 'lucide-react';
import type { Language, TranslationKey } from '../lib/i18n';
import { speakText, stopSpeech, unlockAudio, triggerHaptic } from '../lib/audio';

type TFunction = (key: TranslationKey, replacements?: Record<string, string | number>) => string;

interface AiSummaryProps {
  messages: Array<Message & { distance: number }>;
  t: TFunction;
  lang: Language;
}

export const AiSummary: React.FC<AiSummaryProps> = ({ messages, t, lang }) => {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const fetchSummary = useCallback(async () => {
    if (messages.length === 0) {
      setSummary('');
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await generateDiscoverySummary(messages, lang);
      setSummary(result);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, lang]);

  useEffect(() => {
    // Debounce the call to avoid rapid-firing API requests as location updates
    const handler = setTimeout(() => {
      fetchSummary();
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [fetchSummary]);

  const toggleSpeakSummary = () => {
    unlockAudio();
    triggerHaptic(50);
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else if (summary) {
      setIsSpeaking(true);
      speakText(summary, lang);
      // Auto-reset after typical reading duration
      const wordCount = summary.split(' ').length;
      const durationMs = Math.max(3000, wordCount * 450);
      setTimeout(() => setIsSpeaking(false), durationMs);
    }
  };

  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-slate-800/80 backdrop-blur-md p-4 rounded-2xl border border-cyan-800/40 w-full shadow-lg shadow-slate-950/40 flex flex-col gap-3"
      role="region"
      aria-label="AI Audio Landmark Summary"
    >
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-700/50">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
            Smart Overview
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {summary && (
            <button
              type="button"
              onClick={toggleSpeakSummary}
              className={`p-2 rounded-xl border transition-all text-xs font-semibold flex items-center gap-1.5 ${
                isSpeaking
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-700 hover:bg-slate-600 text-cyan-300 border-slate-600'
              }`}
              aria-label="Listen to summary"
              title="Listen to summary"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>Listen</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={fetchSummary}
            disabled={isLoading || messages.length === 0}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-slate-600"
            aria-label={t('Ai.refresh_aria')}
            title="Refresh summary"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="min-h-[44px] flex items-center">
        {isLoading ? (
          <div className="flex items-center space-x-3 text-slate-400 py-1">
            <Bot className="w-5 h-5 text-cyan-400 animate-bounce" />
            <p className="text-sm italic">{t('Ai.thinking')}</p>
          </div>
        ) : error ? (
          <div className="flex items-center space-x-3 text-red-300 py-1">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        ) : summary ? (
          <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
            {summary}
          </p>
        ) : null}
      </div>
    </div>
  );
};

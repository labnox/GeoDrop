import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Message, Coordinates } from '../types';
import {
  MapPin,
  Mic,
  Search,
  Globe,
  Lock,
  Volume2,
  Eye,
  EyeOff,
  FileText,
  VolumeX,
  Sparkles,
  Navigation,
  Trash2,
  X,
  AlertCircle,
  Check,
} from 'lucide-react';
import { AiSummary } from './AiSummary';
import type { Language, TranslationKey } from '../lib/i18n';
import { unlockAudio, triggerHaptic, speakText, stopSpeech } from '../lib/audio';

type TFunction = (key: TranslationKey, replacements?: Record<string, string | number>) => string;

interface MessageFinderProps {
  userLocation: Coordinates;
  messages: Message[];
  currentUserId: string | null;
  hiddenMessageIds: Set<string>;
  onToggleHidden: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
  onStepCloser?: (targetLocation: Coordinates) => void;
  t: TFunction;
  lang: Language;
}

export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371e3; // metres
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
};

const DISCOVERY_RADIUS = 25; // meters for automatic cue playback

interface LandmarkCardProps {
  message: Message & { distance: number; isHidden: boolean };
  isPlaying: boolean;
  canDelete: boolean;
  onPlayAudio: (msg: Message) => void;
  onToggleHidden: (id: string) => void;
  onDelete: (id: string) => void;
  onWalkTowards?: (loc: Coordinates) => void;
  t: TFunction;
  lang: Language;
}

const LandmarkCard: React.FC<LandmarkCardProps> = ({
  message,
  isPlaying,
  canDelete,
  onPlayAudio,
  onToggleHidden,
  onDelete,
  onWalkTowards,
  t,
  lang,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isHidden, type } = message;
  const isPersonal = message.visibility === 'personal';
  const isInRange = message.distance <= DISCOVERY_RADIUS;

  const distanceFormatted =
    message.distance > 1000
      ? t('Card.distance_km', { distance: (message.distance / 1000).toFixed(1) })
      : t('Card.distance_m', { distance: Math.round(message.distance) });

  const landmarkType = type === 'audio' ? t('Card.type_audio') : t('Card.type_text');

  let ariaLabel = t('Card.landmark_aria', {
    name: message.name,
    type: landmarkType,
    visibility: isPersonal ? t('Card.personal') : t('Card.public'),
    distance: distanceFormatted,
    hiddenStatus: isHidden ? t('Card.hidden') : t('Card.visible'),
    playingStatus: isPlaying ? t('Card.playing') : t('Card.not_playing'),
  });

  if (type === 'text' && message.text) {
    ariaLabel += ' ' + t('Card.text_content_aria', { text: message.text });
  }

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    unlockAudio();
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const textToRead =
        type === 'text' && message.text
          ? `${message.name}. ${message.text}. Afstand: ${distanceFormatted}.`
          : `Geluidsbaken: ${message.name}. Gelegen op ${distanceFormatted} afstand.`;
      speakText(textToRead, lang);
      setTimeout(() => setIsSpeaking(false), 4500);
    }
  };

  const handleCardClick = () => {
    unlockAudio();
    triggerHaptic(40);
    if (type === 'audio') {
      onPlayAudio(message);
    } else {
      handleSpeak({ stopPropagation: () => {} } as any);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(40);
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-revert confirmation after 4 seconds
      setTimeout(() => {
        setConfirmDelete(false);
      }, 4000);
    } else {
      triggerHaptic([60, 40, 100]);
      onDelete(message.id);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none active:scale-[0.99] relative ${
        isPlaying
          ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-400/50 shadow-lg shadow-emerald-950/40'
          : isInRange
          ? 'bg-slate-800/90 border-cyan-500/80 shadow-md'
          : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
      } ${isHidden ? 'opacity-50 bg-slate-900/60' : ''}`}
      role="listitem"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex items-start space-x-3 flex-grow min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${
              isPlaying
                ? 'bg-emerald-500 text-slate-950 animate-bounce'
                : type === 'audio'
                ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                : 'bg-blue-950 text-blue-400 border border-blue-800'
            }`}
          >
            {type === 'audio' ? (
              isPlaying ? <Volume2 className="w-6 h-6 animate-pulse" /> : <Mic className="w-6 h-6" />
            ) : (
              <FileText className="w-6 h-6" />
            )}
          </div>

          <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-bold text-base sm:text-lg leading-tight truncate text-slate-100 ${isHidden ? 'line-through text-slate-400' : ''}`}>
                {message.name}
              </h3>
              {isInRange && !isHidden && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                  {t('Card.nearby_badge')}
                </span>
              )}
            </div>

            {type === 'text' && message.text && (
              <p className={`mt-1.5 text-sm text-slate-200 leading-snug line-clamp-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/60 ${isHidden ? 'text-slate-500' : ''}`}>
                {message.text}
              </p>
            )}

            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span className={`inline-flex items-center gap-1 font-semibold ${isInRange ? 'text-cyan-400' : 'text-slate-300'}`}>
                <MapPin className="w-3.5 h-3.5" />
                {distanceFormatted}
              </span>

              <span className="text-slate-600">•</span>

              <span className="inline-flex items-center gap-1 text-slate-400">
                {isPersonal ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-purple-300 font-medium">{t('Card.personal')}</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-medium">{t('Card.public')}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center space-x-1.5">
            {/* Read Aloud button */}
            <button
              type="button"
              onClick={handleSpeak}
              className={`p-2 rounded-xl border transition-all ${
                isSpeaking
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-600 border-slate-600'
              }`}
              aria-label={t(isSpeaking ? 'Card.stop_reading' : 'Card.read_aloud')}
              title={t(isSpeaking ? 'Card.stop_reading' : 'Card.read_aloud')}
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Hide/Show Toggle */}
            <button
              type="button"
              onClick={() => onToggleHidden(message.id)}
              className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white border border-slate-600 transition-colors"
              aria-label={t(isHidden ? 'Card.toggle_show_aria' : 'Card.toggle_hide_aria', { name: message.name })}
              title={t(isHidden ? 'Card.show_title' : 'Card.hide_title')}
            >
              {isHidden ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4" />}
            </button>

            {/* Delete button (for personal or user's landmarks) */}
            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className={`p-2 rounded-xl border transition-all ${
                  confirmDelete
                    ? 'bg-red-600 text-white border-red-500 ring-2 ring-red-400 animate-pulse'
                    : 'bg-slate-700/80 hover:bg-red-950 hover:text-red-400 text-slate-400 border-slate-600'
                }`}
                aria-label={t('Card.delete_aria', { name: message.name })}
                title={confirmDelete ? t('Card.delete_confirm_tap') : t('Card.delete_title')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {confirmDelete && (
            <div className="flex items-center gap-1.5 pt-1 animate-in fade-in duration-150">
              <span className="text-[11px] text-red-300 font-bold">
                {t('Card.delete_confirm_tap')}
              </span>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="p-1 rounded-md bg-slate-800 text-slate-400 hover:text-white text-[11px]"
                title={t('Card.cancel')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {onWalkTowards && message.distance > 5 && !confirmDelete && (
            <button
              type="button"
              onClick={() => onWalkTowards(message.location)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium pt-1"
              title={t('Card.step_closer')}
            >
              <Navigation className="w-3 h-3" />
              <span>{t('Card.step_closer')}</span>
            </button>
          )}
        </div>
      </div>

      {type === 'audio' && (
        <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {isPlaying ? t('Card.playing_cue') : t('Card.tap_to_play')}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlayAudio(message);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isPlaying
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-slate-700 text-slate-200 hover:bg-cyan-600 hover:text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                {t('Card.stop_cue')}
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                {t('Card.play_cue')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export const MessageFinder: React.FC<MessageFinderProps> = ({
  userLocation,
  messages,
  currentUserId,
  hiddenMessageIds,
  onToggleHidden,
  onDeleteMessage,
  onStepCloser,
  t,
  lang,
}) => {
  const [playingMessage, setPlayingMessage] = useState<Message | null>(null);
  const [triggeredMessageIds, setTriggeredMessageIds] = useState<Set<string>>(new Set());
  const [audioBlocked, setAudioBlocked] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition for Voice Search
  useEffect(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      const langMap: Record<Language, string> = {
        nl: 'nl-NL',
        en: 'en-US',
        es: 'es-ES',
        fr: 'fr-FR',
      };
      recognition.lang = langMap[lang] || 'nl-NL';

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setSearchQuery(transcript.trim());
          triggerHaptic([40, 40]);
          speakText(`${transcript}`, lang);
        }
        setIsVoiceListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsVoiceListening(false);
        if (event.error !== 'no-speech') {
          setVoiceError(t('Finder.voice_search_error'));
          setTimeout(() => setVoiceError(null), 3500);
        }
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [lang, t]);

  const toggleVoiceSearch = () => {
    triggerHaptic(40);
    unlockAudio();

    if (!recognitionRef.current) {
      setVoiceError(t('Finder.voice_search_error'));
      setTimeout(() => setVoiceError(null), 3500);
      return;
    }

    if (isVoiceListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsVoiceListening(false);
    } else {
      setVoiceError(null);
      try {
        recognitionRef.current.start();
        setIsVoiceListening(true);
        triggerHaptic([60, 40]);
      } catch (err) {
        console.warn('Could not start recognition:', err);
        setIsVoiceListening(false);
      }
    }
  };

  const processedMessages = useMemo(() => {
    if (!currentUserId) return [];
    return messages
      .filter((msg) => msg.visibility === 'public' || msg.authorId === currentUserId)
      .map((message) => ({
        ...message,
        distance: calculateDistance(userLocation, message.location),
        isHidden: hiddenMessageIds.has(message.id),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [userLocation, messages, currentUserId, hiddenMessageIds]);

  const activeMessages = useMemo(() => {
    return processedMessages.filter((m) => !m.isHidden);
  }, [processedMessages]);

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return processedMessages;

    return processedMessages.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.type === 'text' && m.text && m.text.toLowerCase().includes(q))
    );
  }, [processedMessages, searchQuery]);

  // Handle proximity trigger for audio landmarks
  useEffect(() => {
    const closestInRange = activeMessages.find(
      (msg) =>
        msg.distance <= DISCOVERY_RADIUS &&
        msg.type === 'audio' &&
        !triggeredMessageIds.has(msg.id)
    );

    if (closestInRange && closestInRange.audioUrl) {
      setPlayingMessage(closestInRange);
      setTriggeredMessageIds((prev) => new Set(prev).add(closestInRange.id));
      triggerHaptic([120, 80, 120]);

      if (audioRef.current) {
        audioRef.current.src = closestInRange.audioUrl;
        audioRef.current
          .play()
          .then(() => {
            setAudioBlocked(false);
          })
          .catch((e) => {
            console.warn('Android autoplay policy prevented playback until user tap:', e);
            setAudioBlocked(true);
          });
      }
    }
  }, [activeMessages, triggeredMessageIds]);

  const handlePlayAudio = (msg: Message) => {
    unlockAudio();
    triggerHaptic(50);

    if (playingMessage?.id === msg.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingMessage(null);
      return;
    }

    if (msg.audioUrl && audioRef.current) {
      audioRef.current.src = msg.audioUrl;
      setPlayingMessage(msg);
      setAudioBlocked(false);
      audioRef.current.play().catch((err) => {
        console.warn('Audio play error on Android:', err);
        setAudioBlocked(true);
      });
    }
  };

  const handleAudioEnded = () => {
    setPlayingMessage(null);
  };

  const handleManualUnlock = () => {
    unlockAudio();
    setAudioBlocked(false);
    if (playingMessage && audioRef.current && playingMessage.audioUrl) {
      audioRef.current.src = playingMessage.audioUrl;
      audioRef.current.play().catch(console.warn);
    }
  };

  const handleDelete = (id: string) => {
    if (playingMessage?.id === id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingMessage(null);
    }
    if (onDeleteMessage) {
      onDeleteMessage(id);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" playsInline />
      <h2 className="text-2xl font-bold text-center sr-only">{t('Finder.title')}</h2>

      {/* Accessible Search Bar Supporting Both Text and Voice Input */}
      <div className="relative bg-slate-850 p-2.5 rounded-2xl border border-slate-700/80 shadow-md">
        <div className="relative flex items-center">
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            <Search className="w-5 h-5 text-cyan-400" />
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Finder.search_placeholder')}
            aria-label={t('Finder.search_aria')}
            className="w-full bg-slate-800 text-slate-100 placeholder-slate-400 text-sm font-medium pl-10 pr-20 py-3 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
          />

          <div className="absolute right-2 flex items-center space-x-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                aria-label={t('Finder.clear_search')}
                title={t('Finder.clear_search')}
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Voice Search Button */}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                isVoiceListening
                  ? 'bg-red-600 text-white ring-4 ring-red-500/40 animate-pulse'
                  : 'bg-slate-700 text-cyan-300 hover:bg-cyan-600 hover:text-white'
              }`}
              aria-label={t(
                isVoiceListening ? 'Finder.voice_search_listening' : 'Finder.voice_search_start'
              )}
              title={t(
                isVoiceListening ? 'Finder.voice_search_listening' : 'Finder.voice_search_start'
              )}
            >
              <Mic className={`w-4 h-4 ${isVoiceListening ? 'animate-bounce' : ''}`} />
            </button>
          </div>
        </div>

        {/* Listening indicator badge */}
        {isVoiceListening && (
          <div className="mt-2 p-2 bg-red-950/80 border border-red-800 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold text-red-200 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>{t('Finder.voice_search_listening')}</span>
          </div>
        )}

        {/* Voice error notice */}
        {voiceError && (
          <div className="mt-2 p-2 bg-amber-950/80 border border-amber-800 rounded-xl flex items-center space-x-2 text-xs text-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{voiceError}</span>
          </div>
        )}

        {/* Search match stats */}
        {searchQuery.trim() && (
          <div className="mt-2 px-1 flex items-center justify-between text-xs text-slate-400">
            <span>
              {t('Finder.search_results_count', {
                count: filteredMessages.length,
                query: searchQuery.trim(),
              })}
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-cyan-400 hover:underline font-semibold"
            >
              {t('Finder.clear_search')}
            </button>
          </div>
        )}
      </div>

      {/* AI Accessibility Overview & TTS (only when not actively searching) */}
      {!searchQuery && <AiSummary messages={activeMessages} t={t} lang={lang} />}

      {/* Android Audio Autoplay Unlock Prompt */}
      {audioBlocked && (
        <div
          onClick={handleManualUnlock}
          className="p-3 bg-cyan-950 border-2 border-cyan-400 rounded-xl text-cyan-200 text-xs flex items-center justify-between cursor-pointer animate-pulse-slow shadow-lg shadow-cyan-950/60"
        >
          <div className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-cyan-400 flex-shrink-0 animate-bounce" />
            <span>
              <strong>Audio Landmark Nearby!</strong> Tap here to enable audio cue.
            </span>
          </div>
          <button
            type="button"
            className="px-2.5 py-1 bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs"
          >
            Play Now
          </button>
        </div>
      )}

      {playingMessage && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/80 rounded-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2 text-emerald-300 text-sm font-semibold">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span>{t('Finder.playing', { name: playingMessage.name })}</span>
          </div>
          <button
            type="button"
            onClick={() => handlePlayAudio(playingMessage)}
            className="text-xs bg-emerald-800 text-white px-2 py-1 rounded-md"
          >
            Stop
          </button>
        </div>
      )}

      {/* Landmarks List */}
      {processedMessages.length > 0 ? (
        <>
          {filteredMessages.length === 0 ? (
            <div className="text-center text-slate-400 py-8 px-4 bg-slate-850/60 rounded-2xl border border-slate-700/60 flex flex-col items-center">
              <Search className="w-8 h-8 text-slate-500 mb-2" />
              <p className="font-semibold text-slate-300">
                {t('Finder.no_search_results', { query: searchQuery })}
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-lg border border-slate-700"
              >
                {t('Finder.clear_search')}
              </button>
            </div>
          ) : (
            <div className="space-y-3" role="list">
              {filteredMessages.map((msg) => (
                <LandmarkCard
                  key={msg.id}
                  message={msg as Message & { distance: number; isHidden: boolean }}
                  isPlaying={playingMessage?.id === msg.id}
                  canDelete={msg.visibility === 'personal' || msg.authorId === currentUserId}
                  onPlayAudio={handlePlayAudio}
                  onToggleHidden={onToggleHidden}
                  onDelete={handleDelete}
                  onWalkTowards={onStepCloser}
                  t={t}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-slate-400 py-12 flex flex-col items-center bg-slate-850/40 rounded-2xl border border-slate-700/40 p-6">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4 text-cyan-400 border border-slate-700">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-200">{t('Finder.no_landmarks_title')}</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">{t('Finder.no_landmarks_subtitle')}</p>
        </div>
      )}
    </div>
  );
};

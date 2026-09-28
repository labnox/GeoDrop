import React, { useState, useEffect, useRef } from 'react';
import { AudioRecorder } from './AudioRecorder';
import {
  Globe,
  Lock,
  Mic,
  FileText,
  MapPin,
  Check,
  Radio,
  Volume2,
  X,
  Sparkles,
} from 'lucide-react';
import type { Language, TranslationKey } from '../lib/i18n';
import { triggerHaptic, unlockAudio, speakText } from '../lib/audio';

type TFunction = (key: TranslationKey, replacements?: Record<string, string | number>) => string;
type LandmarkType = 'audio' | 'text';

interface MessagePlacerProps {
  onAddMessage: (
    details: { name: string; type: LandmarkType; audioUrl?: string; text?: string },
    visibility: 'public' | 'personal'
  ) => void;
  disabled: boolean;
  t: TFunction;
  lang?: Language;
}

const QUICK_PRESETS = [
  'Bushalte',
  'Voetgangersoversteek',
  'Gebouwingang',
  'Treinperron',
  'Trap / Treden',
  'Lift',
];

const LandmarkTypeToggle: React.FC<{
  landmarkType: LandmarkType;
  setLandmarkType: React.Dispatch<React.SetStateAction<LandmarkType>>;
  t: TFunction;
}> = ({ landmarkType, setLandmarkType, t }) => (
  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-700/80">
    <button
      type="button"
      onClick={() => {
        triggerHaptic(30);
        setLandmarkType('audio');
      }}
      className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${
        landmarkType === 'audio'
          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50 ring-2 ring-cyan-400/50'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'
      }`}
      aria-pressed={landmarkType === 'audio'}
    >
      <Mic className="w-4 h-4 mr-2" />
      {t('Placer.type_audio')}
    </button>
    <button
      type="button"
      onClick={() => {
        triggerHaptic(30);
        setLandmarkType('text');
      }}
      className={`py-3 px-3 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${
        landmarkType === 'text'
          ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50 ring-2 ring-cyan-400/50'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'
      }`}
      aria-pressed={landmarkType === 'text'}
    >
      <FileText className="w-4 h-4 mr-2" />
      {t('Placer.type_text')}
    </button>
  </div>
);

/**
 * Clear, large, accessible selection cards for visibility.
 */
const VisibilitySelector: React.FC<{
  visibility: 'public' | 'personal';
  setVisibility: React.Dispatch<React.SetStateAction<'public' | 'personal'>>;
  t: TFunction;
}> = ({ visibility, setVisibility, t }) => (
  <div className="space-y-2.5">
    {/* Option 1: Openbaar / Public */}
    <button
      type="button"
      onClick={() => {
        triggerHaptic(35);
        setVisibility('public');
      }}
      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-start justify-between gap-3 ${
        visibility === 'public'
          ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/50'
          : 'bg-slate-850/90 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
      }`}
      role="radio"
      aria-checked={visibility === 'public'}
    >
      <div className="flex items-start space-x-3 min-w-0">
        <div
          className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
            visibility === 'public'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-emerald-400 border border-slate-700'
          }`}
        >
          <Globe className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">{t('Placer.public_title')}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
              Iedereen
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-snug">{t('Placer.public_desc')}</p>
        </div>
      </div>

      <div className="flex-shrink-0 pt-0.5">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
            visibility === 'public'
              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
              : 'border-slate-600 bg-slate-800'
          }`}
        >
          {visibility === 'public' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      </div>
    </button>

    {/* Option 2: Persoonlijk / Private */}
    <button
      type="button"
      onClick={() => {
        triggerHaptic(35);
        setVisibility('personal');
      }}
      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-start justify-between gap-3 ${
        visibility === 'personal'
          ? 'bg-purple-950/80 border-purple-400 ring-2 ring-purple-500/40 shadow-lg shadow-purple-950/50'
          : 'bg-slate-850/90 border-slate-700/80 hover:border-slate-600 hover:bg-slate-800'
      }`}
      role="radio"
      aria-checked={visibility === 'personal'}
    >
      <div className="flex items-start space-x-3 min-w-0">
        <div
          className={`p-2.5 rounded-xl flex-shrink-0 transition-colors ${
            visibility === 'personal'
              ? 'bg-purple-500 text-white font-bold'
              : 'bg-slate-800 text-purple-400 border border-slate-700'
          }`}
        >
          <Lock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">{t('Placer.personal_title')}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/60">
              Alleen voor jou
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-snug">{t('Placer.personal_desc')}</p>
        </div>
      </div>

      <div className="flex-shrink-0 pt-0.5">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
            visibility === 'personal'
              ? 'bg-purple-500 border-purple-400 text-white'
              : 'border-slate-600 bg-slate-800'
          }`}
        >
          {visibility === 'personal' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      </div>
    </button>
  </div>
);

export const MessagePlacer: React.FC<MessagePlacerProps> = ({
  onAddMessage,
  disabled,
  t,
  lang = 'nl',
}) => {
  const [name, setName] = useState('');
  const [landmarkType, setLandmarkType] = useState<LandmarkType>('audio');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'personal'>('public');

  // Web Speech API dictation states
  const [isDictatingText, setIsDictatingText] = useState(false);
  const [isDictatingName, setIsDictatingName] = useState(false);
  const textRecognitionRef = useRef<any>(null);
  const nameRecognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (textRecognitionRef.current) {
        try {
          textRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (nameRecognitionRef.current) {
        try {
          nameRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Web Speech API dictation for Description
  const toggleTextDictation = () => {
    triggerHaptic(40);
    unlockAudio();

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert('Spraakherkenning wordt niet ondersteund in deze browser.');
      return;
    }

    if (isDictatingText) {
      try {
        textRecognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsDictatingText(false);
    } else {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'nl-NL';

        recognition.onresult = (event: any) => {
          let full = '';
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript + ' ';
          }
          if (full.trim()) {
            setText(full.trim());
          }
        };

        recognition.onerror = () => {
          setIsDictatingText(false);
        };

        recognition.onend = () => {
          setIsDictatingText(false);
        };

        recognition.start();
        textRecognitionRef.current = recognition;
        setIsDictatingText(true);
        triggerHaptic([50, 50]);
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
        setIsDictatingText(false);
      }
    }
  };

  // Web Speech API dictation for Name
  const toggleNameDictation = () => {
    triggerHaptic(40);
    unlockAudio();

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    if (isDictatingName) {
      try {
        nameRecognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsDictatingName(false);
    } else {
      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'nl-NL';

        recognition.onresult = (event: any) => {
          const spoken = event.results?.[0]?.[0]?.transcript;
          if (spoken) {
            setName(spoken.trim());
            triggerHaptic(40);
          }
          setIsDictatingName(false);
        };

        recognition.onerror = () => {
          setIsDictatingName(false);
        };

        recognition.onend = () => {
          setIsDictatingName(false);
        };

        recognition.start();
        nameRecognitionRef.current = recognition;
        setIsDictatingName(true);
      } catch (err) {
        console.warn('Name recognition start failed:', err);
        setIsDictatingName(false);
      }
    }
  };

  const handleAudioRecordComplete = (newAudioUrl: string, transcript?: string) => {
    setAudioUrl(newAudioUrl);
    // If name is empty, auto-populate from the spoken transcript
    if (!name.trim() && transcript) {
      const suggestedName =
        transcript.length > 35 ? transcript.substring(0, 35).trim() + '...' : transcript;
      setName(suggestedName);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    triggerHaptic([50, 50, 150]);

    if (landmarkType === 'audio' && audioUrl) {
      onAddMessage({ name: name.trim(), type: 'audio', audioUrl }, visibility);
    } else if (landmarkType === 'text' && text.trim()) {
      onAddMessage({ name: name.trim(), type: 'text', text: text.trim() }, visibility);
    }

    setName('');
    setAudioUrl(null);
    setText('');
  };

  if (disabled) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 h-full bg-slate-800/60 rounded-2xl border border-slate-700">
        <MapPin className="w-12 h-12 text-slate-500 mb-3 animate-pulse" />
        <p className="text-slate-300 font-medium">{t('Placer.disabled_prompt')}</p>
      </div>
    );
  }

  const isSubmittable =
    name.trim().length > 0 &&
    ((landmarkType === 'audio' && audioUrl) || (landmarkType === 'text' && text.trim().length > 0));

  return (
    <div className="flex flex-col h-full space-y-4 pb-16">
      <h2 className="text-xl font-bold text-center text-slate-100">{t('Placer.title')}</h2>

      <div className="flex flex-col space-y-4 flex-grow">
        {/* Name Input with Dictation */}
        <div>
          <label
            htmlFor="landmark-name"
            className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5"
          >
            {t('Placer.name_label')}
          </label>
          <div className="relative flex items-center">
            <input
              id="landmark-name"
              type="text"
              className="w-full p-3.5 pr-12 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-slate-100 placeholder-slate-500 text-sm font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Placer.name_placeholder')}
              aria-label={t('Placer.name_aria')}
            />

            {/* Voice Dictate Name Button */}
            <button
              type="button"
              onClick={toggleNameDictation}
              className={`absolute right-2 p-2 rounded-lg transition-all ${
                isDictatingName
                  ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                  : 'bg-slate-700 hover:bg-slate-600 text-cyan-300'
              }`}
              title={t('Placer.dictate_name_btn')}
              aria-label={t('Placer.dictate_name_btn')}
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>

          {/* Quick preset suggestions */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  triggerHaptic(20);
                  setName(preset);
                }}
                className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-cyan-300 text-xs font-medium border border-slate-700 transition-colors active:scale-95"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
            {t('Placer.type_label')}
          </label>
          <LandmarkTypeToggle
            landmarkType={landmarkType}
            setLandmarkType={setLandmarkType}
            t={t}
          />
        </div>

        {/* Content input */}
        {landmarkType === 'audio' ? (
          <div>
            <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
              {t('Placer.record_label')}
            </label>
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80">
              <AudioRecorder onRecordComplete={handleAudioRecordComplete} t={t} lang={lang} />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="landmark-text"
                className="block text-xs font-bold text-cyan-400 uppercase tracking-wider"
              >
                {t('Placer.text_label')}
              </label>

              {/* Dictate Voice Note Button using Web Speech API */}
              <button
                type="button"
                onClick={toggleTextDictation}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  isDictatingText
                    ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                    : 'bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800'
                }`}
                title={t(isDictatingText ? 'Placer.dictate_stop' : 'Placer.dictate_btn')}
                aria-label={t(isDictatingText ? 'Placer.dictate_stop' : 'Placer.dictate_btn')}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{t(isDictatingText ? 'Placer.dictate_stop' : 'Placer.dictate_btn')}</span>
              </button>
            </div>

            <textarea
              id="landmark-text"
              className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none min-h-[110px] text-slate-100 placeholder-slate-500 text-sm leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('Placer.text_placeholder')}
              aria-label={t('Placer.text_label')}
            />

            {isDictatingText && (
              <div className="mt-2 p-2 bg-red-950/80 border border-red-800 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold text-red-200 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span>{t('Placer.dictate_listening')}</span>
              </div>
            )}
          </div>
        )}

        {/* Visibility Selector */}
        <div>
          <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
            {t('Placer.visibility_label')}
          </label>
          <VisibilitySelector visibility={visibility} setVisibility={setVisibility} t={t} />
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isSubmittable}
          className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-cyan-950/40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mt-4 active:scale-98"
          aria-label={t('Placer.drop_button_aria')}
        >
          {landmarkType === 'audio' ? <Mic className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          <span>{t('Placer.drop_button')}</span>
        </button>
      </div>
    </div>
  );
};

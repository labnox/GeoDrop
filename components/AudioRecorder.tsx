import React, { useState, useRef, useEffect } from 'react';
import { RecordingState } from '../types';
import {
  Mic,
  StopCircle,
  Play,
  Trash2,
  CheckCircle,
  Radio,
  BellRing,
  AlertCircle,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { Language, TranslationKey } from '../lib/i18n';
import { triggerHaptic, createBeaconChimeBlob, unlockAudio } from '../lib/audio';

type TFunction = (key: TranslationKey, replacements?: Record<string, string | number>) => string;

interface AudioRecorderProps {
  onRecordComplete: (audioUrl: string, transcript?: string) => void;
  t: TFunction;
  lang?: Language;
}

const getSupportedMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/aac',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
};

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordComplete,
  t,
  lang = 'nl',
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.Idle);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordDuration, setRecordDuration] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [stream]);

  const startRecording = async () => {
    setErrorMessage(null);
    setTranscript('');
    unlockAudio();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setStream(mediaStream);
      setRecordingState(RecordingState.Recording);
      setRecordDuration(0);
      triggerHaptic([60, 40, 60]);

      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      // Start MediaRecorder
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(mediaStream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const actualType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualType });

        // Convert audio to persistent base64 Data URL so it survives page reloads
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Url = reader.result as string;
          setAudioUrl(base64Url);
          setRecordingState(RecordingState.Recorded);
        };
        reader.readAsDataURL(audioBlob);

        audioChunksRef.current = [];
        mediaStream.getTracks().forEach((track) => track.stop());
        setStream(null);
        triggerHaptic(80);
      };

      mediaRecorder.start(250);

      // Also start SpeechRecognition concurrently if available to transcribe voice note
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          const langMap: Record<Language, string> = {
            nl: 'nl-NL',
            en: 'en-US',
            es: 'es-ES',
            fr: 'fr-FR',
          };
          recognition.lang = langMap[lang] || 'nl-NL';

          recognition.onresult = (event: any) => {
            let currentTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
              currentTranscript += event.results[i][0].transcript + ' ';
            }
            if (currentTranscript.trim()) {
              setTranscript(currentTranscript.trim());
            }
          };

          recognition.onerror = () => {
            // Non-critical, audio recording still functions
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      console.warn('Microphone access issue:', err);
      setErrorMessage(t('Recorder.mic_error'));
      triggerHaptic([100, 100, 100]);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === RecordingState.Recording) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  };

  const useDefaultBeaconChime = async (tone: 'bus' | 'crossing' | 'default' = 'default') => {
    setErrorMessage(null);
    setTranscript(
      tone === 'bus'
        ? 'Akoestisch bushalte belsignaal'
        : tone === 'crossing'
        ? 'Akoestische voetgangersoversteek pieptoon'
        : 'Standaard akoestisch belsignaal'
    );
    const chimeUrl = await createBeaconChimeBlob(tone);
    if (chimeUrl) {
      setAudioUrl(chimeUrl);
      setRecordingState(RecordingState.Recorded);
      triggerHaptic(50);
    }
  };

  const togglePlay = () => {
    unlockAudio();
    if (audioRef.current) {
      if (recordingState === RecordingState.Playing) {
        audioRef.current.pause();
        setRecordingState(RecordingState.Recorded);
      } else {
        audioRef.current.play().catch((e) => console.warn('Playback error:', e));
        setRecordingState(RecordingState.Playing);
      }
    }
  };

  const handleAudioEnded = () => {
    setRecordingState(RecordingState.Recorded);
  };

  const resetRecording = () => {
    setAudioUrl(null);
    setTranscript('');
    setRecordingState(RecordingState.Idle);
    setRecordDuration(0);
    triggerHaptic(40);
  };

  const confirmRecording = () => {
    if (audioUrl) {
      onRecordComplete(audioUrl, transcript.trim());
      setAudioUrl(null);
      setTranscript('');
      setRecordingState(RecordingState.Idle);
      triggerHaptic([50, 50, 100]);
    }
  };

  const renderControls = () => {
    switch (recordingState) {
      case RecordingState.Idle:
        return (
          <div className="flex flex-col items-center space-y-4 w-full">
            <button
              type="button"
              onClick={startRecording}
              className="w-20 h-20 sm:w-24 sm:h-24 bg-red-600 hover:bg-red-500 active:scale-95 rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-red-950/50 transition-all border-4 border-red-400/50 focus:ring-4 focus:ring-red-400"
              aria-label={t('Recorder.start_aria')}
            >
              <Mic className="w-10 h-10 animate-pulse" />
            </button>
            <div className="text-center">
              <p className="text-sm text-slate-100 font-bold">Tik om spraaknotitie op te nemen</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Spreek vrijuit; jouw stem wordt opgenomen als baken
              </p>
            </div>

            <div className="pt-3 border-t border-slate-700/60 w-full flex flex-col items-center">
              <span className="text-xs text-slate-400 mb-2 font-medium">
                Of kies een akoestisch belsignaal:
              </span>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => useDefaultBeaconChime('default')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-cyan-800/60 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Standaard belsignaal
                </button>
                <button
                  type="button"
                  onClick={() => useDefaultBeaconChime('crossing')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold border border-emerald-800/60 flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Oversteek pieptoon
                </button>
              </div>
            </div>
          </div>
        );

      case RecordingState.Recording:
        return (
          <div className="flex flex-col items-center space-y-4 w-full">
            <button
              type="button"
              onClick={stopRecording}
              className="w-20 h-20 sm:w-24 sm:h-24 bg-red-700 hover:bg-red-600 active:scale-95 rounded-full flex items-center justify-center text-white ring-8 ring-red-500/30 transition-all shadow-xl"
              aria-label={t('Recorder.stop_aria')}
            >
              <StopCircle className="w-12 h-12 text-white animate-pulse" />
            </button>

            <div className="flex items-center text-red-400 font-bold text-sm">
              <Radio className="w-4 h-4 mr-2 animate-ping" />
              <span>
                {t('Recorder.recording_text')} ({recordDuration}s)
              </span>
            </div>

            {transcript && (
              <div className="w-full p-3 bg-slate-900/80 rounded-xl border border-cyan-800/50 text-xs text-cyan-200 animate-in fade-in">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                  Live transcriptie:
                </span>
                <p className="italic leading-relaxed">"{transcript}"</p>
              </div>
            )}
          </div>
        );

      case RecordingState.Recorded:
      case RecordingState.Playing:
        return (
          <div className="flex flex-col items-center space-y-4 w-full">
            <audio
              ref={audioRef}
              src={audioUrl || ''}
              onEnded={handleAudioEnded}
              className="hidden"
            />

            {transcript && (
              <div className="w-full p-3 bg-slate-900/80 rounded-xl border border-slate-700 text-xs text-slate-200">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                  Herkende tekst:
                </span>
                <p className="font-medium text-slate-100 leading-relaxed">"{transcript}"</p>
              </div>
            )}

            <div className="flex items-center justify-center space-x-5">
              <button
                type="button"
                onClick={resetRecording}
                className="p-3.5 bg-slate-700 hover:bg-slate-600 active:scale-90 rounded-2xl text-slate-300 hover:text-white transition-all shadow border border-slate-600"
                aria-label={t('Recorder.discard_aria')}
                title={t('Recorder.discard_aria')}
              >
                <Trash2 className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="p-4 bg-cyan-600 hover:bg-cyan-500 active:scale-95 rounded-2xl text-white transition-all shadow-lg shadow-cyan-950/50"
                aria-label={t(
                  recordingState === RecordingState.Playing
                    ? 'Recorder.pause_aria'
                    : 'Recorder.play_aria'
                )}
                title="Voorbeeld beluisteren"
              >
                {recordingState === RecordingState.Playing ? (
                  <StopCircle className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={confirmRecording}
                className="p-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-90 rounded-2xl text-white transition-all shadow-lg shadow-emerald-950/50"
                aria-label={t('Recorder.confirm_aria')}
                title="Koppel deze opname"
              >
                <CheckCircle className="w-6 h-6" />
              </button>
            </div>
            <p className="text-xs text-emerald-400 font-semibold">
              Gesproken notitie gereed. Tik op het groene vinkje om te koppelen.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-2">
      {errorMessage && (
        <div className="mb-3 p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2 w-full">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{errorMessage}</p>
            <p className="mt-1 text-slate-300">
              Je kunt microfoontoestemming inschakelen in de browserinstellingen, of een van de
              kant-en-klare geluidsbakens hierboven gebruiken.
            </p>
          </div>
        </div>
      )}
      {renderControls()}
    </div>
  );
};

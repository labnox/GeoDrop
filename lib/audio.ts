import { Language } from './i18n';

/**
 * Web Audio and Accessibility utilities optimized for Android mobile devices.
 */

let audioUnlocked = false;

/**
 * Unlocks the Web Audio context on Android on the first touch/click.
 */
export const unlockAudio = () => {
  if (audioUnlocked) return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      audioUnlocked = true;
    }
  } catch (err) {
    console.warn("Could not unlock audio context:", err);
  }
};

/**
 * Haptic vibration feedback for Android mobile devices.
 */
export const triggerHaptic = (pattern: number | number[] = 80) => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported
  }
};

/**
 * Text-to-Speech (TTS) for blind & visually impaired users.
 */
export const speakText = (text: string, lang: Language = 'en'): void => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<Language, string> = {
      en: 'en-US',
      nl: 'nl-NL',
      es: 'es-ES',
      fr: 'fr-FR',
    };
    utterance.lang = langMap[lang] || 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const prefix = langMap[lang] ? langMap[lang].slice(0, 2) : 'en';
    const matchingVoice = voices.find(v => v.lang.startsWith(prefix));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
    triggerHaptic(40);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
};

export const stopSpeech = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Generates an acoustic beacon chime for audio landmarks.
 * Produces an authentic spatial beacon sound (soft harmonic chime) as a data URL.
 */
export const createBeaconChimeBlob = (tone: 'bus' | 'crossing' | 'default' = 'default'): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const sampleRate = 44100;
      const duration = 1.2;
      const numSamples = Math.floor(sampleRate * duration);
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      
      if (!AudioContextClass) {
        resolve('');
        return;
      }

      const offlineCtx = new OfflineAudioContext(1, numSamples, sampleRate);
      const osc = offlineCtx.createOscillator();
      const osc2 = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();

      const baseFreq = tone === 'crossing' ? 880 : tone === 'bus' ? 587.33 : 659.25; // A5 or D5 or E5

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, 0);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, 0.4);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 0.5, 0);

      gain.gain.setValueAtTime(0.001, 0);
      gain.gain.exponentialRampToValueAtTime(0.4, 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, duration);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(0);
      osc2.start(0);
      osc.stop(duration);
      osc2.stop(duration);

      offlineCtx.startRendering().then((renderedBuffer) => {
        // Encode as WAV
        const wavBuffer = audioBufferToWav(renderedBuffer);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        resolve(URL.createObjectURL(blob));
      }).catch(() => resolve(''));
    } catch {
      resolve('');
    }
  });
};

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  writeString('RIFF');
  setUint32(length - 8);
  writeString('WAVE');
  writeString('fmt ');
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  writeString('data');
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return out.buffer;
}

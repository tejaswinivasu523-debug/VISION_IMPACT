import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureVoice, primeVoices, speak } from './voice';

const STORAGE_KEY = 'visionpath:settings';

const defaults = {
  voice: true,
  volume: 0.9,
  rate: 1,
  pitch: 1,
  lang: 'en-IN',
  textScale: 1,
  highContrast: false,
  reducedMotion: false,
  colourBlind: false,
  haptics: true,
  sensitivity: 'balanced',
  autoSpeakAlerts: true,
  guardianEmail: '',
};

const SettingsContext = createContext(null);

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(readStored);
  const [voiceName, setVoiceName] = useState('');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    root.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
    root.dataset.cb = settings.colourBlind ? 'true' : 'false';
    root.style.setProperty('--scale', String(settings.textScale));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    configureVoice({
      enabled: settings.voice,
      volume: settings.volume,
      rate: settings.rate,
      pitch: settings.pitch,
      lang: settings.lang,
      haptics: settings.haptics,
    });
  }, [settings]);

  useEffect(() => {
    primeVoices();
    const t = setTimeout(() => {
      if ('speechSynthesis' in window) {
        const v = window.speechSynthesis
          .getVoices()
          .find((x) => x.lang === settings.lang);
        if (v) setVoiceName(v.name);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [settings.lang]);

  const update = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(defaults), []);

  const testVoice = useCallback(() => {
    speak('VisionPath voice is ready. Guiding you safely.', { force: true, priority: 'high' });
  }, []);

  const value = useMemo(
    () => ({ settings, update, reset, testVoice, voiceName }),
    [settings, update, reset, testVoice, voiceName],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}

/** Persist a named list (alerts history, contacts) in localStorage. */
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`visionpath:${key}`);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(`visionpath:${key}`, JSON.stringify(value));
      } catch {
        /* quota — ignore */
      }
    }, 200);
    return () => clearTimeout(timer.current);
  }, [key, value]);
  return [value, setValue];
}

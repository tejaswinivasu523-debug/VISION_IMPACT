/**
 * Live speech output. Used by scan guidance, alerts, SOS and crossing pages.
 * A single global voice configuration is kept in sync with user settings.
 */
let config = {
  enabled: true,
  volume: 0.9,
  rate: 1,
  pitch: 1,
  lang: 'en-IN',
  haptics: true,
};

const recent = new Map(); // normalised text -> timestamp
let cachedVoice = null;

export function configureVoice(next = {}) {
  config = { ...config, ...next };
  cachedVoice = null;
}

export function getVoiceConfig() {
  return config;
}

function pickVoice(lang) {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const byLang = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith(lang?.slice(0, 2)));
  return byLang || voices.find((v) => /en-IN|en-GB|en-US/i.test(v.lang)) || voices[0];
}

export function primeVoices() {
  if (!('speechSynthesis' in window)) return;
  cachedVoice = pickVoice(config.lang);
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = pickVoice(config.lang);
  };
}

export function speak(text, options = {}) {
  if (!text) return false;
  const {
    priority = 'normal',
    force = false,
    rate = config.rate,
    pitch = config.pitch,
    lang = config.lang,
    volume = config.volume,
    enabled = config.enabled,
  } = options;

  if (typeof navigator !== 'undefined' && navigator.vibrate && config.haptics && priority !== 'normal') {
    navigator.vibrate(priority === 'critical' ? [40, 40, 40] : 30);
  }
  if (!enabled || !('speechSynthesis' in window)) return false;

  const key = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const now = Date.now();
  const prev = recent.get(key);
  if (!force && prev && now - prev < 2200) return false;
  recent.set(key, now);

  const synth = window.speechSynthesis;
  if (!cachedVoice) cachedVoice = pickVoice(lang);
  if (priority === 'critical' || priority === 'high') synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = Math.min(2, Math.max(0.5, rate));
  utter.pitch = Math.min(2, Math.max(0, pitch));
  utter.volume = Math.min(1, Math.max(0, volume));
  utter.lang = lang;
  if (cachedVoice) utter.voice = cachedVoice;
  try {
    synth.speak(utter);
  } catch {
    return false;
  }
  return true;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

import { Platform } from 'react-native';

import { getItem, getItemSyncWeb, hasSyncWebStorage, setItem } from 'lib/app-storage';

export type TalkbackSettings = {
  enabled: boolean;
  lang: string;
  rate: number;
  pitch: number;
};

const STORAGE_KEY = 'talkback-settings-v1';

export const defaultTalkbackSettings: TalkbackSettings = {
  enabled: false,
  lang: 'nl-BE',
  rate: 1,
  pitch: 1,
};

let cached: TalkbackSettings = defaultTalkbackSettings;
let hydrationStarted = false;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

async function hydrate() {
  if (hydrationStarted) return;
  hydrationStarted = true;

  const raw = hasSyncWebStorage() ? getItemSyncWeb(STORAGE_KEY) : await getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Partial<TalkbackSettings>;
    cached = {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultTalkbackSettings.enabled,
      lang: typeof parsed.lang === 'string' && parsed.lang.trim() ? parsed.lang : defaultTalkbackSettings.lang,
      rate: clamp(Number(parsed.rate ?? defaultTalkbackSettings.rate), 0.4, 2),
      pitch: clamp(Number(parsed.pitch ?? defaultTalkbackSettings.pitch), 0.5, 2),
    };
  } catch {
    // ignore
  }
}

hydrate().catch(() => {});

export function loadTalkbackSettings() {
  return cached;
}

export function saveTalkbackSettings(next: TalkbackSettings) {
  cached = next;
  setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

export function canTalkBack() {
  if (Platform.OS !== 'web') return true;
  const anyGlobal = globalThis as any;
  return (
    typeof anyGlobal !== 'undefined' &&
    typeof anyGlobal.speechSynthesis !== 'undefined' &&
    typeof anyGlobal.SpeechSynthesisUtterance !== 'undefined'
  );
}

export async function stopTalkBack() {
  if (Platform.OS === 'web') {
    try {
      (globalThis as any).speechSynthesis?.cancel?.();
    } catch {
      // ignore
    }
    return;
  }

  try {
    const Speech = await import('expo-speech');
    Speech.stop();
  } catch {
    // ignore
  }
}

export async function talkBack(text: string, override?: Partial<TalkbackSettings>) {
  const settings = { ...cached, ...(override ?? {}) };
  if (!settings.enabled) return;
  const trimmed = text.trim();
  if (!trimmed) return;

  if (Platform.OS === 'web') {
    if (!canTalkBack()) return;
    const synth = (globalThis as any).speechSynthesis as SpeechSynthesis;
    const Utterance = (globalThis as any).SpeechSynthesisUtterance as typeof SpeechSynthesisUtterance;

    try {
      synth.cancel();
      synth.resume?.();
    } catch {
      // ignore
    }

    const utterance = new Utterance(trimmed);
    utterance.lang = settings.lang;
    utterance.rate = clamp(settings.rate, 0.4, 2);
    utterance.pitch = clamp(settings.pitch, 0.5, 2);
    synth.speak(utterance);
    return;
  }

  try {
    const Speech = await import('expo-speech');
    Speech.speak(trimmed, {
      language: settings.lang,
      rate: clamp(settings.rate, 0.4, 2),
      pitch: clamp(settings.pitch, 0.5, 2),
    });
  } catch {
    // ignore
  }
}

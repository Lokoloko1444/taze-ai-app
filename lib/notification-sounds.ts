import { getItem, getItemSyncWeb, hasSyncWebStorage, setItem } from 'lib/app-storage';
import { Platform } from 'react-native';

export type SoundPresetId = 'silent' | 'beep' | 'double' | 'success' | 'warning' | 'error';

export type SoundEventId =
  | 'expiry'
  | 'restock'
  | 'recognition'
  | 'trace'
  | 'finance_profit'
  | 'finance_loss'
  | 'finance_neutral';

export type SoundSettings = {
  enabled: boolean;
  volume: number; // 0..1
  byEvent: Record<SoundEventId, SoundPresetId>;
};

const STORAGE_KEY = 'ria-sounds-v1';

export const soundPresets: Array<{ id: SoundPresetId; label: string }> = [
  { id: 'silent', label: 'Stil' },
  { id: 'beep', label: 'Beep' },
  { id: 'double', label: 'Dubbel' },
  { id: 'success', label: 'Winst' },
  { id: 'warning', label: 'Warning' },
  { id: 'error', label: 'Error' },
];

export const defaultSoundSettings: SoundSettings = {
  enabled: true,
  volume: 0.3,
  byEvent: {
    expiry: 'warning',
    restock: 'beep',
    recognition: 'double',
    trace: 'double',
    finance_profit: 'success',
    finance_loss: 'error',
    finance_neutral: 'beep',
  },
};

let cachedSettings: SoundSettings = defaultSoundSettings;
let settingsHydrationStarted = false;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function hydrateSoundSettings() {
  if (settingsHydrationStarted) return;
  settingsHydrationStarted = true;

  if (hasSyncWebStorage()) {
    cachedSettings = loadSoundSettings();
    return;
  }

  const raw = await getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    const byEvent = { ...defaultSoundSettings.byEvent, ...(parsed.byEvent ?? {}) } as SoundSettings['byEvent'];
    const volume = clamp01(Number(parsed.volume ?? defaultSoundSettings.volume));
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultSoundSettings.enabled;
    cachedSettings = { enabled, volume, byEvent };
  } catch {
    // ignore
  }
}

hydrateSoundSettings().catch(() => {});

export function loadSoundSettings(): SoundSettings {
  if (!hasSyncWebStorage()) return cachedSettings;

  try {
    const raw = getItemSyncWeb(STORAGE_KEY);
    if (!raw) return defaultSoundSettings;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    const byEvent = { ...defaultSoundSettings.byEvent, ...(parsed.byEvent ?? {}) } as SoundSettings['byEvent'];
    const volume = clamp01(Number(parsed.volume ?? defaultSoundSettings.volume));
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : defaultSoundSettings.enabled;
    cachedSettings = { enabled, volume, byEvent };
    return cachedSettings;
  } catch {
    return cachedSettings;
  }
}

export function saveSoundSettings(next: SoundSettings) {
  cachedSettings = next;
  setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AnyWindow = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = AnyWindow.AudioContext ?? AnyWindow.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function canPlaySounds() {
  if (Platform.OS !== 'web') return true;
  const ctx = getAudioContext();
  return Boolean(ctx);
}

async function resumeIfNeeded(ctx: AudioContext) {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
  }
}

type Beep = { atMs: number; durationMs: number; freq: number; gain: number };

function buildPreset(preset: SoundPresetId): Beep[] {
  switch (preset) {
    case 'silent':
      return [];
    case 'beep':
      return [{ atMs: 0, durationMs: 120, freq: 880, gain: 1 }];
    case 'double':
      return [
        { atMs: 0, durationMs: 90, freq: 740, gain: 1 },
        { atMs: 130, durationMs: 90, freq: 980, gain: 1 },
      ];
    case 'success':
      return [
        { atMs: 0, durationMs: 90, freq: 660, gain: 0.9 },
        { atMs: 110, durationMs: 90, freq: 880, gain: 1 },
        { atMs: 220, durationMs: 120, freq: 1040, gain: 0.9 },
      ];
    case 'warning':
      return [
        { atMs: 0, durationMs: 140, freq: 520, gain: 1 },
        { atMs: 170, durationMs: 140, freq: 520, gain: 1 },
      ];
    case 'error':
      return [
        { atMs: 0, durationMs: 140, freq: 220, gain: 1 },
        { atMs: 170, durationMs: 180, freq: 196, gain: 1 },
      ];
    default:
      return [{ atMs: 0, durationMs: 120, freq: 880, gain: 1 }];
  }
}

export async function playPreset(preset: SoundPresetId, volume = defaultSoundSettings.volume) {
  if (Platform.OS !== 'web') {
    await playPresetNative(preset, volume);
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  await resumeIfNeeded(ctx);
  if (ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const baseGain = clamp01(volume);
  const beeps = buildPreset(preset);
  if (beeps.length === 0) return;

  beeps.forEach((beep) => {
    const start = now + beep.atMs / 1000;
    const end = start + beep.durationMs / 1000;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(beep.freq, start);

    const peak = baseGain * clamp01(beep.gain);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(end + 0.02);
  });
}

type ExpoAvModule = typeof import('expo-av');

let expoAvPromise: Promise<ExpoAvModule | null> | null = null;
let nativeAudioModeReady: Promise<void> | null = null;

async function getExpoAv(): Promise<ExpoAvModule | null> {
  if (expoAvPromise) return expoAvPromise;
  expoAvPromise = import('expo-av')
    .then((mod) => mod as ExpoAvModule)
    .catch(() => null);
  return expoAvPromise;
}

async function ensureNativeAudioMode(mod: ExpoAvModule) {
  if (nativeAudioModeReady) return nativeAudioModeReady;
  nativeAudioModeReady = mod.Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    playsInSilentModeIOS: true,
    interruptionModeIOS: mod.InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: mod.InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  }).catch(() => {});
  return nativeAudioModeReady;
}

const nativeAssetsByPreset: Partial<Record<SoundPresetId, number>> = {
  beep: require('../assets/sounds/beep.wav'),
  double: require('../assets/sounds/double.wav'),
  success: require('../assets/sounds/success.wav'),
  warning: require('../assets/sounds/warning.wav'),
  error: require('../assets/sounds/error.wav'),
};

async function playPresetNative(preset: SoundPresetId, volume: number) {
  const mod = await getExpoAv();
  if (!mod) return;

  const asset = nativeAssetsByPreset[preset];
  if (!asset) return;

  const { Audio } = mod;
  await ensureNativeAudioMode(mod);

  try {
    const { sound } = await Audio.Sound.createAsync(asset, {
      volume: clamp01(volume),
      shouldPlay: true,
      isLooping: false,
    });

    sound.setOnPlaybackStatusUpdate((status) => {
      const anyStatus = status as any;
      if (anyStatus?.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // ignore
  }
}

export async function playEvent(eventId: SoundEventId, settings?: SoundSettings) {
  const activeSettings = settings ?? loadSoundSettings();
  if (!activeSettings.enabled) return;
  const preset = activeSettings.byEvent[eventId] ?? 'beep';
  await playPreset(preset, activeSettings.volume);
}

export function eventForAlertId(alertId: string): SoundEventId {
  switch (alertId) {
    case 'expiry':
      return 'expiry';
    case 'restock':
      return 'restock';
    case 'recognition':
      return 'recognition';
    case 'trace':
      return 'trace';
    case 'finance':
      return 'finance_neutral';
    default:
      return 'restock';
  }
}

export function eventForFinanceKind(kind: string): SoundEventId {
  if (kind === 'loss') return 'finance_loss';
  if (kind === 'revenue') return 'finance_profit';
  return 'finance_neutral';
}

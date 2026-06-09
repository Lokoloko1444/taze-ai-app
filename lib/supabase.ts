import { createClient } from '@supabase/supabase-js';

import { getItem, removeItem, setItem } from 'lib/app-storage';

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const anonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

function isPlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('yourproject') ||
    normalized.includes('your_supabase') ||
    normalized.includes('replace_me') ||
    normalized.includes('example.com')
  );
}

function isValidSupabaseUrl(value: string) {
  if (!value) return false;
  if (isPlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase.co');
  } catch {
    return false;
  }
}

function isValidSupabaseKey(value: string) {
  if (!value) return false;
  if (isPlaceholder(value)) return false;
  // Legacy anon keys are JWT-like (eyJ...), newer publishable keys start with sb_publishable_.
  return value.startsWith('eyJ') || value.startsWith('sb_publishable_');
}

function isWebRuntime() {
  return typeof window !== 'undefined' && typeof window.location !== 'undefined';
}

const configured = isValidSupabaseUrl(url) && isValidSupabaseKey(anonKey);

const authStorage = {
  async getItem(key: string) {
    return await getItem(key);
  },
  async setItem(key: string, value: string) {
    await setItem(key, value);
  },
  async removeItem(key: string) {
    await removeItem(key);
  },
  isServer: false,
};

export const supabase =
  configured
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: isWebRuntime(),
          storage: authStorage,
        },
      })
    : null;

export function isSupabaseConfigured() {
  return configured;
}

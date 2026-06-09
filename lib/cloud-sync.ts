import { supabase } from 'lib/supabase';

const TABLE = 'app_state';

export type CloudStateRow = {
  user_id: string;
  state: unknown;
  updated_at: string;
};

export type CloudSyncResult = {
  ok: boolean;
  userId: string | null;
  error?: string;
};

export async function pullCloudState(): Promise<unknown | null> {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('state, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return data?.state ?? null;
}

export async function pushCloudStateWithResult(state: unknown): Promise<CloudSyncResult> {
  if (!supabase) return { ok: false, userId: null, error: 'supabase_not_configured' };
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return { ok: false, userId: null, error: 'missing_session' };

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return { ok: false, userId, error: error.message || 'app_state_upsert_failed' };
  }

  return { ok: true, userId };
}

export async function pushCloudState(state: unknown): Promise<boolean> {
  const result = await pushCloudStateWithResult(state);
  return result.ok;
}

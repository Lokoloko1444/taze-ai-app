import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearStoredRole, loadStoredRole } from 'lib/role-permissions';
import { isSupabaseConfigured, supabase } from 'lib/supabase';
import {
  buildTenantContext,
  loadCachedTenantContext,
  loadStoredActiveMembershipId,
  loadUserMemberships,
  saveCachedTenantContext,
  saveStoredActiveMembershipId,
  syncLegacyProfileRole,
  mergeSessionProviderAccounts,
  syncUserProviderAccounts,
} from 'lib/tenant-auth';
import { normalizeAppRole, type TenantBranchSummary, type TenantContextSnapshot, type TenantMembership, type TenantProviderAccount, type TenantFunctionArea } from 'lib/auth-model';

const AUTH_SESSION_TIMEOUT_MS = 5000;
const debugAuth = process.env.EXPO_PUBLIC_DEBUG_AUTH === '1';

function logAuth(...args: unknown[]) {
  if (!debugAuth || typeof console === 'undefined') return;
  console.log('[auth-context]', ...args);
}

type AuthContextValue = {
  ready: boolean;
  email: string | null;
  userId: string | null;
  role: string | null;
  companyId: string | null;
  branchId: string | null;
  company: TenantMembership['company'] | null;
  branch: TenantBranchSummary | null;
  memberships: TenantMembership[];
  activeMembership: TenantMembership | null;
  activeMembershipId: string | null;
  providers: TenantProviderAccount[];
  permissions: string[];
  functions: TenantFunctionArea[];
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  selectMembership: (membershipId: string | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function applySnapshotState(
  snapshot: TenantContextSnapshot | null,
  params: {
    setEmail: (value: string | null) => void;
    setUserId: (value: string | null) => void;
    setRole: (value: string | null) => void;
    setCompanyId: (value: string | null) => void;
    setBranchId: (value: string | null) => void;
    setCompany: (value: TenantMembership['company'] | null) => void;
    setBranch: (value: TenantBranchSummary | null) => void;
    setPermissions: (value: string[]) => void;
    setFunctions: (value: TenantFunctionArea[]) => void;
    setActiveMembershipId: (value: string | null) => void;
  }
) {
  if (!snapshot) {
    params.setCompanyId(null);
    params.setBranchId(null);
    params.setCompany(null);
    params.setBranch(null);
    params.setPermissions([]);
    params.setFunctions([]);
    params.setActiveMembershipId(null);
    return;
  }

  params.setCompanyId(snapshot.companyId);
  params.setBranchId(snapshot.branchId);
  params.setCompany(
    snapshot.companyId && snapshot.companyName && snapshot.companySlug
      ? {
          id: snapshot.companyId,
          name: snapshot.companyName,
          legalName: snapshot.companyName,
          slug: snapshot.companySlug,
          status: 'ACTIVE',
        }
      : null
  );
  params.setBranch(
    snapshot.branchId && snapshot.branchName
      ? {
          id: snapshot.branchId,
          name: snapshot.branchName,
          slug: snapshot.branchCode ?? snapshot.branchName.toLowerCase(),
          code: snapshot.branchCode,
          status: 'ACTIVE',
        }
      : null
  );
  params.setPermissions(snapshot.permissions);
  params.setFunctions(snapshot.functions);
  params.setActiveMembershipId(snapshot.membershipId);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [company, setCompany] = useState<TenantMembership['company'] | null>(null);
  const [branch, setBranch] = useState<TenantBranchSummary | null>(null);
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [activeMembership, setActiveMembership] = useState<TenantMembership | null>(null);
  const [activeMembershipId, setActiveMembershipId] = useState<string | null>(null);
  const [providers, setProviders] = useState<TenantProviderAccount[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [functions, setFunctions] = useState<TenantFunctionArea[]>([]);

  const configured = isSupabaseConfigured();

  const getSessionWithTimeout = async () => {
    if (!supabase) return null;

    return await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('auth_session_timeout')), AUTH_SESSION_TIMEOUT_MS);
      }),
    ]);
  };

  const loadTenantState = useCallback(
    async (uid: string, currentEmail: string | null, sessionProvider: string | null) => {
      if (!supabase) return;

      const storedMembershipId = await loadStoredActiveMembershipId();
      const [membershipRows, providerRows, profileResult] = await Promise.all([
        loadUserMemberships(uid).catch(() => []),
        syncUserProviderAccounts(uid).catch(() => []),
        supabase.from('profiles').select('role').eq('user_id', uid).maybeSingle(),
      ]);
      const displayProviderRows = mergeSessionProviderAccounts(providerRows, {
        userId: uid,
        email: currentEmail,
        sessionProvider,
      });

      const selectedMembership = membershipRows.length ? membershipRows.find((item) => item.id === storedMembershipId && item.status === 'ACTIVE') ?? membershipRows.find((item) => item.isPrimary && item.status === 'ACTIVE') ?? membershipRows.find((item) => item.status === 'ACTIVE') ?? membershipRows[0] : null;

      const legacyProfileRole = normalizeAppRole(profileResult.data?.role);
      const nextRole = selectedMembership?.role ?? legacyProfileRole ?? null;

      setMemberships(membershipRows);
      setProviders(displayProviderRows);
      setActiveMembership(selectedMembership);
      setRole(nextRole);
      applySnapshotState(
        buildTenantContext({
          userId: uid,
          email: currentEmail,
          memberships: membershipRows,
          activeMembership: selectedMembership,
          providerAccounts: displayProviderRows,
        }),
        {
          setEmail,
          setUserId,
          setRole,
          setCompanyId,
          setBranchId,
          setCompany,
          setBranch,
          setPermissions,
          setFunctions,
          setActiveMembershipId,
        }
      );

      if (selectedMembership) {
        await saveStoredActiveMembershipId(selectedMembership.id);
        await syncLegacyProfileRole(uid, selectedMembership.role).catch(() => {});
      } else if (legacyProfileRole) {
        await syncLegacyProfileRole(uid, legacyProfileRole).catch(() => {});
      }

      await saveCachedTenantContext(
        buildTenantContext({
          userId: uid,
          email: currentEmail,
          memberships: membershipRows,
          activeMembership: selectedMembership,
          providerAccounts: displayProviderRows,
        })
      );
    },
    []
  );

  const refresh = useCallback(async () => {
    logAuth('refresh:start', { configured: Boolean(supabase) });

    if (!supabase) {
      const storedRole = await loadStoredRole();
      const cached = await loadCachedTenantContext().catch(() => null);
      setEmail(cached?.email ?? null);
      setUserId(cached?.userId ?? null);
      setRole(normalizeAppRole(storedRole) ?? cached?.role ?? null);
      setMemberships([]);
      setProviders([]);
      setActiveMembership(null);
      setActiveMembershipId(null);
      setCompanyId(cached?.companyId ?? null);
      setBranchId(cached?.branchId ?? null);
      setCompany(
        cached?.companyId && cached.companyName && cached.companySlug
          ? {
              id: cached.companyId,
              name: cached.companyName,
              legalName: cached.companyName,
              slug: cached.companySlug,
              status: 'ACTIVE',
            }
          : null
      );
      setBranch(
        cached?.branchId && cached.branchName
          ? {
              id: cached.branchId,
              name: cached.branchName,
              slug: cached.branchCode ?? cached.branchName.toLowerCase(),
              code: cached.branchCode,
              status: 'ACTIVE',
            }
          : null
      );
      setPermissions(cached?.permissions ?? []);
      setFunctions(cached?.functions ?? []);
      setReady(true);
      return;
    }

    try {
      const { data } = await getSessionWithTimeout();
      const session = data?.session ?? null;
      setEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);

      if (session?.user?.id) {
        const providerFromSession = String(
          session.user?.app_metadata?.provider ?? session.user?.identities?.[0]?.provider ?? ''
        ).trim().toLowerCase();
        await loadTenantState(session.user.id, session.user.email ?? null, providerFromSession || null);
      } else {
        const cached = await loadCachedTenantContext().catch(() => null);
        setRole(normalizeAppRole(await loadStoredRole()) ?? cached?.role ?? null);
        setMemberships([]);
        setProviders([]);
        setActiveMembership(null);
        setActiveMembershipId(null);
        setCompanyId(null);
        setBranchId(null);
        setCompany(null);
        setBranch(null);
        setPermissions([]);
        setFunctions([]);
        await saveCachedTenantContext(null);
      }
    } catch {
      logAuth('refresh:timeout-or-error');
      const cached = await loadCachedTenantContext().catch(() => null);
      setEmail(cached?.email ?? null);
      setUserId(cached?.userId ?? null);
      setRole(normalizeAppRole(await loadStoredRole()) ?? cached?.role ?? null);
      setMemberships([]);
      setProviders([]);
      setActiveMembership(null);
      setActiveMembershipId(null);
      setCompanyId(cached?.companyId ?? null);
      setBranchId(cached?.branchId ?? null);
      setCompany(
        cached?.companyId && cached.companyName && cached.companySlug
          ? {
              id: cached.companyId,
              name: cached.companyName,
              legalName: cached.companyName,
              slug: cached.companySlug,
              status: 'ACTIVE',
            }
          : null
      );
      setBranch(
        cached?.branchId && cached.branchName
          ? {
              id: cached.branchId,
              name: cached.branchName,
              slug: cached.branchCode ?? cached.branchName.toLowerCase(),
              code: cached.branchCode,
              status: 'ACTIVE',
            }
          : null
      );
      setPermissions(cached?.permissions ?? []);
      setFunctions(cached?.functions ?? []);
      await saveCachedTenantContext(cached);
    } finally {
      setReady(true);
      logAuth('refresh:ready-true');
    }
  }, [loadTenantState]);

  useEffect(() => {
    logAuth('effect:mount');
    refresh().catch(() => setReady(true));
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      logAuth('auth-state-change');
      refresh().catch(() => {});
    });
    return () => sub?.subscription.unsubscribe();
  }, [refresh]);

  const selectMembership = useCallback(
    async (membershipId: string | null) => {
      await saveStoredActiveMembershipId(membershipId);
      await refresh();
    },
    [refresh]
  );

  const value: AuthContextValue = useMemo(
    () => ({
      ready,
      email,
      userId,
      role,
      companyId,
      branchId,
      company,
      branch,
      memberships,
      activeMembership,
      activeMembershipId,
      providers,
      permissions,
      functions,
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        await saveStoredActiveMembershipId(null);
        await clearStoredRole().catch(() => {});
        await saveCachedTenantContext(null);
        await refresh();
      },
      refresh,
      selectMembership,
    }),
    [
      activeMembership,
      activeMembershipId,
      branch,
      branchId,
      company,
      companyId,
      email,
      functions,
      memberships,
      permissions,
      providers,
      ready,
      refresh,
      role,
      selectMembership,
      userId,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function requiresLogin() {
  if (!isSupabaseConfigured()) return false;
  const raw = String(process.env.EXPO_PUBLIC_REQUIRE_LOGIN ?? '0')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

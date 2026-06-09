import * as ExpoLinking from 'expo-linking';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeChip } from 'components/taze-chip';
import { TazeInput } from 'components/taze-input';
import { TazeLogo } from 'components/taze-logo';
import { TazeStatusPill } from 'components/taze-status-pill';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useAuth } from 'lib/auth-context';
import {
  FUNCTION_AREAS,
  getDefaultFunctionsForRole,
  getFunctionAreaLabel,
  getRoleLabel,
  normalizeAppRole,
  roleHasPermission,
  type TenantBranchSummary,
  type TenantFunctionArea,
  type TenantRole,
} from 'lib/auth-model';
import { buildOAuthCallbackUrl, buildOAuthLoginRequest } from 'lib/auth-redirect';
import {
  acceptCompanyInvite,
  createCompanyInvite,
  loadCompanyBranches,
  loadCompanyInvites,
  type CompanyInvite,
  type CreateCompanyInviteResult,
} from 'lib/company-invites';
import { resolveAppLanguage, t, type AppLanguage, type TranslationKey } from 'lib/i18n';
import { LegalConfig } from 'lib/legal-config';
import { isSupabaseConfigured, supabase } from 'lib/supabase';
import {
  bootstrapCompanyMembership,
  buildMembershipPickerDetail,
  buildMembershipPickerLabel,
  saveMembershipFunctions,
} from 'lib/tenant-auth';

type OAuthProvider = 'google' | 'azure' | 'apple';
type InviteRoleOption = TenantRole | 'FACTURATIE';

type ProviderOption = {
  provider: OAuthProvider;
  label: string;
  detail: string;
};


function getProviderOptions(language: AppLanguage): ProviderOption[] {
  return [
    { provider: 'google', label: 'Google', detail: t('account.providerLogin.google.detail', language) },
    { provider: 'azure', label: 'Microsoft', detail: t('account.providerLogin.microsoft.detail', language) },
    { provider: 'apple', label: 'Apple', detail: t('account.providerLogin.apple.detail', language) },
  ];
}

function getProviderLoginOptions(language: AppLanguage): ProviderOption[] {
  return [
    { provider: 'google', label: t('account.providerLogin.google.label', language), detail: t('account.providerLogin.google.detail', language) },
    { provider: 'azure', label: t('account.providerLogin.microsoft.label', language), detail: t('account.providerLogin.microsoft.detail', language) },
    { provider: 'apple', label: t('account.providerLogin.apple.label', language), detail: t('account.providerLogin.apple.detail', language) },
  ];
}

const accountSteps = [
  { index: '1', labelKey: 'account.step.loginProvider' },
  { index: '2', labelKey: 'account.step.companyBranch' },
  { index: '3', labelKey: 'account.step.workStart' },
] satisfies { index: string; labelKey: TranslationKey }[];

function formatCompanyCount(count: number, language: AppLanguage) {
  if (count <= 0) return t('account.company.none', language);
  return `${count} ${t(count === 1 ? 'account.company.count.singular' : 'account.company.count.plural', language)}`;
}

function formatLivePermissionCount(count: number, language: AppLanguage) {
  return `${count} ${t(count === 1 ? 'account.permissions.live.singular' : 'account.permissions.live.plural', language)}`;
}

const inviteRoleOptions: InviteRoleOption[] = ['OWNER', 'MANAGER', 'WERKVLOER', 'CHAUFFEUR', 'FACTURATIE'];
const facturatiePermissions = ['finance.read', 'finance.manage', 'invoice.manage', 'billing.manage', 'reports.read'];

function getInviteRoleLabel(role: InviteRoleOption, language: AppLanguage) {
  return role === 'FACTURATIE' ? t('account.form.invite.billingRole', language) : getRoleLabel(role, language);
}

function getInviteTenantRole(role: InviteRoleOption): TenantRole {
  return role === 'FACTURATIE' ? 'MANAGER' : role;
}

function getInvitePermissions(role: InviteRoleOption) {
  return role === 'FACTURATIE' ? facturatiePermissions : [];
}

function getDefaultFunctionsForInviteRole(role: InviteRoleOption) {
  return role === 'FACTURATIE' ? (['ADMIN'] as TenantFunctionArea[]) : getDefaultFunctionsForRole(role);
}

function isProbablyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function hasTestMailboxDomain(value: string) {
  const email = value.trim().toLowerCase();
  const domain = email.split('@')[1] ?? '';
  return domain === 'example.com' || domain === 'test.com' || domain.endsWith('.local') || domain === 'localhost';
}

function friendlyAuthErrorMessage(raw: string, language: AppLanguage) {
  const message = raw.toLowerCase();
  if (message.includes('invalid login credentials')) {
    return t('account.auth.error.invalidCredentials', language);
  }
  if (message.includes('email not confirmed')) {
    return t('account.auth.error.emailNotConfirmed', language);
  }
  if (message.includes('user already registered')) {
    return t('account.auth.error.userRegistered', language);
  }
  if (message.includes('already linked') || message.includes('identity already exists')) {
    return t('account.auth.error.providerLinked', language);
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return t('account.auth.error.network', language);
  }
  if (message.includes('provider is not enabled') || message.includes('unsupported provider') || message.includes('oauth')) {
    return t('account.auth.error.providerDisabled', language);
  }
  if (message.includes('auth session missing') || message.includes('flow state missing') || message.includes('invalid grant')) {
    return t('account.auth.error.sessionFailed', language);
  }
  return raw;
}

function getProviderLabel(provider: string) {
  if (provider === 'google') return 'Google';
  if (provider === 'azure' || provider === 'microsoft') return 'Microsoft';
  if (provider === 'apple') return 'Apple';
  return provider;
}

function getAuthRedirectTo(inviteToken?: string | null) {
  if (Platform.OS === 'web') {
    return buildOAuthCallbackUrl(inviteToken);
  }

  const nativeCallback = ExpoLinking.createURL('auth/callback');
  if (!inviteToken) return nativeCallback;
  const separator = nativeCallback.includes('?') ? '&' : '?';
  return `${nativeCallback}${separator}invite=${encodeURIComponent(inviteToken)}`;
}

function formatFunctions(functions: TenantFunctionArea[], language: AppLanguage) {
  if (!functions.length) return t('account.membership.noFunctions', language);
  return functions.map((item) => getFunctionAreaLabel(item, language)).join(' · ');
}

export default function AccountScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ invite?: string | string[] }>();
  const auth = useAuth();
  const { refresh: refreshAuth } = auth;
  const uiLanguage = useMemo(() => resolveAppLanguage(), []);
  const providerOptions = useMemo(() => getProviderOptions(uiLanguage), [uiLanguage]);
  const providerLoginOptions = useMemo(() => getProviderLoginOptions(uiLanguage), [uiLanguage]);
  const inviteToken = useMemo(() => {
    const value = Array.isArray(searchParams.invite) ? searchParams.invite[0] ?? '' : searchParams.invite ?? '';
    return value.trim();
  }, [searchParams.invite]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [branchName, setBranchName] = useState(() => t('account.form.company.branchPlaceholder', uiLanguage));
  const [selectedFunctions, setSelectedFunctions] = useState<TenantFunctionArea[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBranchId, setInviteBranchId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<InviteRoleOption>('MANAGER');
  const [inviteExpiryDays, setInviteExpiryDays] = useState('7');
  const [inviteFunctions, setInviteFunctions] = useState<TenantFunctionArea[]>([]);
  const [companyBranches, setCompanyBranches] = useState<TenantBranchSummary[]>([]);
  const [companyInvites, setCompanyInvites] = useState<CompanyInvite[]>([]);
  const [latestInvite, setLatestInvite] = useState<CreateCompanyInviteResult | null>(null);
  const inviteAcceptingRef = useRef<string | null>(null);

  const configured = isSupabaseConfigured();
  const sessionEmail = auth.email;
  const signedIn = Boolean(sessionEmail);
  const activeMembership = auth.activeMembership;
  const activeRole = normalizeAppRole(activeMembership?.role ?? auth.role ?? null);
  const canInviteMembers = roleHasPermission(activeRole, 'company.manage_users.invite', auth.permissions);
  const canManageMembership = roleHasPermission(activeRole, 'company.manage_users.update_role', auth.permissions);
  const canEditFunctions = Boolean(activeMembership) && canManageMembership;
  const hasMemberships = auth.memberships.length > 0;
  const linkedProviders = useMemo(() => {
    return auth.providers
      .map((provider) => ({
        ...provider,
        label: getProviderLabel(provider.provider),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [auth.providers]);

  useEffect(() => {
    if (!activeMembership) {
      setSelectedFunctions([]);
      return;
    }

    setSelectedFunctions(
      activeMembership.functions.length
        ? [...activeMembership.functions]
        : getDefaultFunctionsForRole(normalizeAppRole(activeMembership.role))
    );
  }, [activeMembership]);

  useEffect(() => {
    setInviteFunctions(getDefaultFunctionsForInviteRole(inviteRole));
  }, [inviteRole]);

  useEffect(() => {
    if (!auth.memberships.length) {
      return;
    }

    if (!companyName.trim()) {
      const suggestedName = activeMembership?.company.legalName?.trim() || activeMembership?.company.name?.trim() || '';
      setCompanyName(suggestedName);
    }
  }, [activeMembership?.company.legalName, activeMembership?.company.name, auth.memberships.length, companyName]);

  useEffect(() => {
    let cancelled = false;

    async function loadTenantInvites() {
      if (!configured || !activeMembership?.companyId) {
        if (!cancelled) {
          setCompanyBranches([]);
          setCompanyInvites([]);
        }
        return;
      }

      const [branches, invites] = await Promise.all([
        loadCompanyBranches(activeMembership.companyId).catch(() => []),
        loadCompanyInvites(activeMembership.companyId).catch(() => []),
      ]);

      if (cancelled) return;

      const branchList = branches.length
        ? branches
        : activeMembership.branch
          ? [activeMembership.branch]
          : [];

      setCompanyBranches(branchList);
      setCompanyInvites(invites);

      setInviteBranchId((current) => {
        if (current && branchList.some((branch) => branch.id === current)) {
          return current;
        }
        return branchList.find((branch) => branch.id === activeMembership.branchId)?.id ?? branchList[0]?.id ?? null;
      });
    }

    loadTenantInvites().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeMembership?.branch, activeMembership?.branchId, activeMembership?.companyId, configured]);

  useEffect(() => {
    let cancelled = false;

    async function acceptInviteIfNeeded() {
      if (!inviteToken || !signedIn || !configured || inviteAcceptingRef.current === inviteToken) {
        return;
      }

      inviteAcceptingRef.current = inviteToken;
      setInviteBusy(true);
      setAuthHint(t('account.invite.processing', uiLanguage));

      try {
        const result = await acceptCompanyInvite(inviteToken);
        if (cancelled) return;

        setAuthHint(`${t('account.invite.accepted.prefix', uiLanguage)} ${getRoleLabel(result.invite.role, uiLanguage)}.`);
        setLatestInvite(null);
        await refreshAuth();
        router.replace('/account');
      } catch (error) {
        if (cancelled) return;
        inviteAcceptingRef.current = null;
        const message = error instanceof Error ? error.message : t('account.invite.acceptFailed', uiLanguage);
        setAuthHint(message);
        Alert.alert(t('account.invite.failed', uiLanguage), message);
      } finally {
        if (!cancelled) {
          setInviteBusy(false);
        }
      }
    }

    acceptInviteIfNeeded().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [configured, inviteToken, refreshAuth, router, signedIn, uiLanguage]);

  const startOAuthFlow = async (provider: OAuthProvider, mode: 'login' | 'link') => {
    if (!supabase) return;

    const oauthRequest = buildOAuthLoginRequest(provider, inviteToken, undefined, getAuthRedirectTo(inviteToken));
    const { provider: oauthProvider, options } = oauthRequest;
    const authOptions = {
      ...options,
      skipBrowserRedirect: Platform.OS !== 'web',
    };
    setBusy(true);
    setAuthHint(null);

    try {
      const authResult =
        mode === 'link' && signedIn
          ? await supabase.auth.linkIdentity({
              provider: oauthProvider,
              options: authOptions,
            })
          : await supabase.auth.signInWithOAuth({
              provider: oauthProvider,
              options: authOptions,
            });

      const { data, error } = authResult;

      if (error) {
        const message = friendlyAuthErrorMessage(error.message, uiLanguage);
        setAuthHint(message);
        Alert.alert(mode === 'link' ? t('account.auth.linkFailed', uiLanguage) : t('account.auth.loginFailed', uiLanguage), message);
        return;
      }

      if (Platform.OS === 'web') {
        return;
      }

      if (!data?.url) {
        const message = t('account.auth.oauthMissing', uiLanguage);
        setAuthHint(message);
        Alert.alert(mode === 'link' ? t('account.auth.linkFailed', uiLanguage) : t('account.auth.loginFailed', uiLanguage), message);
        return;
      }

      const sessionResult = await WebBrowser.openAuthSessionAsync(data.url, options.redirectTo);
      if (sessionResult.type === 'cancel' || sessionResult.type === 'dismiss') {
        setAuthHint(t('account.auth.signInCancelled', uiLanguage));
      }
    } catch (error) {
      const message = friendlyAuthErrorMessage(error instanceof Error ? error.message : t('account.auth.oauthFailed', uiLanguage), uiLanguage);
      setAuthHint(message);
      Alert.alert(mode === 'link' ? t('account.auth.linkFailed', uiLanguage) : t('account.auth.loginFailed', uiLanguage), message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    if (!supabase) return;
    const trimmedEmail = email.trim();
    if (!isProbablyEmail(trimmedEmail)) {
      Alert.alert(t('account.auth.emailInvalid.title', uiLanguage), t('account.auth.emailInvalid.body', uiLanguage));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('account.auth.passwordShort.title', uiLanguage), t('account.auth.passwordShort.body', uiLanguage));
      return;
    }

    setBusy(true);
    setAuthHint(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        const message = friendlyAuthErrorMessage(error.message, uiLanguage);
        setAuthHint(message);
        Alert.alert(t('account.auth.loginFailed', uiLanguage), message);
        return;
      }
      setPassword('');
      setAuthHint(t('account.auth.loginSuccess.hint', uiLanguage));
      Alert.alert(t('account.auth.loginSuccess.title', uiLanguage), t('account.auth.loginSuccess.body', uiLanguage));
      await auth.refresh();
      router.replace('/account');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    const trimmedEmail = email.trim();
    if (!isProbablyEmail(trimmedEmail)) {
      Alert.alert(t('account.auth.emailInvalid.title', uiLanguage), t('account.auth.emailInvalid.body', uiLanguage));
      return;
    }
    if (hasTestMailboxDomain(trimmedEmail)) {
      Alert.alert(t('account.auth.realMailbox.title', uiLanguage), t('account.auth.realMailbox.body', uiLanguage));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('account.auth.passwordShort.title', uiLanguage), t('account.auth.passwordShort.body', uiLanguage));
      return;
    }

    setBusy(true);
    setAuthHint(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectTo(inviteToken),
        },
      });
      if (error) {
        const message = friendlyAuthErrorMessage(error.message, uiLanguage);
        setAuthHint(message);
        Alert.alert(t('account.auth.signupFailed', uiLanguage), message);
        return;
      }
      if (data.session) {
        setPassword('');
        setAuthHint(t('account.auth.signupSuccessDirect.hint', uiLanguage));
        Alert.alert(t('account.auth.signupSuccess.title', uiLanguage), t('account.auth.signupSuccessDirect.body', uiLanguage));
        await auth.refresh();
        router.replace('/account');
      } else {
        setAuthHint(t('account.auth.signupSuccessMailbox.hint', uiLanguage));
        Alert.alert(t('account.auth.signupSuccess.title', uiLanguage), t('account.auth.signupSuccessMailbox.body', uiLanguage));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!supabase) return;
    const trimmedEmail = email.trim();
    if (!isProbablyEmail(trimmedEmail)) {
      Alert.alert(t('account.auth.emailInvalid.title', uiLanguage), t('account.auth.emailInvalid.body', uiLanguage));
      return;
    }
    if (hasTestMailboxDomain(trimmedEmail)) {
      Alert.alert(t('account.auth.realMailbox.title', uiLanguage), t('account.auth.realMailbox.body', uiLanguage));
      return;
    }

    setBusy(true);
    setAuthHint(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        const message = friendlyAuthErrorMessage(error.message, uiLanguage);
        setAuthHint(message);
        Alert.alert(t('account.auth.resetFailed', uiLanguage), message);
        return;
      }
      setAuthHint(t('account.auth.resetSent.hint', uiLanguage));
      Alert.alert(t('account.auth.resetSent.title', uiLanguage), t('account.auth.resetSent.body', uiLanguage));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await auth.signOut();
      setAuthHint(t('account.auth.logout.hint', uiLanguage));
      Alert.alert(t('account.auth.logout.title', uiLanguage), t('account.auth.logout.body', uiLanguage));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!auth.userId) {
      Alert.alert(t('account.companyCreate.loginRequired.title', uiLanguage), t('account.companyCreate.loginRequired.body', uiLanguage));
      return;
    }
    if (!companyName.trim()) {
      Alert.alert(t('account.companyCreate.nameMissing.title', uiLanguage), t('account.companyCreate.nameMissing.body', uiLanguage));
      return;
    }

    setBusy(true);
    setAuthHint(null);
    try {
      await bootstrapCompanyMembership({
        userId: auth.userId,
        companyName: companyName.trim(),
        companyLegalName: companyLegalName.trim() || undefined,
        branchName: branchName.trim() || t('account.companyCreate.defaultBranch', uiLanguage),
        role: 'OWNER',
        functions: getDefaultFunctionsForRole('OWNER'),
      });
      setAuthHint(t('account.companyCreate.success.hint', uiLanguage));
      Alert.alert(t('account.companyCreate.success.title', uiLanguage), t('account.companyCreate.success.body', uiLanguage));
      await auth.refresh();
    } catch (error) {
      const safeReason = error instanceof Error ? error.message : String(error ?? 'Onbekende fout');
      console.warn('Company creation failed', safeReason);
      const message = t('account.companyCreate.failed.body', uiLanguage);
      setAuthHint(message);
      Alert.alert(t('account.companyCreate.failed.title', uiLanguage), message);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFunctions = async () => {
    if (!activeMembership) return;
    if (!canEditFunctions) {
      Alert.alert(t('account.functions.noPermission.title', uiLanguage), t('account.functions.noPermission.body', uiLanguage));
      return;
    }

    setBusy(true);
    setAuthHint(null);
    try {
      await saveMembershipFunctions(activeMembership.id, selectedFunctions);
      setAuthHint(`${t('account.functions.saved.prefix', uiLanguage)} ${buildMembershipPickerLabel(activeMembership)}.`);
      Alert.alert(t('account.functions.saved.title', uiLanguage), t('account.functions.saved.body', uiLanguage));
      await auth.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('account.functions.saveFailed', uiLanguage);
      setAuthHint(message);
      Alert.alert(t('account.functions.saveFailed.title', uiLanguage), message);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectMembership = async (membershipId: string) => {
    setBusy(true);
    try {
      await auth.selectMembership(membershipId);
    } finally {
      setBusy(false);
    }
  };

  const inviteBranches = useMemo(() => {
    const branchMap = new Map<string, TenantBranchSummary>();
    for (const branch of companyBranches) {
      branchMap.set(branch.id, branch);
    }
    if (activeMembership?.branch) {
      branchMap.set(activeMembership.branch.id, activeMembership.branch);
    }
    return Array.from(branchMap.values());
  }, [activeMembership?.branch, companyBranches]);

  const copyInviteLink = async (link: string) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      Alert.alert(t('account.invite.copied.title', uiLanguage), t('account.invite.copied.body', uiLanguage));
      return;
    }

    Alert.alert(t('account.invite.linkTitle', uiLanguage), link);
  };

  const handleCreateInvite = async () => {
    if (!activeMembership) {
      Alert.alert(t('account.invite.noContext.title', uiLanguage), t('account.invite.noContext.body', uiLanguage));
      return;
    }
    if (!canInviteMembers) {
      Alert.alert(t('account.invite.noPermission.title', uiLanguage), t('account.invite.noPermission.body', uiLanguage));
      return;
    }

    const branchId = inviteBranchId?.trim() || activeMembership.branchId?.trim() || '';
    if (!branchId) {
      Alert.alert(t('account.invite.branchMissing.title', uiLanguage), t('account.invite.branchMissing.body', uiLanguage));
      return;
    }

    const expiryDays = Number.parseInt(inviteExpiryDays, 10);
    setInviteBusy(true);
    setAuthHint(null);

    try {
      const inviteTenantRole = getInviteTenantRole(inviteRole);
      const invitePermissionOverrides = getInvitePermissions(inviteRole);
      const result = await createCompanyInvite({
        companyId: activeMembership.companyId,
        branchId,
        role: inviteTenantRole,
        invitedEmail: inviteEmail.trim() || null,
        invitedName: inviteName.trim() || null,
        permissions: invitePermissionOverrides,
        functionAreas: inviteFunctions,
        expiresInDays: Number.isFinite(expiryDays) ? expiryDays : 7,
      });

      setLatestInvite(result);
      setAuthHint(
        inviteRole === 'FACTURATIE'
          ? t('account.invite.createdFinance', uiLanguage)
          : `${t('account.invite.created.prefix', uiLanguage)} ${getRoleLabel(result.invite.role, uiLanguage)}.`
      );
      Alert.alert(t('account.invite.created.title', uiLanguage), t('account.invite.created.body', uiLanguage));
      setCompanyInvites((current) => [result.invite, ...current.filter((item) => item.id !== result.invite.id)]);
      await copyInviteLink(result.inviteLink);
      await auth.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('account.invite.createFailed', uiLanguage);
      setAuthHint(message);
      Alert.alert(t('account.invite.failed', uiLanguage), message);
    } finally {
      setInviteBusy(false);
    }
  };

  const toggleFunction = (area: TenantFunctionArea) => {
    if (!canEditFunctions) return;
    setSelectedFunctions((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
    );
  };

  const activeMembershipLabel = activeMembership ? buildMembershipPickerLabel(activeMembership) : t('account.membership.none.label', uiLanguage);
  const activeMembershipDetail = activeMembership ? buildMembershipPickerDetail(activeMembership, uiLanguage) : t('account.membership.none.detail', uiLanguage);
  const activeRoleLabel = activeRole ? getRoleLabel(activeRole, uiLanguage) : t('account.role.none', uiLanguage);
  const activePermissionCount = auth.permissions.length;
  const activeProviderSet = new Set(auth.providers.map((item) => item.provider.toLowerCase()));
  const pendingInvites = companyInvites.filter((item) => item.status === 'PENDING');

  if (!auth.ready) {
    return (
      <ThemedView style={styles.centeredScreen}>
        <View style={styles.centeredCard}>
          <View style={styles.centeredIconWrap}>
            <TazeLogo size={72} framed={false} />
          </View>
          <ThemedText type="title" style={styles.centeredTitle}>
            {t('account.loading.title', uiLanguage)}
          </ThemedText>
          <ThemedText style={styles.centeredBody}>
            {t('account.loading.body', uiLanguage)}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.logoFrame}>
              <TazeLogo size={88} framed={false} />
            </View>
            <View style={styles.heroCopy}>
              <ThemedText type="title">{t('account.hero.title', uiLanguage)}</ThemedText>
              <View style={styles.statusRow}>
                <TazeStatusPill
                  label={signedIn ? t('account.status.signedIn', uiLanguage) : t('account.status.offline', uiLanguage)}
                  kind={signedIn ? 'success' : 'neutral'}
                />
                <TazeStatusPill label={activeRoleLabel} />
                <TazeStatusPill label={formatCompanyCount(auth.memberships.length, uiLanguage)} />
              </View>
              <ThemedText style={styles.smallLine}>
                {t('account.hero.body', uiLanguage)}
              </ThemedText>
              <View style={styles.stepRow}>
                {accountSteps.map((step) => (
                  <View key={step.index} style={styles.stepPill}>
                    <ThemedText type="defaultSemiBold" style={styles.stepIndex}>
                      {step.index}
                    </ThemedText>
                    <ThemedText style={styles.stepText}>{t(step.labelKey, uiLanguage)}</ThemedText>
                  </View>
                ))}
              </View>
              <ThemedText style={styles.smallLine}>{sessionEmail ?? t('account.session.none', uiLanguage)}</ThemedText>
            </View>
          </View>
        </View>

        {!configured ? (
          <TazeCard variant="panel" style={styles.panel}>
            <ThemedText type="defaultSemiBold">{t('account.supabase.inactive.title', uiLanguage)}</ThemedText>
            <ThemedText style={styles.smallLine}>
              {t('account.supabase.inactive.body', uiLanguage)}
            </ThemedText>
          </TazeCard>
        ) : null}

        {signedIn && hasMemberships ? (
          <>
            <View style={styles.panel}>
              <ThemedText type="defaultSemiBold">{t('account.activeCompany.title', uiLanguage)}</ThemedText>
              <ThemedText style={styles.smallLine}>{activeMembershipLabel}</ThemedText>
              <ThemedText style={styles.smallLine}>{activeMembershipDetail}</ThemedText>
              <View style={styles.contextSummaryRow}>
                <View style={styles.contextSummaryCard}>
                  <ThemedText style={styles.contextSummaryLabel}>{t('account.label.company', uiLanguage)}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.contextSummaryValue}>
                    {auth.company?.name ?? t('account.company.none', uiLanguage)}
                  </ThemedText>
                </View>
                <View style={styles.contextSummaryCard}>
                  <ThemedText style={styles.contextSummaryLabel}>{t('account.label.branch', uiLanguage)}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.contextSummaryValue}>
                    {auth.branch?.name ?? auth.branch?.code ?? t('account.branch.none', uiLanguage)}
                  </ThemedText>
                </View>
                <View style={styles.contextSummaryCard}>
                  <ThemedText style={styles.contextSummaryLabel}>{t('account.label.permissions', uiLanguage)}</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.contextSummaryValue}>
                    {formatLivePermissionCount(activePermissionCount, uiLanguage)}
                  </ThemedText>
                </View>
              </View>
            </View>

            {auth.memberships.length > 1 ? (
              <View style={styles.panel}>
                <ThemedText type="defaultSemiBold">{t('account.membership.switch.title', uiLanguage)}</ThemedText>
                <ThemedText style={styles.smallLine}>
                  {t('account.membership.switch.body', uiLanguage)}
                </ThemedText>
                <View style={styles.membershipRow}>
                  {auth.memberships.map((membership) => {
                    const active = membership.id === activeMembership?.id;
                    return (
                      <Pressable
                        key={membership.id}
                        onPress={() => handleSelectMembership(membership.id).catch(() => {})}
                        style={({ pressed }) => [
                          styles.membershipCard,
                          active ? styles.membershipCardActive : null,
                          pressed ? styles.membershipCardPressed : null,
                        ]}>
                        <View style={styles.membershipCardHeader}>
                          <ThemedText type="defaultSemiBold" style={styles.membershipCardTitle}>
                            {buildMembershipPickerLabel(membership)}
                          </ThemedText>
                          <ThemedText style={styles.membershipCardMeta}>
                            {membership.status} · {getRoleLabel(membership.role, uiLanguage)}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.membershipCardDetail}>
                          {buildMembershipPickerDetail(membership, uiLanguage)}
                        </ThemedText>
                        <View style={styles.membershipCardFooter}>
                          <ThemedText style={styles.membershipCardMeta}>
                            {formatFunctions(membership.functions, uiLanguage)}
                          </ThemedText>
                          <ThemedText style={styles.membershipCardLink}>
                            {t(active ? 'account.membership.activeAction' : 'account.membership.openAction', uiLanguage)}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.panel}>
              <ThemedText type="defaultSemiBold">{t('account.providers.title', uiLanguage)}</ThemedText>
              <ThemedText style={styles.smallLine}>
                {t('account.providers.body', uiLanguage)}
              </ThemedText>
              <View style={styles.providerRow}>
                {linkedProviders.length ? (
                  linkedProviders.map((provider) => (
                    <View key={`${provider.provider}:${provider.providerAccountId}`} style={styles.providerCard}>
                      <ThemedText type="defaultSemiBold" style={styles.providerTitle}>
                        {provider.label}
                      </ThemedText>
                      <ThemedText style={styles.providerDetail}>
                        {provider.providerEmail ?? t('account.providers.email.none', uiLanguage)}
                      </ThemedText>
                      <ThemedText style={styles.providerDetail}>
                        {provider.emailVerified ? t('account.providers.email.verified', uiLanguage) : t('account.providers.email.unverified', uiLanguage)}
                      </ThemedText>
                    </View>
                  ))
                ) : (
                  <View style={styles.providerEmptyCard}>
                    <ThemedText type="defaultSemiBold">{t('account.providers.empty.title', uiLanguage)}</ThemedText>
                    <ThemedText style={styles.smallLine}>
                      {t('account.providers.empty.body', uiLanguage)}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>

            {canInviteMembers && activeMembership ? (
              <View style={styles.panel}>
                <ThemedText type="defaultSemiBold">{t('account.form.invite.title', uiLanguage)}</ThemedText>
                <ThemedText style={styles.smallLine}>
                  {t('account.form.invite.body', uiLanguage)}
                </ThemedText>

                {inviteToken ? (
                  <View style={styles.inviteNotice}>
                    <ThemedText type="defaultSemiBold" style={styles.inviteNoticeTitle}>
                      {t('account.form.invite.noticeTitle', uiLanguage)}
                    </ThemedText>
                    <ThemedText style={styles.smallLine}>
                      {t('account.form.invite.noticeBody', uiLanguage)}
                    </ThemedText>
                  </View>
                ) : null}

                <TazeInput
                  icon="mail"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder={t('account.form.invite.emailPlaceholder', uiLanguage)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  containerStyle={styles.input}
                />
                <TazeInput
                  icon="badge"
                  value={inviteName}
                  onChangeText={setInviteName}
                  placeholder={t('account.form.invite.namePlaceholder', uiLanguage)}
                  autoCapitalize="words"
                  containerStyle={styles.input}
                />
                <TazeInput
                  icon="schedule"
                  value={inviteExpiryDays}
                  onChangeText={setInviteExpiryDays}
                  placeholder={t('account.form.invite.expiryPlaceholder', uiLanguage)}
                  keyboardType="number-pad"
                  containerStyle={styles.input}
                />

                <View style={styles.inlineLabelRow}>
                  <ThemedText type="defaultSemiBold" style={styles.inlineLabel}>
                    {t('account.form.invite.branchLabel', uiLanguage)}
                  </ThemedText>
                </View>
                <View style={styles.chipRow}>
                  {inviteBranches.length ? (
                    inviteBranches.map((branchOption) => {
                      const active = inviteBranchId === branchOption.id;
                      return (
                        <TazeChip
                          key={branchOption.id}
                          label={branchOption.code ? `${branchOption.name} · ${branchOption.code}` : branchOption.name}
                          active={active}
                          onPress={() => setInviteBranchId(branchOption.id)}
                          style={styles.functionChip}
                        />
                      );
                    })
                  ) : (
                    <ThemedText style={styles.smallLine}>{t('account.form.invite.noBranches', uiLanguage)}</ThemedText>
                  )}
                </View>

                <View style={styles.inlineLabelRow}>
                  <ThemedText type="defaultSemiBold" style={styles.inlineLabel}>
                    {t('account.form.invite.roleLabel', uiLanguage)}
                  </ThemedText>
                </View>
                <View style={styles.chipRow}>
                  {inviteRoleOptions.map((roleOption) => {
                    const active = inviteRole === roleOption;
                    return (
                      <TazeChip
                        key={roleOption}
                        label={getInviteRoleLabel(roleOption, uiLanguage)}
                        active={active}
                        onPress={() => setInviteRole(roleOption)}
                        style={styles.functionChip}
                      />
                    );
                  })}
                </View>

                <View style={styles.inlineLabelRow}>
                  <ThemedText type="defaultSemiBold" style={styles.inlineLabel}>
                    {t('account.form.invite.functionsLabel', uiLanguage)}
                  </ThemedText>
                </View>
                <View style={styles.chipRow}>
                  {FUNCTION_AREAS.map((area) => {
                    const active = inviteFunctions.includes(area);
                    return (
                      <TazeChip
                        key={area}
                        label={getFunctionAreaLabel(area, uiLanguage)}
                        active={active}
                        onPress={() => {
                          if (!canInviteMembers) return;
                          setInviteFunctions((current) =>
                            current.includes(area) ? current.filter((item) => item !== area) : [...current, area]
                          );
                        }}
                        style={styles.functionChip}
                      />
                    );
                  })}
                </View>

                <View style={styles.buttonRow}>
                  <TazeButton
                    label={inviteBusy ? t('account.form.invite.createBusy', uiLanguage) : t('account.form.invite.createAction', uiLanguage)}
                    onPress={() => handleCreateInvite().catch(() => {})}
                    disabled={!configured || busy || inviteBusy || !inviteBranches.length || !inviteBranchId}
                    variant="primary"
                    style={styles.button}
                  />
                </View>

                {latestInvite ? (
                  <View style={styles.inviteResultCard}>
                    <ThemedText type="defaultSemiBold">{t('account.form.invite.latestTitle', uiLanguage)}</ThemedText>
                    <ThemedText style={styles.smallLine}>
                      {t('account.form.invite.tokenPrefix', uiLanguage)}: {latestInvite.invite.tokenPrefix} · {t('account.form.invite.expiresAt', uiLanguage)}{' '}
                      {new Date(latestInvite.invite.expiresAt).toLocaleString(uiLanguage === 'nl' ? 'nl-BE' : uiLanguage)}
                    </ThemedText>
                    <ThemedText style={styles.smallLine}>
                      {latestInvite.invite.invitedEmail ?? t('account.form.invite.noEmail', uiLanguage)} · {getRoleLabel(latestInvite.invite.role, uiLanguage)}
                    </ThemedText>
                    <ThemedText style={styles.smallLine}>
                      {t('account.form.invite.functionsPrefix', uiLanguage)}: {latestInvite.invite.functionAreas.length ? formatFunctions(latestInvite.invite.functionAreas, uiLanguage) : t('account.form.invite.noSpecificFunctions', uiLanguage)}
                    </ThemedText>
                    <ThemedText style={styles.smallLine} numberOfLines={2}>
                      {t('account.form.invite.linkPrefix', uiLanguage)}: {latestInvite.inviteLink}
                    </ThemedText>
                    <View style={styles.buttonRow}>
                      <TazeButton
                        label={t('account.form.invite.copyAction', uiLanguage)}
                        onPress={() => copyInviteLink(latestInvite.inviteLink).catch(() => {})}
                        variant="ghost"
                        style={styles.button}
                      />
                    </View>
                  </View>
                ) : null}

                {pendingInvites.length ? (
                  <View style={styles.pendingInviteList}>
                    <ThemedText type="defaultSemiBold">{t('account.form.invite.pendingTitle', uiLanguage)}</ThemedText>
                    {pendingInvites.map((invite) => {
                      const branchLabel =
                        inviteBranches.find((branchOption) => branchOption.id === invite.branchId)?.name ??
                        invite.branchId;
                      return (
                        <View key={invite.id} style={styles.pendingInviteCard}>
                          <View style={styles.membershipCardHeader}>
                            <ThemedText type="defaultSemiBold" style={styles.membershipCardTitle}>
                              {getRoleLabel(invite.role, uiLanguage)}
                            </ThemedText>
                            <ThemedText style={styles.membershipCardMeta}>
                              {branchLabel} · {invite.status}
                            </ThemedText>
                          </View>
                          <ThemedText style={styles.membershipCardDetail}>
                            {invite.invitedEmail ?? t('account.form.invite.noLinkedEmail', uiLanguage)} · {invite.tokenPrefix}
                          </ThemedText>
                          <ThemedText style={styles.membershipCardMeta}>
                            {t('account.form.invite.expiresAt', uiLanguage)} {new Date(invite.expiresAt).toLocaleString(uiLanguage === 'nl' ? 'nl-BE' : uiLanguage)}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {canEditFunctions && activeMembership ? (
              <View style={styles.panel}>
                <ThemedText type="defaultSemiBold">{t('account.form.functions.title', uiLanguage)}</ThemedText>
                <ThemedText style={styles.smallLine}>
                  {t('account.form.functions.body', uiLanguage)}
                </ThemedText>
                <View style={styles.chipRow}>
                  {FUNCTION_AREAS.map((area) => {
                    const active = selectedFunctions.includes(area);
                    return (
                      <TazeChip
                        key={area}
                        label={getFunctionAreaLabel(area, uiLanguage)}
                        active={active}
                        onPress={() => toggleFunction(area)}
                        style={styles.functionChip}
                      />
                    );
                  })}
                </View>
                <View style={styles.buttonRow}>
                  <TazeButton
                    label={t('account.form.functions.saveAction', uiLanguage)}
                    onPress={() => handleSaveFunctions().catch(() => {})}
                    disabled={busy}
                    variant="primary"
                    style={styles.button}
                  />
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {signedIn && !hasMemberships ? (
          <View style={styles.panel}>
            <ThemedText type="defaultSemiBold">{t('account.form.company.title', uiLanguage)}</ThemedText>
            <ThemedText style={styles.smallLine}>
              {t('account.form.company.body', uiLanguage)}
            </ThemedText>
            <TazeInput
              icon="store"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder={t('account.form.company.namePlaceholder', uiLanguage)}
              autoCapitalize="words"
              containerStyle={styles.input}
            />
            <TazeInput
              icon="badge"
              value={companyLegalName}
              onChangeText={setCompanyLegalName}
              placeholder={t('account.form.company.legalNamePlaceholder', uiLanguage)}
              autoCapitalize="words"
              containerStyle={styles.input}
            />
            <TazeInput
              icon="location-city"
              value={branchName}
              onChangeText={setBranchName}
              placeholder={t('account.form.company.branchPlaceholder', uiLanguage)}
              autoCapitalize="words"
              containerStyle={styles.input}
            />
            <View style={styles.buttonRow}>
              <TazeButton
                label={t('account.form.company.createAction', uiLanguage)}
                onPress={() => handleCreateCompany().catch(() => {})}
                disabled={busy}
                variant="primary"
                style={styles.button}
              />
            </View>
          </View>
        ) : null}

        {!signedIn ? (
          <>
            <View style={styles.panel}>
              <ThemedText type="defaultSemiBold">{t('account.providerLogin.title', uiLanguage)}</ThemedText>
              <ThemedText style={styles.smallLine}>
                {t('account.providerLogin.body', uiLanguage)}
              </ThemedText>
              <View style={styles.providerButtonRow}>
                {providerLoginOptions.map((item) => {
                  const active = item.provider === 'google';
                  return (
                    <View key={item.provider} style={styles.providerButtonCard}>
                      <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
                      <ThemedText style={styles.providerDetail}>{item.detail}</ThemedText>
                      <TazeButton
                        label={item.label}
                        onPress={() => startOAuthFlow(item.provider, 'login').catch(() => {})}
                        disabled={!configured || busy || !active}
                        variant={active ? 'primary' : 'secondary'}
                        style={styles.providerButton}
                      />
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.panel}>
              <ThemedText type="defaultSemiBold">{t('account.emailLogin.title', uiLanguage)}</ThemedText>
              <ThemedText style={styles.smallLine}>
                {t('account.emailLogin.body', uiLanguage)}
              </ThemedText>
              <TazeInput
                icon="mail"
                value={email}
                onChangeText={setEmail}
                placeholder="jij@bedrijf.be"
                autoCapitalize="none"
                keyboardType="email-address"
                containerStyle={styles.input}
              />
              <TazeInput
                icon="lock"
                value={password}
                onChangeText={setPassword}
                placeholder={t('account.emailLogin.passwordPlaceholder', uiLanguage)}
                secureTextEntry
                containerStyle={styles.input}
              />

              <View style={styles.buttonRow}>
                <TazeButton
                  label={t('account.emailLogin.loginAction', uiLanguage)}
                  onPress={() => handleSignIn().catch(() => {})}
                  disabled={!configured || busy}
                  variant="primary"
                  style={styles.button}
                />
                <TazeButton
                  label={t('account.emailLogin.createAction', uiLanguage)}
                  onPress={() => handleSignUp().catch(() => {})}
                  disabled={!configured || busy}
                  variant="secondary"
                  style={styles.button}
                />
              </View>

              {authHint ? (
                <View style={styles.hintBox}>
                  <ThemedText style={styles.hintText}>{authHint}</ThemedText>
                </View>
              ) : null}

              <Pressable
                style={styles.textButton}
                disabled={!configured || busy}
                onPress={() => handleResetPassword().catch(() => {})}
              >
                <ThemedText type="defaultSemiBold" style={styles.textButtonLabel}>
                  {t('account.emailLogin.forgotPassword', uiLanguage)}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.panel}>
            <ThemedText type="defaultSemiBold">{t('account.providerLink.title', uiLanguage)}</ThemedText>
            <ThemedText style={styles.smallLine}>
              {t('account.providerLink.body', uiLanguage)}
            </ThemedText>
            <View style={styles.providerButtonRow}>
              {providerOptions.map((item) => {
                const linked = activeProviderSet.has(item.provider);
                return (
                  <View key={item.provider} style={styles.providerButtonCard}>
                    <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
                    <ThemedText style={styles.providerDetail}>
                      {linked ? t('account.providerLink.linkedStatus', uiLanguage) : t('account.providerLink.unlinkedStatus', uiLanguage)}
                    </ThemedText>
                    <TazeButton
                      label={linked ? `${t('account.providerLink.linkedAction', uiLanguage)}: ${item.label}` : `${t('account.providerLink.linkAction', uiLanguage)} ${item.label}`}
                      onPress={() => startOAuthFlow(item.provider, 'link').catch(() => {})}
                      disabled={!configured || busy || linked}
                      variant={linked ? 'ghost' : 'secondary'}
                      style={styles.providerButton}
                    />
                  </View>
                );
              })}
            </View>
            {authHint ? (
              <View style={styles.hintBox}>
                <ThemedText style={styles.hintText}>{authHint}</ThemedText>
              </View>
            ) : null}
          </View>
        )}

        {signedIn ? (
          <View style={styles.panel}>
            <ThemedText type="defaultSemiBold">{t('account.session.title', uiLanguage)}</ThemedText>
            <ThemedText style={styles.smallLine}>
              {sessionEmail ?? t('account.session.none', uiLanguage)} · {t('account.session.contextBody', uiLanguage)}
            </ThemedText>
            <View style={styles.buttonRow}>
              <TazeButton
                label={t('account.session.logoutAction', uiLanguage)}
                onPress={() => handleSignOut().catch(() => {})}
                disabled={busy}
                variant="danger"
                style={styles.button}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.footerRow}>
          <TazeButton label={t('account.footer.help', uiLanguage)} icon="support-agent" onPress={() => router.push(LegalConfig.supportRoute as Href)} variant="secondary" style={styles.footerButton} />
          <TazeButton label={t('account.footer.privacy', uiLanguage)} icon="shield" onPress={() => router.push(LegalConfig.privacyRoute as Href)} variant="ghost" style={styles.footerButton} />
          <TazeButton label={t('account.footer.contact', uiLanguage)} icon="mail" onPress={() => router.push(LegalConfig.contactRoute as Href)} variant="ghost" style={styles.footerButton} />
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 28,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
  },
  screen: {
    width: '100%',
    maxWidth: 1080,
    gap: 14,
  },
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.82)',
    padding: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoFrame: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  stepIndex: {
    color: '#0f766e',
  },
  stepText: {
    color: Brand.ink,
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallLine: {
    color: '#475569',
  },
  panel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.82)',
    padding: 18,
    gap: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  input: {
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    minWidth: 140,
    flexGrow: 1,
  },
  hintBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 10,
  },
  hintText: {
    color: '#1e3a8a',
  },
  textButton: {
    paddingVertical: 4,
  },
  textButtonLabel: {
    color: '#0f766e',
  },
  providerButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  providerButtonCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    padding: 14,
    gap: 8,
  },
  providerButton: {
    alignSelf: 'stretch',
  },
  providerDetail: {
    color: Brand.inkMuted,
  },
  providerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  providerCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 14,
    gap: 4,
  },
  providerTitle: {
    color: Brand.ink,
  },
  providerEmptyCard: {
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    padding: 14,
    gap: 4,
  },
  inviteNotice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    padding: 12,
    gap: 4,
  },
  inviteNoticeTitle: {
    color: '#1d4ed8',
  },
  inviteResultCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    padding: 14,
    gap: 8,
  },
  pendingInviteList: {
    gap: 10,
  },
  pendingInviteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 12,
    gap: 6,
  },
  inlineLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineLabel: {
    color: Brand.primary,
  },
  contextSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextSummaryCard: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(248, 250, 252, 0.92)',
    padding: 14,
    gap: 4,
  },
  contextSummaryLabel: {
    color: Brand.primary,
    fontSize: 12,
  },
  contextSummaryValue: {
    color: Brand.ink,
  },
  membershipRow: {
    gap: 10,
  },
  membershipCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 14,
    gap: 8,
  },
  membershipCardActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ecfeff',
  },
  membershipCardPressed: {
    opacity: 0.94,
    transform: [{ translateY: 1 }],
  },
  membershipCardHeader: {
    gap: 2,
  },
  membershipCardTitle: {
    color: Brand.ink,
  },
  membershipCardMeta: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  membershipCardDetail: {
    color: Brand.ink,
  },
  membershipCardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  membershipCardLink: {
    color: '#0f766e',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  functionChip: {
    minWidth: 120,
  },
  centeredScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Brand.canvas,
  },
  centeredCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
  },
  centeredIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 253, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredTitle: {
    fontSize: 28,
    lineHeight: 30,
    textAlign: 'center',
  },
  centeredBody: {
    textAlign: 'center',
    color: Brand.inkMuted,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  footerButton: {
    minWidth: 120,
    flexGrow: 1,
  },
});


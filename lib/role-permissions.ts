import { getItem, removeItem, setItem } from 'lib/app-storage';
import { isSupabaseConfigured } from 'lib/supabase';
import {
  getPermissionLabel,
  getPermissionsForRole,
  getRoleLabel,
  normalizeAppRole,
  roleHasPermission,
  type AppPermission,
  type AppRole,
} from 'lib/auth-model';

export type { AppPermission, AppRole };

export const LOCAL_ROLE_STORAGE_KEY = 'taze-role-v1';

export function isAppRole(value: unknown): value is AppRole {
  return normalizeAppRole(value) !== null;
}

export { getRoleLabel, getPermissionLabel };

export async function loadStoredRole() {
  try {
    const raw = await getItem(LOCAL_ROLE_STORAGE_KEY);
    return normalizeAppRole(raw);
  } catch {
    return null;
  }
}

export async function saveStoredRole(role: AppRole) {
  await setItem(LOCAL_ROLE_STORAGE_KEY, role);
}

export async function clearStoredRole() {
  await removeItem(LOCAL_ROLE_STORAGE_KEY);
}

export function hasPermission(params: {
  permission: AppPermission;
  role: string | null;
  email?: string | null;
  configured?: boolean;
  permissions?: string[] | null;
}) {
  const configured = typeof params.configured === 'boolean' ? params.configured : isSupabaseConfigured();
  if (!configured) return true;
  if (!params.email) return true;

  const role = normalizeAppRole(params.role);
  if (!role) return false;

  if (params.permissions?.length) {
    const permissions = new Set([...(params.permissions ?? []), ...getPermissionsForRole(role)]);
    if (permissions.has(params.permission)) {
      return true;
    }
  }

  return roleHasPermission(role, params.permission, params.permissions ?? []);
}

export function getPermissionMessage(permission: AppPermission) {
  if (permission === 'company.manage_data') {
    return 'Alleen een eigenaar of IT/admin mag bedrijfsdata beheren.';
  }

  if (permission === 'manage_finance' || permission === 'billing.manage' || permission === 'finance.read' || permission === 'invoice.manage') {
    return 'Alleen een eigenaar of manager mag finance, betalingen en facturatie beheren.';
  }

  if (permission === 'manage_security' || permission === 'ai.settings.manage') {
    return 'Alleen een eigenaar of manager mag security- en AI-instellingen beheren.';
  }

  if (permission === 'transport.confirm_business_impact') {
    return 'Alleen een eigenaar of manager mag transportbedrijfsimpact bevestigen.';
  }

  if (permission === 'manage_devtools' || permission === 'admin.manage') {
    return 'Alleen een eigenaar mag beheer- en resetacties uitvoeren.';
  }

  return 'Deze actie is niet beschikbaar voor jouw huidige rol of bedrijfscontext.';
}

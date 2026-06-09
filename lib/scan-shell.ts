import { getFunctionAreaLabel, roleHasPermission, type AppRole, type TenantFunctionArea } from 'lib/auth-model';
import { type AppLanguage } from 'lib/i18n';

export const SCAN_WORKSPACE_FUNCTION_AREAS: readonly TenantFunctionArea[] = [
  'BAR',
  'KEUKEN',
  'AFGEWERKT_PRODUCT',
  'DISTRIBUTIE',
  'MAGAZIJN',
  'INKOOP',
  'ADMIN',
];

export type ScanShellSuggestionTone = 'primary' | 'accent' | 'neutral' | 'warning';

export type ScanShellSuggestion = {
  id: string;
  title: string;
  description: string;
  tone: ScanShellSuggestionTone;
  label: string;
};

function hasWorkspaceFunction(functions: TenantFunctionArea[]) {
  return functions.some((functionArea) => SCAN_WORKSPACE_FUNCTION_AREAS.includes(functionArea));
}

export function canUseScanWorkspace(params: { role?: AppRole | null; permissions: string[]; functions: TenantFunctionArea[] }) {
  return (
    params.permissions.some((permission) => permission.trim() === 'inventory.read') ||
    roleHasPermission(params.role, 'inventory.read', params.permissions) ||
    hasWorkspaceFunction(params.functions)
  );
}

export function buildScanShellSuggestions(functions: TenantFunctionArea[]): ScanShellSuggestion[] {
  const set = new Set(functions);
  const suggestions: ScanShellSuggestion[] = [];

  if (set.has('BAR')) {
    suggestions.push({
      id: 'bar-flow',
      title: 'Barvoorstel',
      description: 'Controleer drankvoorraad met snelle omloopsellers, breuk en bijvulpunten.',
      tone: 'accent',
      label: 'Interpretatie',
    });
  }

  if (set.has('KEUKEN')) {
    suggestions.push({
      id: 'kitchen-flow',
      title: 'Keukenvoorstel',
      description: 'Kijk naar ingredienten met korte houdbaarheid, mise-en-place en food cost impact.',
      tone: 'warning',
      label: 'AI-voorstel',
    });
  }

  if (set.has('DISTRIBUTIE')) {
    suggestions.push({
      id: 'delivery-flow',
      title: 'Distributievoorstel',
      description: 'Verifieer leveringsstatus, schadebewijs en volgorde voordat je iets verwerkt.',
      tone: 'primary',
      label: 'AI-voorstel',
    });
  }

  if (set.has('MAGAZIJN')) {
    suggestions.push({
      id: 'warehouse-flow',
      title: 'Magazijnvoorstel',
      description: 'Vergelijk tellingen met opslaglocaties en markeer afwijkingen als observatie.',
      tone: 'neutral',
      label: 'Interpretatie',
    });
  }

  if (set.has('AFGEWERKT_PRODUCT')) {
    suggestions.push({
      id: 'production-flow',
      title: 'Productievoorstel',
      description: 'Koppel afgewerkt product aan gebruikte grondstoffen en batchcontext.',
      tone: 'accent',
      label: 'AI-voorstel',
    });
  }

  if (set.has('INKOOP')) {
    suggestions.push({
      id: 'purchase-flow',
      title: 'Inkoopvoorstel',
      description: 'Controleer minimumvoorraad, besteladvies en leveranciersafwijkingen.',
      tone: 'warning',
      label: 'AI-voorstel',
    });
  }

  if (set.has('ADMIN')) {
    suggestions.push({
      id: 'admin-flow',
      title: 'Beheerobservatie',
      description: 'Controleer auditstatus, goedkeuringen en logvolledigheid zonder data te wijzigen.',
      tone: 'neutral',
      label: 'Interpretatie',
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      id: 'scan-core',
      title: 'Scanvoorstel',
      description: 'Scans zijn observaties. Voorraadwijzigingen volgen pas na bevestiging of goedkeuring.',
      tone: 'neutral',
      label: 'AI-voorstel',
    });
  }

  return suggestions.slice(0, 4);
}

export function formatScanFunctions(functions: TenantFunctionArea[], language: AppLanguage = 'nl') {
  if (!functions.length) {
    return 'Nog geen scanfunctie geselecteerd';
  }

  return functions.map((functionArea) => getFunctionAreaLabel(functionArea, language)).join(' / ');
}

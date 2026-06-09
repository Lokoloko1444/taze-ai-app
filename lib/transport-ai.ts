import { getCachedTransportAudit, type TransportAuditEntry } from 'lib/transport-audit';
import {
  getCachedTransportPreferences,
  getDefaultTransportAppId,
  getTransportPreferenceForScope,
  type TransportPreferenceRecord,
} from 'lib/transport-favorites';
import {
  getTransportRecommendation,
  transportApps,
  type TransportRegion,
  type TransportUseCase,
} from 'lib/transport-hub';

type BuildTransportAiContextParams = {
  region?: TransportRegion | 'Alle';
  useCase?: TransportUseCase | 'Alle';
  preferences?: TransportPreferenceRecord[];
  auditEntries?: TransportAuditEntry[];
  maxRecent?: number;
};

type BuildTransportHubPathParams = {
  region?: string | null;
  useCase?: string | null;
  partnerId?: string | null;
  source?: string | null;
  auditId?: string | null;
};

export function parseTransportScopeLabel(scopeLabel: string) {
  const value = scopeLabel.trim();
  if (value.toLowerCase().startsWith('regio ')) {
    return { region: value.slice(6), useCase: null };
  }
  if (value.toLowerCase().startsWith('use case ')) {
    return { region: null, useCase: value.slice(9) };
  }
  return { region: null, useCase: null };
}

export function buildTransportHubPath({
  region,
  useCase,
  partnerId,
  source,
  auditId,
}: BuildTransportHubPathParams = {}) {
  const params: string[] = [];

  if (region && region !== 'Alle') {
    params.push(`region=${encodeURIComponent(region)}`);
  }
  if (useCase && useCase !== 'Alle') {
    params.push(`useCase=${encodeURIComponent(useCase)}`);
  }
  if (partnerId) {
    params.push(`partner=${encodeURIComponent(partnerId)}`);
  }
  if (source) {
    params.push(`source=${encodeURIComponent(source)}`);
  }
  if (auditId) {
    params.push(`auditId=${encodeURIComponent(auditId)}`);
  }

  return params.length > 0 ? `/transport?${params.join('&')}` : '/transport';
}

export function buildTransportAiContext({
  region = 'Alle',
  useCase = 'Alle',
  preferences = getCachedTransportPreferences(),
  auditEntries = getCachedTransportAudit(),
  maxRecent = 5,
}: BuildTransportAiContextParams = {}) {
  const recommended = getTransportRecommendation(region, useCase);
  const recentEntries = auditEntries.slice(0, maxRecent);

  const byPartner = new Map<string, number>();
  const byScope = new Map<string, number>();
  auditEntries.forEach((entry) => {
    byPartner.set(entry.appLabel, (byPartner.get(entry.appLabel) ?? 0) + 1);
    byScope.set(entry.scopeLabel, (byScope.get(entry.scopeLabel) ?? 0) + 1);
  });

  const topPartner = [...byPartner.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
  const topScope = [...byScope.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;

  const defaultScopes: Array<{ scopeType: 'region' | 'useCase'; scopeValue: string }> = [];
  const pushScope = (scopeType: 'region' | 'useCase', scopeValue: string) => {
    if (defaultScopes.some((entry) => entry.scopeType === scopeType && entry.scopeValue === scopeValue)) return;
    defaultScopes.push({ scopeType, scopeValue });
  };
  if (useCase !== 'Alle') pushScope('useCase', useCase);
  if (region !== 'Alle') pushScope('region', region);
  pushScope('region', 'Europa');
  pushScope('region', 'Wereldwijd');

  const defaults = defaultScopes
    .map((scope) => {
      const appId = getDefaultTransportAppId(preferences, scope);
      const app = transportApps.find((candidate) => candidate.id === appId);
      return app
        ? {
            label: app.label,
            scopeType: scope.scopeType,
            scopeValue: scope.scopeValue,
          }
        : null;
    })
    .filter((entry): entry is { label: string; scopeType: 'region' | 'useCase'; scopeValue: string } => Boolean(entry));

  const favorites = preferences
    .filter((entry) => entry.kind === 'favorite')
    .slice(0, 6)
    .map((entry) => {
      const app = transportApps.find((candidate) => candidate.id === entry.appId);
      return app
        ? {
            label: app.label,
            scopeType: entry.scopeType,
            scopeValue: entry.scopeValue,
          }
        : null;
    })
    .filter((entry): entry is { label: string; scopeType: 'region' | 'useCase'; scopeValue: string } => Boolean(entry));

  const scopedFavorites = [
    ...(useCase !== 'Alle'
      ? getTransportPreferenceForScope(preferences, { scopeType: 'useCase', scopeValue: useCase, kind: 'favorite' })
      : []),
    ...(region !== 'Alle'
      ? getTransportPreferenceForScope(preferences, { scopeType: 'region', scopeValue: region, kind: 'favorite' })
      : []),
  ]
    .slice(0, 4)
    .map((entry) => {
      const app = transportApps.find((candidate) => candidate.id === entry.appId);
      return app ? app.label : null;
    })
    .filter((entry): entry is string => Boolean(entry));

  const recommendedStatus = recommended
    ? (() => {
        const scopedDefault =
          (useCase !== 'Alle'
            ? getTransportPreferenceForScope(preferences, { scopeType: 'useCase', scopeValue: useCase, kind: 'default' })[0]
            : null) ??
          (region !== 'Alle'
            ? getTransportPreferenceForScope(preferences, { scopeType: 'region', scopeValue: region, kind: 'default' })[0]
            : null) ??
          null;
        const scopedFavoriteCount = preferences.filter(
          (entry) =>
            entry.kind === 'favorite' &&
            entry.appId === recommended.id &&
            ((useCase !== 'Alle' && entry.scopeType === 'useCase' && entry.scopeValue === useCase) ||
              (region !== 'Alle' && entry.scopeType === 'region' && entry.scopeValue === region))
        ).length;
        const activePreference = scopedDefault?.appId === recommended.id ? scopedDefault : null;
        const statusBits: string[] = [];
        if (activePreference) {
          statusBits.push('staat al als standaard voor deze scope');
        }
        if (scopedFavoriteCount > 0) {
          statusBits.push(`heeft ${scopedFavoriteCount} favorietmarkering(en) in deze scope`);
        }
        if (activePreference?.syncState === 'synced') {
          statusBits.push('syncstatus is bevestigd');
        } else if (activePreference?.syncState === 'queued') {
          statusBits.push('syncstatus staat nog in wachtrij');
        } else if (activePreference?.syncState === 'local') {
          statusBits.push('syncstatus is voorlopig alleen lokaal');
        }
        return {
          isDefault: Boolean(activePreference),
          favoriteCount: scopedFavoriteCount,
          syncState: activePreference?.syncState ?? null,
          statusSummary: statusBits.length > 0 ? `${recommended.label} ${statusBits.join(', ')}.` : `${recommended.label} heeft nog geen opgeslagen scopespecifieke voorkeurstatus.`,
        };
      })()
    : null;

  const syncStats = {
    total: preferences.length,
    synced: preferences.filter((entry) => entry.syncState === 'synced').length,
    queued: preferences.filter((entry) => entry.syncState === 'queued').length,
    local: preferences.filter((entry) => entry.syncState === 'local').length,
    failedRecent: preferences
      .filter((entry) => entry.syncState === 'queued' && entry.syncError)
      .slice(0, 4)
      .map((entry) => ({
        appLabel: transportApps.find((candidate) => candidate.id === entry.appId)?.label ?? entry.appId,
        scopeType: entry.scopeType,
        scopeValue: entry.scopeValue,
        kind: entry.kind,
        error: entry.syncError,
      })),
  };
  const syncSummary =
    syncStats.failedRecent.length > 0
      ? `${syncStats.failedRecent.length} transportvoorkeur(en) staan in wachtrij met recente syncfout.`
      : syncStats.queued > 0
        ? `${syncStats.queued} transportvoorkeur(en) wachten nog op sync.`
        : syncStats.synced > 0
          ? `${syncStats.synced} transportvoorkeur(en) zijn al backend bevestigd.`
          : syncStats.local > 0
            ? `${syncStats.local} transportvoorkeur(en) staan voorlopig alleen lokaal.`
            : 'Nog geen transportvoorkeuren opgeslagen.';

  return {
    transport: {
      region,
      useCase,
      recommendedPartner: recommended
        ? {
            id: recommended.id,
            label: recommended.label,
            reason: recommended.reason,
            category: recommended.category,
            preferenceStatus: recommendedStatus,
          }
        : null,
      defaults,
      scopedFavorites,
      favoritePartners: favorites,
      preferenceSync: {
        ...syncStats,
        syncSummary,
      },
      audit: {
        totalEvents: auditEntries.length,
        topPartner: topPartner ? { label: topPartner[0], events: topPartner[1] } : null,
        topScope: topScope ? { label: topScope[0], events: topScope[1] } : null,
        recent: recentEntries.map((entry) => ({
          partner: entry.appLabel,
          action: entry.action,
          scope: entry.scopeLabel,
          detail: entry.detail,
        })),
      },
    },
  };
}

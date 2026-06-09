import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeChip } from 'components/taze-chip';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useAuth } from 'lib/auth-context';
import {
  getTransportRecommendation,
  matchesTransportFilters,
  topTransportAppHighlights,
  transportApps,
  transportRegions,
  transportUseCases,
  type TransportApp,
  type TransportRegion,
  type TransportUseCase,
} from 'lib/transport-hub';
import {
  clearTransportAudit,
  getCachedTransportAudit,
  loadTransportAudit,
  logTransportAudit,
  subscribeTransportAudit,
  type TransportAuditEntry,
} from 'lib/transport-audit';
import { markAiAuditOutcome } from 'lib/ai-audit';
import {
  getCachedTransportPreferences,
  getDefaultTransportAppId,
  getTransportPreferenceForScope,
  loadTransportPreferences,
  removeTransportPreference,
  removeTransportPreferenceByMatch,
  saveTransportPreference,
  subscribeTransportPreferences,
  syncFailedTransportPreferences,
  syncTransportPreferenceById,
  syncTransportPreferences,
  type TransportPreferenceRecord,
  type TransportPreferenceScopeType,
} from 'lib/transport-favorites';
import {
  canTransitionDistributionStatus,
  getDistributionStatusLabel,
  type DistributionLine,
  type DistributionOrder,
} from 'lib/distribution-model';
import { resolveAppLanguage, t, type TranslationKey } from 'lib/i18n';

function formatTransportAlertTranslation(
  template: string,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
}

function getTransportPreferenceSyncMeta(state: 'local' | 'queued' | 'synced') {
  switch (state) {
    case 'synced':
      return { label: 'Synced', tone: 'success' as const };
    case 'queued':
      return { label: 'Wachtrij', tone: 'warning' as const };
    default:
      return { label: 'Lokaal', tone: 'neutral' as const };
  }
}

function formatPreferenceScope(entry: TransportPreferenceRecord) {
  return `${entry.scopeType === 'useCase' ? 'Use case' : 'Regio'} ${entry.scopeValue}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Onbekend moment';
  return date.toLocaleString('nl-BE');
}

function getBusinessDistributionStatusLabel(status: DistributionOrder['status']) {
  if (status === 'arrived') {
    return 'Aangekomen bij klant';
  }
  return getDistributionStatusLabel(status);
}

const SEED_DISTRIBUTION_ORDER: DistributionOrder = {
  id: 'DIST-2026-001',
  companyId: 'seed-company',
  branchId: 'seed-branch',
  status: 'ready_for_departure',
  createdByMembershipId: 'seed-membership',
  assignedDriverMembershipId: null,
  readyForDepartureAt: null,
  departedAt: null,
  arrivedAt: null,
  customerConfirmedAt: null,
  createdAt: '2026-05-06T08:00:00.000Z',
  updatedAt: '2026-05-06T08:00:00.000Z',
};

const SEED_DISTRIBUTION_LINES: DistributionLine[] = [
  {
    id: 'DIST-LINE-2026-001',
    distributionOrderId: SEED_DISTRIBUTION_ORDER.id,
    productId: 'seed-product-001',
    productLabel: 'Dranklevering 24x',
    barcode: null,
    quantity: 6,
    unit: 'kratten',
    linkedStockMovementId: null,
  },
];

export default function TransportScreen() {
  const params = useLocalSearchParams<{ region?: string; useCase?: string; partner?: string; source?: string; auditId?: string }>();
  const auth = useAuth();
  const uiLanguage = useMemo(resolveAppLanguage, []);
  const transportAlertT = useMemo(
    () => (key: TranslationKey, replacements?: Record<string, string | number | null | undefined>) =>
      formatTransportAlertTranslation(t(key, uiLanguage), replacements),
    [uiLanguage]
  );
  const [selectedRegion, setSelectedRegion] = useState<TransportRegion>('Alle');
  const [selectedUseCase, setSelectedUseCase] = useState<TransportUseCase>('Alle');
  const [transportPreferences, setTransportPreferences] = useState(() => getCachedTransportPreferences());
  const [transportAudit, setTransportAudit] = useState<TransportAuditEntry[]>(() => getCachedTransportAudit());
  const [preferenceKindFilter, setPreferenceKindFilter] = useState<'all' | 'favorite' | 'default'>('all');
  const [preferenceSyncFilter, setPreferenceSyncFilter] = useState<'all' | 'local' | 'queued' | 'synced'>('all');
  const [selectedPreferenceIds, setSelectedPreferenceIds] = useState<string[]>([]);
  const [distributionOrder, setDistributionOrder] = useState<DistributionOrder>(() => ({ ...SEED_DISTRIBUTION_ORDER }));
  const [distributionNotice, setDistributionNotice] = useState<string | null>(null);
  const [distributionDriverNotice, setDistributionDriverNotice] = useState<string | null>(null);
  const [distributionDepartureNotice, setDistributionDepartureNotice] = useState<string | null>(null);
  const [distributionTransitNotice, setDistributionTransitNotice] = useState<string | null>(null);
  const [distributionTransitUpdateNotice, setDistributionTransitUpdateNotice] = useState<string | null>(null);
  const [distributionTransitLastUpdateLabel, setDistributionTransitLastUpdateLabel] = useState<string>('net bevestigd');
  const [distributionArrivalNotice, setDistributionArrivalNotice] = useState<string | null>(null);
  const [distributionDeliveryBookedOff, setDistributionDeliveryBookedOff] = useState(false);
  const [distributionDeliveryBookedOffNotice, setDistributionDeliveryBookedOffNotice] = useState<string | null>(null);
  const [distributionCustomerConfirmed, setDistributionCustomerConfirmed] = useState(false);
  const [distributionCustomerConfirmationNotice, setDistributionCustomerConfirmationNotice] = useState<string | null>(null);
  const [distributionBusinessImpactConfirmed, setDistributionBusinessImpactConfirmed] = useState(false);
  const [distributionBusinessImpactNotice, setDistributionBusinessImpactNotice] = useState<string | null>(null);
  const [distributionReportNotice, setDistributionReportNotice] = useState<string | null>(null);
  const lastRecommendationKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTransportPreferences()
      .then(async (entries) => {
        if (!cancelled) {
          setTransportPreferences(entries);
        }
        return syncTransportPreferences();
      })
      .then((entries) => {
        if (!cancelled) {
          setTransportPreferences(entries);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeTransportPreferences((entries) => {
      if (!cancelled) {
        setTransportPreferences(entries);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof params.region === 'string' && transportRegions.includes(params.region as TransportRegion)) {
      setSelectedRegion(params.region as TransportRegion);
    }
    if (typeof params.useCase === 'string' && transportUseCases.includes(params.useCase as TransportUseCase)) {
      setSelectedUseCase(params.useCase as TransportUseCase);
    }
  }, [params.region, params.useCase]);

  useEffect(() => {
    let cancelled = false;
    loadTransportAudit()
      .then((entries) => {
        if (!cancelled) {
          setTransportAudit(entries);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeTransportAudit((entries) => {
      if (!cancelled) {
        setTransportAudit(entries);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setDistributionOrder((current) => ({
      ...current,
      companyId: auth.companyId ?? current.companyId,
      branchId: auth.branchId ?? current.branchId,
      createdByMembershipId: auth.activeMembership?.id ?? current.createdByMembershipId,
    }));
  }, [auth.activeMembership?.id, auth.branchId, auth.companyId]);

  const topTransportApps = useMemo(
    () =>
      topTransportAppHighlights
        .map((highlight) => {
          const app = transportApps.find((item) => item.id === highlight.id);
          if (!app) return null;
          return { ...highlight, ...app };
        })
        .filter((entry): entry is TransportApp & (typeof topTransportAppHighlights)[number] => Boolean(entry)),
    []
  );

  const filteredTransportApps = useMemo(() => {
    return transportApps.filter((item) => matchesTransportFilters(item, selectedRegion, selectedUseCase));
  }, [selectedRegion, selectedUseCase]);
  const spotlightPartner = useMemo(() => {
    if (typeof params.partner !== 'string') return null;
    const needle = params.partner.trim().toLowerCase();
    if (!needle) return null;
    return transportApps.find((app) => app.id.toLowerCase() === needle || app.label.trim().toLowerCase() === needle) ?? null;
  }, [params.partner]);
  const orderedTransportApps = useMemo(() => {
    if (!spotlightPartner) return filteredTransportApps;
    const hasPartner = filteredTransportApps.some((app) => app.id === spotlightPartner.id);
    if (!hasPartner) return filteredTransportApps;
    return [
      spotlightPartner,
      ...filteredTransportApps.filter((app) => app.id !== spotlightPartner.id),
    ];
  }, [filteredTransportApps, spotlightPartner]);

  const recommendedTransport = useMemo(
    () => getTransportRecommendation(selectedRegion, selectedUseCase),
    [selectedRegion, selectedUseCase]
  );
  const activeScope = useMemo(() => {
    if (selectedUseCase !== 'Alle') {
      return {
        scopeType: 'useCase' as TransportPreferenceScopeType,
        scopeValue: selectedUseCase,
        label: `use case ${selectedUseCase}`,
      };
    }

    if (selectedRegion !== 'Alle') {
      return {
        scopeType: 'region' as TransportPreferenceScopeType,
        scopeValue: selectedRegion,
        label: `regio ${selectedRegion}`,
      };
    }

    return {
      scopeType: 'region' as TransportPreferenceScopeType,
      scopeValue: 'Wereldwijd',
      label: 'regio Wereldwijd',
    };
  }, [selectedRegion, selectedUseCase]);
  const activeDefaultApp = useMemo(() => {
    const defaultAppId = getDefaultTransportAppId(transportPreferences, activeScope);
    return transportApps.find((app) => app.id === defaultAppId) ?? null;
  }, [activeScope, transportPreferences]);
  const activeDefaultPreference = useMemo(
    () =>
      transportPreferences.find(
        (entry) =>
          entry.kind === 'default' &&
          entry.appId === activeDefaultApp?.id &&
          entry.scopeType === activeScope.scopeType &&
          entry.scopeValue === activeScope.scopeValue
      ) ?? null,
    [activeDefaultApp?.id, activeScope.scopeType, activeScope.scopeValue, transportPreferences]
  );
  const activeFavorites = useMemo(
    () => getTransportPreferenceForScope(transportPreferences, { ...activeScope, kind: 'favorite' }),
    [activeScope, transportPreferences]
  );
  const recentAudit = useMemo(() => transportAudit.slice(0, 8), [transportAudit]);
  const preferenceStats = useMemo(() => {
    const synced = transportPreferences.filter((entry) => entry.syncState === 'synced').length;
    const queued = transportPreferences.filter((entry) => entry.syncState === 'queued').length;
    const local = transportPreferences.filter((entry) => entry.syncState === 'local').length;
    const failed = transportPreferences.filter((entry) => Boolean(entry.syncError)).length;
    const defaults = transportPreferences.filter((entry) => entry.kind === 'default').length;
    const favorites = transportPreferences.filter((entry) => entry.kind === 'favorite').length;
    const latestSyncAt =
      transportPreferences
        .filter((entry) => Boolean(entry.lastSyncAt))
        .sort((left, right) => new Date(right.lastSyncAt ?? '').getTime() - new Date(left.lastSyncAt ?? '').getTime())[0]
        ?.lastSyncAt ?? null;
    const latestErrorEntry =
      transportPreferences
        .filter((entry) => Boolean(entry.syncError))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
    const latestErrorApp = latestErrorEntry
      ? transportApps.find((app) => app.id === latestErrorEntry.appId)?.label ?? latestErrorEntry.appId
      : null;
    return {
      total: transportPreferences.length,
      synced,
      queued,
      local,
      failed,
      defaults,
      favorites,
      latestSyncAt,
      latestErrorApp,
      latestError: latestErrorEntry?.syncError ?? null,
    };
  }, [transportPreferences]);
  const queuedPreferences = useMemo(
    () => transportPreferences.filter((entry) => entry.syncState === 'queued').slice(0, 6),
    [transportPreferences]
  );
  const recentPreferences = useMemo(() => transportPreferences.slice(0, 8), [transportPreferences]);
  const filteredPreferences = useMemo(
    () =>
      recentPreferences.filter((entry) => {
        if (preferenceKindFilter !== 'all' && entry.kind !== preferenceKindFilter) return false;
        if (preferenceSyncFilter !== 'all' && entry.syncState !== preferenceSyncFilter) return false;
        return true;
      }),
    [preferenceKindFilter, preferenceSyncFilter, recentPreferences]
  );
  const selectedPreferences = useMemo(
    () => filteredPreferences.filter((entry) => selectedPreferenceIds.includes(entry.id)),
    [filteredPreferences, selectedPreferenceIds]
  );
  const preferenceSyncAnalytics = useMemo(() => {
    const total = transportPreferences.length;
    const lastSevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCreated = transportPreferences.filter((entry) => new Date(entry.createdAt).getTime() >= lastSevenDays).length;
    const recentSynced = transportPreferences.filter((entry) => new Date(entry.lastSyncAt ?? '').getTime() >= lastSevenDays).length;
    const healthScore = total > 0 ? Math.round((preferenceStats.synced / total) * 100) : 0;
    return {
      healthScore,
      retryPool: preferenceStats.queued + preferenceStats.failed,
      failToSyncRatio: total > 0 ? Math.round((preferenceStats.failed / total) * 100) : 0,
      recentCreated,
      recentSynced,
    };
  }, [preferenceStats.failed, preferenceStats.queued, preferenceStats.synced, transportPreferences]);
  const distributionLine = SEED_DISTRIBUTION_LINES[0];
  const distributionQuantityLabel = distributionLine.unit ? `${distributionLine.quantity} ${distributionLine.unit}` : `${distributionLine.quantity}`;
  const distributionDriverLabel = distributionOrder.assignedDriverMembershipId ?? 'Nog niet toegewezen';
  const distributionCurrentStatusLabel = distributionBusinessImpactConfirmed
    ? 'Bedrijfsbevestiging uitgevoerd'
    : distributionCustomerConfirmed
      ? 'Klant heeft aankomst bevestigd'
      : distributionDeliveryBookedOff
        ? 'Levering afgeboekt door chauffeur'
        : distributionOrder.status === 'arrived'
        ? 'Aangekomen bij klant'
        : getBusinessDistributionStatusLabel(distributionOrder.status);
  const distributionBusinessConfirmLocked = !distributionCustomerConfirmed || distributionBusinessImpactConfirmed;
  const distributionBusinessStockStatusText = distributionBusinessImpactConfirmed
    ? 'Bevestigd'
    : 'Voorraadtrigger klaar voor bevoegde verwerking';
  const distributionBusinessInvoiceStatusText = distributionBusinessImpactConfirmed
    ? 'Bevestigd'
    : 'Facturatietrigger klaar voor invoice-lijn';
  const distributionBusinessMailStatusText = distributionBusinessImpactConfirmed
    ? 'Bevestigd'
    : 'Mailtrigger klaar voor invoice-lijn';
  const distributionBusinessPersonStatusText = distributionBusinessImpactConfirmed ? 'Bevestigd' : 'Nog niet bevestigd';
  const distributionBusinessReportStatusText = distributionBusinessImpactConfirmed
    ? 'Bedrijfsbevestiging uitgevoerd'
    : 'Rapport naar bedrijf';
  const distributionEvidenceLabel =
    distributionOrder.status === 'departure_confirmed' ? 'Bewijs: vereist bij volgende stap' : 'Nog niet toegevoegd';
  const distributionNextStatusLabel = distributionOrder.status === 'departure_confirmed' ? 'Onderweg nog niet gestart' : null;
  const distributionDepartureLocked =
    !distributionOrder.assignedDriverMembershipId || distributionOrder.status !== 'ready_for_departure';
  const distributionTransitLocked = distributionOrder.status !== 'departure_confirmed';
  const distributionTransitTrackTraceVisible = distributionOrder.status === 'in_transit';
  const distributionArrivalLocked = distributionOrder.status !== 'in_transit';
  const distributionArrivalVisible = distributionOrder.status === 'arrived' || distributionCustomerConfirmed;
  const distributionDeliveryBookedOffLocked = distributionOrder.status !== 'arrived' || distributionDeliveryBookedOff || distributionCustomerConfirmed;
  const distributionCustomerConfirmLocked = !distributionDeliveryBookedOff || distributionCustomerConfirmed;

  const assignDistributionDriver = () => {
    const now = new Date().toISOString();
    setDistributionOrder((current) => {
      if (current.assignedDriverMembershipId) return current;
      return {
        ...current,
        assignedDriverMembershipId: 'Chauffeur interne ronde',
        updatedAt: now,
      };
    });
    setDistributionDriverNotice('Chauffeur toegewezen voor vertrek.');
  };
  const confirmDistributionDeparture = () => {
    const now = new Date().toISOString();
    setDistributionOrder((current) => {
      if (!current.assignedDriverMembershipId || current.status !== 'ready_for_departure') {
        return current;
      }

      return {
        ...current,
        status: 'departure_confirmed',
        departedAt: current.departedAt ?? now,
        updatedAt: now,
      };
    });
    setDistributionDepartureNotice('Vertrek bevestigd door bevoegde persoon.');
  };
  const startDistributionTransit = () => {
    const now = new Date().toISOString();
    setDistributionOrder((current) => {
      if (current.status !== 'departure_confirmed') {
        return current;
      }

      return {
        ...current,
        status: 'in_transit',
        updatedAt: now,
      };
    });
    setDistributionTransitLastUpdateLabel('net bevestigd');
    setDistributionTransitNotice('Transport is onderweg.');
    setDistributionTransitUpdateNotice(null);
  };
  const confirmDistributionArrival = () => {
    const now = new Date().toISOString();
    setDistributionOrder((current) => {
      if (current.status !== 'in_transit') {
        return current;
      }

      return {
        ...current,
        status: 'arrived',
        arrivedAt: current.arrivedAt ?? now,
        updatedAt: now,
      };
    });
    setDistributionArrivalNotice('Aankomst bij klant bevestigd.');
  };
  const bookDistributionDeliveryOff = () => {
    if (distributionDeliveryBookedOffLocked) {
      return;
    }
    setDistributionDeliveryBookedOff(true);
    setDistributionDeliveryBookedOffNotice('Chauffeur heeft levering afgeboekt voor klantbevestiging.');
  };
  const confirmDistributionCustomerArrival = () => {
    if (distributionCustomerConfirmLocked) {
      return;
    }
    const now = new Date().toISOString();
    setDistributionCustomerConfirmed(true);
    setDistributionCustomerConfirmationNotice('Klantbevestiging ontvangen.');
    setDistributionReportNotice('Rapport naar bedrijf');
    setDistributionOrder((current) => {
      if (current.status === 'customer_confirmed') {
        return current;
      }

      return {
        ...current,
        status: 'customer_confirmed',
        customerConfirmedAt: current.customerConfirmedAt ?? now,
        updatedAt: now,
      };
    });
  };
  const confirmDistributionBusinessImpact = () => {
    if (distributionBusinessConfirmLocked) {
      return;
    }

    setDistributionBusinessImpactConfirmed(true);
    setDistributionBusinessImpactNotice('Bedrijfsbevestiging uitgevoerd.');
    setDistributionReportNotice('Bedrijfsbevestiging uitgevoerd');
  };
  const updateDistributionTransitStatus = () => {
    if (distributionOrder.status !== 'in_transit') {
      return;
    }
    setDistributionTransitLastUpdateLabel('zojuist bijgewerkt');
    setDistributionTransitUpdateNotice('Onderweg-status bijgewerkt voor bevoegde opvolging.');
  };
  const confirmDistributionReadyForDeparture = () => {
    const now = new Date().toISOString();
    setDistributionOrder((current) => {
      if (current.status !== 'ready_for_departure' && !canTransitionDistributionStatus(current.status, 'ready_for_departure')) {
        return current;
      }

      return {
        ...current,
        status: 'ready_for_departure',
        readyForDepartureAt: current.readyForDepartureAt ?? now,
        updatedAt: now,
      };
    });
    setDistributionNotice(`Bevestigd op ${formatDateTime(now)}. Manager/bevoegde kan dit later opvolgen.`);
  };

  useEffect(() => {
    setSelectedPreferenceIds((current) => current.filter((id) => filteredPreferences.some((entry) => entry.id === id)));
  }, [filteredPreferences]);

  const analytics = useMemo(() => {
    const globalApps = transportApps.filter((item) => item.regions.includes('Wereldwijd')).length;
    const rideApps = filteredTransportApps.filter((item) => item.category === 'Ride').length;
    const logisticsApps = filteredTransportApps.filter((item) => item.category === 'Logistiek').length;
    const deliveryApps = filteredTransportApps.filter((item) => item.category === 'Delivery').length;
    const businessFit = filteredTransportApps.filter((item) => item.useCases.includes('Zakelijk')).length;
    const budgetFit = filteredTransportApps.filter((item) => item.useCases.includes('Budget')).length;

    return [
      { label: 'Top 5', value: String(topTransportApps.length), detail: 'Wereldspelers direct beschikbaar' },
      {
        label: 'In scope',
        value: String(filteredTransportApps.length),
        detail:
          selectedRegion === 'Alle' && selectedUseCase === 'Alle'
            ? 'Alle actieve apps'
            : `${selectedRegion !== 'Alle' ? selectedRegion : 'Alle regio’s'} | ${selectedUseCase !== 'Alle' ? selectedUseCase : 'Alle use cases'}`,
      },
      { label: 'Ride apps', value: String(rideApps), detail: 'Mobiliteit en ritten' },
      { label: 'Delivery/logistiek', value: String(deliveryApps + logisticsApps), detail: 'Last-mile en transport' },
      { label: 'Wereldwijd', value: String(globalApps), detail: 'Apps met brede internationale dekking' },
      { label: 'Budget fit', value: String(budgetFit), detail: 'Budgetgerichte matches' },
      { label: 'Zakelijk fit', value: String(businessFit), detail: 'Partners voor business flows' },
      { label: 'Favorieten', value: String(activeFavorites.length), detail: `Opgeslagen voor ${activeScope.label}` },
    ] as const;
  }, [activeFavorites.length, activeScope.label, filteredTransportApps, selectedRegion, selectedUseCase, topTransportApps.length]);

  useEffect(() => {
    if (!recommendedTransport) return;
    const key = `${recommendedTransport.id}-${activeScope.scopeType}-${activeScope.scopeValue}`;
    if (lastRecommendationKey.current === key) return;
    lastRecommendationKey.current = key;
    logTransportAudit({
      appId: recommendedTransport.id,
      appLabel: recommendedTransport.label,
      action: 'recommended',
      scopeLabel: activeScope.label,
      detail: recommendedTransport.reason,
    }).catch(() => {});
  }, [activeScope.label, activeScope.scopeType, activeScope.scopeValue, recommendedTransport]);

  function openTransportLink(app: TransportApp) {
    logTransportAudit({
      appId: app.id,
      appLabel: app.label,
      action: 'opened',
      scopeLabel: activeScope.label,
      detail:
        typeof params.source === 'string' && params.source.trim()
          ? `Partner geopend vanuit transporthub (${params.source}).`
          : 'Partner geopend vanuit transporthub.',
    }).catch(() => {});
    if (typeof params.auditId === 'string' && params.auditId.trim()) {
      markAiAuditOutcome(params.auditId, {
        kind: 'success',
        label: `${app.label} geopend via transporthub`,
      }).catch(() => {});
    }
    Linking.openURL(app.url).catch(() => {});
  }

  async function copyTransportLink(app: TransportApp) {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(app.url);
        await logTransportAudit({
          appId: app.id,
          appLabel: app.label,
          action: 'copied',
          scopeLabel: activeScope.label,
          detail: 'Transportlink gekopieerd naar clipboard.',
        }).catch(() => {});
        Alert.alert(
          transportAlertT('transport.alert.linkCopied.title'),
          transportAlertT('transport.alert.linkCopied.body', { appLabel: app.label })
        );
        return;
      } catch {
        // fallback below
      }
    }

    try {
      await Share.share({ message: app.url, title: app.label });
      await logTransportAudit({
        appId: app.id,
        appLabel: app.label,
        action: 'copied',
        scopeLabel: activeScope.label,
        detail: 'Transportlink gedeeld vanuit de hub.',
      }).catch(() => {});
    } catch {
      Alert.alert(
        transportAlertT('transport.alert.linkShareFailed.title'),
        transportAlertT('transport.alert.linkShareFailed.body', { appLabel: app.label })
      );
    }
  }

  async function saveAsFavorite(app: TransportApp) {
    await saveTransportPreference({
      appId: app.id,
      scopeType: activeScope.scopeType,
      scopeValue: activeScope.scopeValue,
      kind: 'favorite',
    });
    await logTransportAudit({
      appId: app.id,
      appLabel: app.label,
      action: 'favorite_saved',
      scopeLabel: activeScope.label,
      detail: 'Partner opgeslagen als favoriet.',
    }).catch(() => {});
    Alert.alert(
      transportAlertT('transport.alert.favoriteSaved.title'),
      transportAlertT('transport.alert.favoriteSaved.body', { appLabel: app.label, scopeLabel: activeScope.label })
    );
  }

  async function saveAsDefault(app: TransportApp) {
    await saveTransportPreference({
      appId: app.id,
      scopeType: activeScope.scopeType,
      scopeValue: activeScope.scopeValue,
      kind: 'default',
    });
    await logTransportAudit({
      appId: app.id,
      appLabel: app.label,
      action: 'default_saved',
      scopeLabel: activeScope.label,
      detail: 'Partner opgeslagen als standaard.',
    }).catch(() => {});
    Alert.alert(
      transportAlertT('transport.alert.defaultSaved.title'),
      transportAlertT('transport.alert.defaultSaved.body', { appLabel: app.label, scopeLabel: activeScope.label })
    );
  }

  async function removeDefault(app: TransportApp) {
    await removeTransportPreferenceByMatch({
      appId: app.id,
      scopeType: activeScope.scopeType,
      scopeValue: activeScope.scopeValue,
      kind: 'default',
    });
    await logTransportAudit({
      appId: app.id,
      appLabel: app.label,
      action: 'default_removed',
      scopeLabel: activeScope.label,
      detail: 'Standaardpartner verwijderd.',
    }).catch(() => {});
    Alert.alert(
      transportAlertT('transport.alert.defaultRemoved.title'),
      transportAlertT('transport.alert.defaultRemoved.body', { appLabel: app.label, scopeLabel: activeScope.label })
    );
  }

  async function removeFavorite(preference: TransportPreferenceRecord) {
    const app = transportApps.find((candidate) => candidate.id === preference.appId);
    await removeTransportPreference(preference.id);
    if (app) {
      await logTransportAudit({
        appId: app.id,
        appLabel: app.label,
        action: 'favorite_removed',
        scopeLabel: activeScope.label,
        detail: 'Favoriete partner verwijderd.',
      }).catch(() => {});
      Alert.alert(
        transportAlertT('transport.alert.favoriteRemoved.title'),
        transportAlertT('transport.alert.favoriteRemoved.body', { appLabel: app.label, scopeLabel: activeScope.label })
      );
    }
  }

  async function syncPreferencesNow() {
    const synced = await syncTransportPreferences();
    setTransportPreferences(synced);
    Alert.alert(transportAlertT('transport.alert.sync.title'), transportAlertT('transport.alert.sync.body'));
  }

  async function retryPreferenceSync(id: string) {
    const synced = await syncTransportPreferenceById(id);
    setTransportPreferences(synced);
    Alert.alert(transportAlertT('transport.alert.retryDone.title'), transportAlertT('transport.alert.retryDone.body'));
  }

  async function retryFailedPreferences() {
    const synced = await syncFailedTransportPreferences();
    setTransportPreferences(synced);
    Alert.alert(transportAlertT('transport.alert.retryFailed.title'), transportAlertT('transport.alert.retryFailed.body'));
  }

  async function retrySelectedPreferences() {
    for (const entry of selectedPreferences) {
      await syncTransportPreferenceById(entry.id);
    }
    setSelectedPreferenceIds([]);
    Alert.alert(
      transportAlertT('transport.alert.bulkRetry.title'),
      transportAlertT('transport.alert.bulkRetry.body', { count: selectedPreferences.length })
    );
  }

  async function removeSelectedPreferences() {
    for (const entry of selectedPreferences) {
      await removeTransportPreference(entry.id);
    }
    setSelectedPreferenceIds([]);
    Alert.alert(
      transportAlertT('transport.alert.bulkRemove.title'),
      transportAlertT('transport.alert.bulkRemove.body', { count: selectedPreferences.length })
    );
  }

  async function promoteSelectedPreferencesToDefault() {
    for (const entry of selectedPreferences) {
      await saveTransportPreference({
        appId: entry.appId,
        scopeType: entry.scopeType,
        scopeValue: entry.scopeValue,
        kind: 'default',
      });
      const app = transportApps.find((candidate) => candidate.id === entry.appId);
      if (app) {
        await logTransportAudit({
          appId: app.id,
          appLabel: app.label,
          action: 'default_saved',
          scopeLabel: formatPreferenceScope(entry),
          detail: 'Voorkeur gepromoveerd naar standaard via bulkactie.',
        }).catch(() => {});
      }
    }
    setSelectedPreferenceIds([]);
    Alert.alert(
      transportAlertT('transport.alert.bulkDefault.title'),
      transportAlertT('transport.alert.bulkDefault.body', { count: selectedPreferences.length })
    );
  }

  async function promoteSelectedPreferencesToFavorite() {
    for (const entry of selectedPreferences) {
      await saveTransportPreference({
        appId: entry.appId,
        scopeType: entry.scopeType,
        scopeValue: entry.scopeValue,
        kind: 'favorite',
      });
      const app = transportApps.find((candidate) => candidate.id === entry.appId);
      if (app) {
        await logTransportAudit({
          appId: app.id,
          appLabel: app.label,
          action: 'favorite_saved',
          scopeLabel: formatPreferenceScope(entry),
          detail: 'Voorkeur gepromoveerd naar favoriet via bulkactie.',
        }).catch(() => {});
      }
    }
    setSelectedPreferenceIds([]);
    Alert.alert(
      transportAlertT('transport.alert.bulkFavorite.title'),
      transportAlertT('transport.alert.bulkFavorite.body', { count: selectedPreferences.length })
    );
  }

  function getPartnerMeta(app: TransportApp) {
    return {
      fitLabel: app.useCases.slice(0, 2).join(' | '),
      regionCount: `${app.regions.length} regio's`,
      strength:
        app.useCases.includes('Zakelijk')
          ? 'Sterk in business'
          : app.useCases.includes('Budget')
            ? 'Sterk in budget'
            : app.useCases.includes('Last-mile')
              ? 'Sterk in last-mile'
              : 'Algemene fit',
    };
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="2. Transport"
          subtitle="Chauffeur, vertrek, onderweg en aankomst"
          description="Volg de transportstap in de juiste volgorde: opdracht, chauffeur, vertrek, onderweg, aankomst en rapport."
          badgeLabel="Transport"
          badgeValue={`${topTransportApps.length} routes`}
          badgeText={
            selectedRegion === 'Alle' && selectedUseCase === 'Alle'
              ? 'Eén duidelijk startpunt'
              : `${selectedRegion !== 'Alle' ? selectedRegion : 'Alle regio’s'} | ${selectedUseCase !== 'Alle' ? selectedUseCase : 'Alle use cases'}`
          }
        />

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Transport in één oogopslag"
            subtitle="Zie snel wat de transportlijn en de beste match zijn."
            badge="KPI"
            badgeTone="accent"
          />
          <View style={styles.analyticsRow}>
            {analytics.map((card) => (
              <View key={card.label} style={styles.analyticsCard}>
                <ThemedText style={styles.analyticsLabel}>{card.label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                  {card.value}
                </ThemedText>
                <ThemedText style={styles.analyticsDetail}>{card.detail}</ThemedText>
              </View>
            ))}
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Kies je regio"
            subtitle="Filter op de markt waar je vandaag wilt werken."
            badge="Region"
            badgeTone="info"
          />
          <View style={styles.regionRow}>
            {transportRegions.map((region) => (
              <TazeChip
                key={region}
                label={region}
                active={selectedRegion === region}
                onPress={() => setSelectedRegion(region)}
              />
            ))}
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Kies je context"
            subtitle="Filter op het type transportstap dat je nodig hebt."
            badge="Use case"
            badgeTone="primary"
          />
          <View style={styles.regionRow}>
            {transportUseCases.map((useCase) => (
              <TazeChip
                key={useCase}
                label={useCase}
                active={selectedUseCase === useCase}
                onPress={() => setSelectedUseCase(useCase)}
              />
            ))}
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Aanbevolen route"
            subtitle="De beste keuze op basis van regio en context."
            badge="AI match"
            badgeTone="success"
          />
          {recommendedTransport ? (
            <Pressable
              style={({ pressed }) => [
                styles.recommendationCard,
                {
                  borderColor: recommendedTransport.tone,
                  backgroundColor: recommendedTransport.surface,
                  opacity: pressed ? 0.94 : 1,
                },
              ]}
              onPress={() => openTransportLink(recommendedTransport)}>
              <View style={styles.topHeader}>
                <View style={styles.topCopy}>
                  <ThemedText type="defaultSemiBold">{recommendedTransport.label}</ThemedText>
                  <ThemedText style={styles.topMeta}>
                    {selectedRegion === 'Alle' ? 'Algemene route' : selectedRegion} |{' '}
                    {selectedUseCase === 'Alle' ? 'Algemene context' : selectedUseCase}
                  </ThemedText>
                </View>
                <TazeBadge label="Aanbevolen" tone="success" />
              </View>
              <ThemedText style={styles.topNote}>{recommendedTransport.reason}</ThemedText>
              <View style={styles.topRegions}>
                {recommendedTransport.regions.slice(0, 4).map((region) => (
                  <TazeBadge key={`${recommendedTransport.id}-${region}`} label={region} tone="neutral" />
                ))}
              </View>
              <View style={styles.actionRow}>
                <Pressable style={styles.openButton} onPress={() => openTransportLink(recommendedTransport)}>
                  <ThemedText type="defaultSemiBold" style={styles.openButtonText}>
                    Open {recommendedTransport.label}
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.actionChip} onPress={() => copyTransportLink(recommendedTransport).catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Kopieer link
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.actionChip} onPress={() => saveAsFavorite(recommendedTransport).catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Bewaar favoriet
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.actionChip} onPress={() => saveAsDefault(recommendedTransport).catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Gebruik als vaste route
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          ) : (
            <ThemedText>Er is nog geen match voor deze combinatie van filters.</ThemedText>
          )}
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Klaar voor vertrek"
            subtitle="Eerste zichtbare stap in de transportlijn."
            badge="Distributie"
            badgeTone="warning"
          />
          <View style={styles.distributionCard}>
            <View style={styles.topHeader}>
              <View style={styles.topCopy}>
                <ThemedText type="defaultSemiBold">Opdracht</ThemedText>
                <ThemedText style={styles.topMeta}>{distributionOrder.id}</ThemedText>
              </View>
              <TazeBadge label={distributionCurrentStatusLabel} tone="warning" />
            </View>

            <View style={styles.distributionGrid}>
              <View style={styles.distributionRow}>
                <ThemedText style={styles.distributionLabel}>Product</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                  {distributionLine.productLabel}
                </ThemedText>
              </View>
              <View style={styles.distributionRow}>
                <ThemedText style={styles.distributionLabel}>Aantal</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                  {distributionQuantityLabel}
                </ThemedText>
              </View>
              <View style={styles.distributionRow}>
                <ThemedText style={styles.distributionLabel}>Status</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                  {distributionCurrentStatusLabel}
                </ThemedText>
              </View>
              <View style={styles.distributionRow}>
                <ThemedText style={styles.distributionLabel}>Chauffeur</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                  {distributionDriverLabel}
                </ThemedText>
              </View>
              {!distributionOrder.assignedDriverMembershipId ? (
                <Pressable
                  style={({ pressed }) => [styles.distributionSecondaryButton, { opacity: pressed ? 0.92 : 1 }]}
                  onPress={assignDistributionDriver}>
                  <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                    Wijs chauffeur toe
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={styles.distributionDriverConfirmation}>
                  Chauffeur toegewezen voor vertrek.
                </ThemedText>
              )}
              <View style={styles.distributionRow}>
                <ThemedText style={styles.distributionLabel}>Bewijs</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                  Nog niet vastgelegd
                </ThemedText>
              </View>
              <View style={styles.distributionRow}>
                <ThemedText style={styles.distributionLabel}>Bevestiging</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                  {distributionOrder.readyForDepartureAt ? formatDateTime(distributionOrder.readyForDepartureAt) : 'Nog niet gestart'}
                </ThemedText>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.distributionActionButton, { opacity: pressed ? 0.92 : 1 }]}
              onPress={confirmDistributionReadyForDeparture}>
              <ThemedText type="defaultSemiBold" style={styles.distributionActionButtonText}>
                Bevestig opdracht klaar
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={distributionDepartureLocked}
              style={({ pressed }) => [
                styles.distributionSecondaryButton,
                {
                  opacity: distributionDepartureLocked ? 0.5 : pressed ? 0.92 : 1,
                },
              ]}
              onPress={confirmDistributionDeparture}>
              <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                Zet onderweg
              </ThemedText>
            </Pressable>
            <Pressable
              disabled={distributionTransitLocked}
              style={({ pressed }) => [
                styles.distributionSecondaryButton,
                {
                  opacity: distributionTransitLocked ? 0.5 : pressed ? 0.92 : 1,
                },
              ]}
              onPress={startDistributionTransit}>
              <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                Start onderweg
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.distributionHelper}>
              Volgende stap: bevestig vertrek en werk daarna onderweg en aankomst bij.
            </ThemedText>
            {distributionOrder.status === 'departure_confirmed' ? (
              <>
                <ThemedText style={styles.distributionDriverConfirmation}>
                  Vertrek bevestigd. De transportlijn loopt nu verder naar onderweg en aankomst.
                </ThemedText>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Bewijs</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    {distributionEvidenceLabel}
                  </ThemedText>
                </View>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Volgende stap</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    {distributionNextStatusLabel}
                  </ThemedText>
                </View>
              </>
            ) : null}
            {distributionOrder.status === 'in_transit' ? (
              <>
                <ThemedText style={styles.distributionDriverConfirmation}>Transport is onderweg.</ThemedText>
                <View style={styles.distributionTrackTraceCard}>
                  <ThemedText type="defaultSemiBold" style={styles.distributionTrackTraceTitle}>
                    Chauffeur onderweg
                  </ThemedText>
                  <View style={styles.distributionPostDepartureBlock}>
                    <ThemedText style={styles.distributionLabel}>Chauffeur</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                      Chauffeur interne ronde
                    </ThemedText>
                  </View>
                  <View style={styles.distributionPostDepartureBlock}>
                    <ThemedText style={styles.distributionLabel}>Status</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                      Onderweg
                    </ThemedText>
                  </View>
                  <View style={styles.distributionPostDepartureBlock}>
                    <ThemedText style={styles.distributionLabel}>Laatste update</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                      {distributionTransitLastUpdateLabel}
                    </ThemedText>
                  </View>
                  <View style={styles.distributionPostDepartureBlock}>
                    <ThemedText style={styles.distributionLabel}>Track &amp; trace</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                      Interne opvolging actief
                    </ThemedText>
                  </View>
                  <View style={styles.distributionPostDepartureBlock}>
                    <ThemedText style={styles.distributionLabel}>GPS</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                      Nog niet gekoppeld
                    </ThemedText>
                  </View>
                  <Pressable
                    disabled={!distributionTransitTrackTraceVisible}
                    style={({ pressed }) => [
                      styles.distributionSecondaryButton,
                      {
                        opacity: !distributionTransitTrackTraceVisible ? 0.5 : pressed ? 0.92 : 1,
                      },
                    ]}
                    onPress={updateDistributionTransitStatus}>
                    <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                      Update onderweg-status
                    </ThemedText>
                  </Pressable>
                </View>
                <Pressable
                  disabled={distributionArrivalLocked}
                  style={({ pressed }) => [
                    styles.distributionSecondaryButton,
                    {
                      opacity: distributionArrivalLocked ? 0.5 : pressed ? 0.92 : 1,
                    },
                  ]}
                  onPress={confirmDistributionArrival}>
                  <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                    Bevestig aankomst klant
                  </ThemedText>
                </Pressable>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Volgende stap</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    Wacht op aankomstbevestiging
                  </ThemedText>
                </View>
              </>
            ) : null}
            {distributionArrivalVisible ? (
              <View style={styles.distributionArrivalCard}>
                <ThemedText type="defaultSemiBold" style={styles.distributionTrackTraceTitle}>
                  Aankomst klant
                </ThemedText>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Chauffeur</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    {distributionDriverLabel}
                  </ThemedText>
                </View>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Levering</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    Aangekomen bij klant
                  </ThemedText>
                </View>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Klantbevestiging</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    {distributionCustomerConfirmed ? 'Ontvangen' : 'Wacht op bevestiging'}
                  </ThemedText>
                </View>
                <View style={styles.distributionPostDepartureBlock}>
                  <ThemedText style={styles.distributionLabel}>Bewijs</ThemedText>
                  <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                    Nog niet toegevoegd
                  </ThemedText>
                </View>
                <ThemedText style={styles.distributionConfirmation}>Bewijs bij aankomst: nog niet toegevoegd</ThemedText>
                {!distributionCustomerConfirmed ? (
                  <ThemedText style={styles.distributionConfirmation}>Klantbevestiging en bewijs volgen</ThemedText>
                ) : null}
                <Pressable
                  disabled={distributionDeliveryBookedOffLocked}
                  style={({ pressed }) => [
                    styles.distributionSecondaryButton,
                    {
                      opacity: distributionDeliveryBookedOffLocked ? 0.5 : pressed ? 0.92 : 1,
                    },
                  ]}
                  onPress={bookDistributionDeliveryOff}>
                  <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                    Chauffeur boekt levering af
                  </ThemedText>
                </Pressable>
                {distributionDeliveryBookedOff ? (
                  <>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Status</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        Levering afgeboekt door chauffeur
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Voorraadtrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessStockStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Rapport naar bedrijf</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        Klaar voor bedrijf
                      </ThemedText>
                    </View>
                  </>
                ) : null}
                <Pressable
                  disabled={distributionCustomerConfirmLocked}
                  style={({ pressed }) => [
                    styles.distributionSecondaryButton,
                    {
                      opacity: distributionCustomerConfirmLocked ? 0.5 : pressed ? 0.92 : 1,
                    },
                  ]} 
                  onPress={confirmDistributionCustomerArrival}>
                  <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                    Klant bevestigt aankomst
                  </ThemedText>
                </Pressable>
                {distributionCustomerConfirmed ? (
                  <View style={styles.distributionBusinessCard}>
                    <ThemedText type="defaultSemiBold" style={styles.distributionTrackTraceTitle}>
                      Bedrijfsbevestiging
                    </ThemedText>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Levering</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        Klant bevestigd
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Voorraadtrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessStockStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Facturatietrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessInvoiceStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Mailtrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessMailStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Bevoegde persoon</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessPersonStatusText}
                      </ThemedText>
                    </View>
                    <Pressable
                      disabled={distributionBusinessConfirmLocked}
                      style={({ pressed }) => [
                        styles.distributionSecondaryButton,
                        {
                          opacity: distributionBusinessConfirmLocked ? 0.5 : pressed ? 0.92 : 1,
                        },
                      ]}
                      onPress={confirmDistributionBusinessImpact}>
                      <ThemedText type="defaultSemiBold" style={styles.distributionSecondaryButtonText}>
                        Bevestig bedrijfsimpact
                      </ThemedText>
                    </Pressable>
                    {distributionBusinessImpactConfirmed ? (
                      <>
                        <View style={styles.distributionPostDepartureBlock}>
                          <ThemedText style={styles.distributionLabel}>Status</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                            Bedrijfsbevestiging uitgevoerd
                          </ThemedText>
                        </View>
                        <View style={styles.distributionPostDepartureBlock}>
                          <ThemedText style={styles.distributionLabel}>Voorraadtrigger</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                            Bevestigd
                          </ThemedText>
                        </View>
                        <View style={styles.distributionPostDepartureBlock}>
                          <ThemedText style={styles.distributionLabel}>Facturatietrigger</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                            Bevestigd
                          </ThemedText>
                        </View>
                        <View style={styles.distributionPostDepartureBlock}>
                          <ThemedText style={styles.distributionLabel}>Mailtrigger</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                            Bevestigd
                          </ThemedText>
                        </View>
                        <View style={styles.distributionPostDepartureBlock}>
                          <ThemedText style={styles.distributionLabel}>Rapport</ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                            {distributionBusinessReportStatusText}
                          </ThemedText>
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}
                {distributionCustomerConfirmed ? (
                  <View style={styles.distributionReportCard}>
                    <ThemedText type="defaultSemiBold" style={styles.distributionTrackTraceTitle}>
                      Rapport naar bedrijf
                    </ThemedText>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Orderreferentie</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionOrder.id}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Chauffeuractie</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        Levering afgeboekt door chauffeur
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Klantbevestiging</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        Ontvangen
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Bedrijfsbevestiging</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessPersonStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Status</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionCurrentStatusLabel}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Voorraadtrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessStockStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Facturatietrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessInvoiceStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Mailtrigger</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessMailStatusText}
                      </ThemedText>
                    </View>
                    <View style={styles.distributionPostDepartureBlock}>
                      <ThemedText style={styles.distributionLabel}>Rapport</ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.distributionValue}>
                        {distributionBusinessReportStatusText}
                      </ThemedText>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
            {distributionDriverNotice ? <ThemedText style={styles.distributionDriverConfirmation}>{distributionDriverNotice}</ThemedText> : null}
            {distributionNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionNotice}</ThemedText> : null}
            {distributionDepartureNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionDepartureNotice}</ThemedText> : null}
            {distributionTransitNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionTransitNotice}</ThemedText> : null}
            {distributionTransitUpdateNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionTransitUpdateNotice}</ThemedText> : null}
            {distributionArrivalNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionArrivalNotice}</ThemedText> : null}
            {distributionDeliveryBookedOffNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionDeliveryBookedOffNotice}</ThemedText> : null}
            {distributionCustomerConfirmationNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionCustomerConfirmationNotice}</ThemedText> : null}
            {distributionBusinessImpactNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionBusinessImpactNotice}</ThemedText> : null}
            {distributionReportNotice ? <ThemedText style={styles.distributionConfirmation}>{distributionReportNotice}</ThemedText> : null}
          </View>
        </TazeCard>

        {spotlightPartner ? (
          <TazeCard style={[styles.section, styles.spotlightCard]}>
            <TazeSectionHeader
              title="Voorgeselecteerde partner"
              subtitle={
                typeof params.source === 'string' && params.source.trim()
                  ? `Binnengekomen vanuit ${params.source}.`
                  : 'Deze partner is vooraf geselecteerd via een deeplink.'
              }
              badge="Deep link"
              badgeTone="success"
            />
              <View style={styles.preferenceHeader}>
              <View style={styles.topCopy}>
                <ThemedText type="defaultSemiBold">{spotlightPartner.label}</ThemedText>
                <ThemedText style={styles.topMeta}>{spotlightPartner.category}</ThemedText>
              </View>
              <TazeBadge label="Voorgeselecteerd" tone="success" />
            </View>
            <ThemedText style={styles.topNote}>{spotlightPartner.detail}</ThemedText>
            <View style={styles.topRegions}>
              {spotlightPartner.regions.slice(0, 4).map((region) => (
                <TazeBadge key={`${spotlightPartner.id}-spotlight-${region}`} label={region} tone="neutral" />
              ))}
            </View>
            <View style={styles.actionRow}>
              <Pressable style={styles.openButton} onPress={() => openTransportLink(spotlightPartner)}>
                <ThemedText type="defaultSemiBold" style={styles.openButtonText}>
                  Open {spotlightPartner.label}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.actionChip} onPress={() => copyTransportLink(spotlightPartner).catch(() => {})}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Kopieer link
                </ThemedText>
              </Pressable>
            </View>
          </TazeCard>
        ) : null}

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Voorkeurenbeheer"
            subtitle="Beheer favorieten, standaarden en syncstatus centraal."
            badge="Sync"
            badgeTone="warning"
          />
          <View style={styles.analyticsRow}>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Totaal</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.total}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Alle bewaarde voorkeuren</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Synced</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.synced}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Backend bevestigd</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Wachtrij</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.queued}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Opnieuw syncen nodig</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Lokale only</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.local}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Nog zonder backendkoppeling</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Standaarden</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.defaults}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Vaste scopekeuzes</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Laatste sync</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.latestSyncAt ? formatDateTime(preferenceStats.latestSyncAt) : 'Nog geen sync'}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Recentste backendbevestiging</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Laatste fout</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceStats.failed > 0 ? `${preferenceStats.failed} fout(en)` : 'Geen'}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>
                {preferenceStats.latestErrorApp
                  ? `${preferenceStats.latestErrorApp}: ${preferenceStats.latestError ?? 'Onbekende fout'}`
                  : 'Geen recente syncfouten'}
              </ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Health</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceSyncAnalytics.healthScore}%
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Aandeel synced voorkeuren</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Retry pool</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceSyncAnalytics.retryPool}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Wachtrij + foutgevallen</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Nieuw 7d</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceSyncAnalytics.recentCreated}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Recent opgeslagen voorkeuren</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Synced 7d</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceSyncAnalytics.recentSynced}
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Recent bevestigd door backend</ThemedText>
            </View>
            <View style={styles.analyticsCard}>
              <ThemedText style={styles.analyticsLabel}>Fail-to-sync</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
                {preferenceSyncAnalytics.failToSyncRatio}%
              </ThemedText>
              <ThemedText style={styles.analyticsDetail}>Fouten als aandeel van totaal</ThemedText>
            </View>
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.actionChip} onPress={() => syncPreferencesNow().catch(() => {})}>
              <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                Sync voorkeuren
              </ThemedText>
            </Pressable>
            {preferenceStats.failed > 0 ? (
              <Pressable style={styles.actionChip} onPress={() => retryFailedPreferences().catch(() => {})}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  {transportAlertT('transport.alert.retryFailed.title')}
                </ThemedText>
              </Pressable>
            ) : null}
            {queuedPreferences.length > 0 ? (
              <Pressable style={styles.actionChip} onPress={() => syncPreferencesNow().catch(() => {})}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Retry wachtrij
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.regionRow}>
            {[
              { label: 'Alles', value: 'all' as const },
              { label: 'Favoriet', value: 'favorite' as const },
              { label: 'Standaard', value: 'default' as const },
            ].map((option) => (
              <TazeChip
                key={`pref-kind-${option.value}`}
                label={option.label}
                active={preferenceKindFilter === option.value}
                onPress={() => setPreferenceKindFilter(option.value)}
              />
            ))}
          </View>
          <View style={styles.regionRow}>
            {[
              { label: 'Alle sync', value: 'all' as const },
              { label: 'Lokaal', value: 'local' as const },
              { label: 'Wachtrij', value: 'queued' as const },
              { label: 'Synced', value: 'synced' as const },
            ].map((option) => (
              <TazeChip
                key={`pref-sync-${option.value}`}
                label={option.label}
                active={preferenceSyncFilter === option.value}
                onPress={() => setPreferenceSyncFilter(option.value)}
              />
            ))}
          </View>
          {filteredPreferences.length > 0 ? (
            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer alles
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.filter((entry) => Boolean(entry.syncError)).map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer fouten
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.filter((entry) => entry.syncState === 'queued').map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer wachtrij
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() =>
                  setSelectedPreferenceIds(
                    filteredPreferences
                      .filter((entry) => entry.syncState === 'queued' || Boolean(entry.syncError))
                      .map((entry) => entry.id)
                  )
                }>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer retry pool
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.filter((entry) => entry.syncState === 'local').map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer lokaal
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.filter((entry) => entry.syncState === 'synced').map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer synced
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.filter((entry) => entry.kind === 'favorite').map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer favorieten
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.actionChip}
                onPress={() => setSelectedPreferenceIds(filteredPreferences.filter((entry) => entry.kind === 'default').map((entry) => entry.id))}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Selecteer standaarden
                </ThemedText>
              </Pressable>
              {selectedPreferenceIds.length > 0 ? (
                <Pressable style={styles.actionChip} onPress={() => setSelectedPreferenceIds([])}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Deselecteer
                  </ThemedText>
                </Pressable>
              ) : null}
              {selectedPreferences.length > 0 ? <TazeBadge label={`${selectedPreferences.length} geselecteerd`} tone="accent" /> : null}
              {selectedPreferences.length > 0 ? (
                <Pressable style={styles.actionChip} onPress={() => retrySelectedPreferences().catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Retry selectie
                  </ThemedText>
                </Pressable>
              ) : null}
              {selectedPreferences.length > 0 ? (
                <Pressable style={styles.actionChip} onPress={() => promoteSelectedPreferencesToFavorite().catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Maak favoriet
                  </ThemedText>
                </Pressable>
              ) : null}
              {selectedPreferences.length > 0 ? (
                <Pressable style={styles.actionChip} onPress={() => promoteSelectedPreferencesToDefault().catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Maak standaard
                  </ThemedText>
                </Pressable>
              ) : null}
              {selectedPreferences.length > 0 ? (
                <Pressable style={styles.actionChip} onPress={() => removeSelectedPreferences().catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                    Verwijder selectie
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {filteredPreferences.length > 0 ? (
            <View style={styles.preferenceList}>
              {filteredPreferences.map((entry) => {
                const app = transportApps.find((candidate) => candidate.id === entry.appId);
                if (!app) return null;
                const syncMeta = getTransportPreferenceSyncMeta(entry.syncState);
                const selected = selectedPreferenceIds.includes(entry.id);
                return (
                  <View key={entry.id} style={styles.preferenceCard}>
                    <View style={styles.preferenceHeader}>
                      <View style={styles.topCopy}>
                        <ThemedText type="defaultSemiBold">{app.label}</ThemedText>
                        <ThemedText style={styles.analyticsDetail}>
                          {formatPreferenceScope(entry)} | {entry.kind === 'default' ? 'Standaard' : 'Favoriet'}
                        </ThemedText>
                      </View>
                      <View style={styles.preferenceRow}>
                        {selected ? <TazeBadge label="Geselecteerd" tone="accent" /> : null}
                        <TazeBadge label={syncMeta.label} tone={syncMeta.tone} />
                      </View>
                    </View>
                    {entry.syncError ? <ThemedText style={styles.analyticsDetail}>{entry.syncError}</ThemedText> : null}
                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.actionChip}
                        onPress={() =>
                          setSelectedPreferenceIds((current) =>
                            current.includes(entry.id) ? current.filter((value) => value !== entry.id) : [...current, entry.id]
                          )
                        }>
                        <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                          {selected ? 'Deselecteer' : 'Selecteer'}
                        </ThemedText>
                      </Pressable>
                      <Pressable style={styles.actionChip} onPress={() => openTransportLink(app)}>
                        <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                          Open partner
                        </ThemedText>
                      </Pressable>
                      {entry.syncState !== 'synced' ? (
                        <Pressable style={styles.actionChip} onPress={() => retryPreferenceSync(entry.id).catch(() => {})}>
                          <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                            Retry sync
                          </ThemedText>
                        </Pressable>
                      ) : null}
                      <Pressable style={styles.actionChip} onPress={() => removeTransportPreference(entry.id).catch(() => {})}>
                        <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                          Verwijder
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <ThemedText style={styles.analyticsDetail}>Geen voorkeuren voor de actieve filters.</ThemedText>
          )}
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Voorkeuren voor deze scope"
            subtitle={`Actieve voorkeuren voor ${activeScope.label}.`}
            badge="Prefs"
            badgeTone="accent"
          />
          {activeDefaultApp ? (
            <View style={styles.preferenceCard}>
              <View style={styles.preferenceHeader}>
                <ThemedText type="defaultSemiBold">Standaardpartner</ThemedText>
                <TazeBadge label={activeDefaultApp.label} tone="success" />
              </View>
              <View style={styles.preferenceHeader}>
                <ThemedText style={styles.analyticsDetail}>{activeScope.label}</ThemedText>
                <TazeBadge
                  label={getTransportPreferenceSyncMeta(activeDefaultPreference?.syncState ?? 'local').label}
                  tone={getTransportPreferenceSyncMeta(activeDefaultPreference?.syncState ?? 'local').tone}
                />
              </View>
              <ThemedText style={styles.analyticsDetail}>{activeDefaultApp.detail}</ThemedText>
              <Pressable style={styles.actionChip} onPress={() => removeDefault(activeDefaultApp).catch(() => {})}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Verwijder standaard
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText style={styles.analyticsDetail}>Nog geen standaardpartner ingesteld voor deze scope.</ThemedText>
          )}
          {activeFavorites.length > 0 ? (
            <View style={styles.preferenceList}>
              {activeFavorites.map((entry) => {
                const app = transportApps.find((candidate) => candidate.id === entry.appId);
                if (!app) return null;
                return (
                  <View key={entry.id} style={styles.preferenceRow}>
                    <TazeBadge label={app.label} tone="neutral" />
                    <Pressable style={styles.actionChip} onPress={() => removeFavorite(entry).catch(() => {})}>
                      <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                        Verwijder favoriet
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : (
            <ThemedText style={styles.analyticsDetail}>Nog geen favorieten bewaard voor deze scope.</ThemedText>
          )}
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Transportaudit"
            subtitle="Recente aanbevelingen en partneracties in deze hub."
            badge={`Log ${recentAudit.length}`}
            badgeTone="warning"
          />
          {recentAudit.length > 0 ? (
            <View style={styles.auditList}>
              {recentAudit.map((entry) => (
                <View key={entry.id} style={styles.auditCard}>
                  <View style={styles.preferenceHeader}>
                    <ThemedText type="defaultSemiBold">{entry.appLabel}</ThemedText>
                    <TazeBadge label={entry.action.replace('_', ' ')} tone="info" />
                  </View>
                  <ThemedText style={styles.analyticsDetail}>{entry.scopeLabel}</ThemedText>
                  <ThemedText style={styles.topNote}>{entry.detail}</ThemedText>
                  <ThemedText style={styles.analyticsDetail}>
                    {new Date(entry.createdAt).toLocaleString('nl-BE')}
                  </ThemedText>
                </View>
              ))}
              <Pressable style={styles.actionChip} onPress={() => clearTransportAudit().catch(() => {})}>
                <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                  Wis transportaudit
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <ThemedText style={styles.analyticsDetail}>Nog geen transportacties gelogd.</ThemedText>
          )}
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Top 5 mondiaal"
            subtitle="De sterkste globale spelers voor vervoer en mobiliteit."
            badge="Global"
            badgeTone="warning"
          />
          <View style={styles.topGrid}>
            {topTransportApps.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.topCard,
                  { borderColor: item.tone, backgroundColor: item.surface, opacity: pressed ? 0.94 : 1 },
                ]}
                onPress={() => openTransportLink(item)}>
                <View style={styles.topHeader}>
                  <View style={styles.topCopy}>
                    <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
                    <ThemedText style={styles.topMeta}>{item.market}</ThemedText>
                  </View>
                  <TazeBadge label={item.rank} tone="info" />
                </View>
                <ThemedText style={styles.topNote}>{item.note}</ThemedText>
                <View style={styles.topRegions}>
                  {item.regions.slice(0, 3).map((region) => (
                    <TazeBadge key={`${item.id}-${region}`} label={region} tone="neutral" />
                  ))}
                </View>
                <View style={styles.openButton}>
                  <ThemedText type="defaultSemiBold" style={styles.openButtonText}>
                    Open {item.label}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Alle transportapps"
            subtitle={selectedRegion === 'Alle' ? 'Volledige actieve lijst.' : `Gefilterd op ${selectedRegion}.`}
            badge={`Apps ${filteredTransportApps.length}`}
            badgeTone="primary"
          />
          <View style={styles.listGrid}>
            {orderedTransportApps.map((app) => (
              <Pressable
                key={app.id}
                style={({ pressed }) => [
                  styles.listCard,
                  spotlightPartner?.id === app.id ? styles.listCardSpotlight : null,
                  { borderColor: app.tone, backgroundColor: app.surface, opacity: pressed ? 0.94 : 1 },
                ]}
                onPress={() => openTransportLink(app)}>
                <View style={styles.listHeader}>
                  <View style={styles.topCopy}>
                    <ThemedText type="defaultSemiBold">{app.label}</ThemedText>
                    <ThemedText style={styles.topMeta}>{app.category}</ThemedText>
                  </View>
                  <TazeBadge label={app.regions[0] ?? 'Regio'} tone="accent" />
                </View>
                {spotlightPartner?.id === app.id ? <TazeBadge label="Voorgeselecteerd" tone="success" /> : null}
                <ThemedText style={styles.topNote}>{app.detail}</ThemedText>
                <View style={styles.partnerMetaGrid}>
                  <View style={styles.partnerMetaCard}>
                    <ThemedText style={styles.analyticsLabel}>Sterk in</ThemedText>
                    <ThemedText type="defaultSemiBold">{getPartnerMeta(app).strength}</ThemedText>
                  </View>
                  <View style={styles.partnerMetaCard}>
                    <ThemedText style={styles.analyticsLabel}>Use cases</ThemedText>
                    <ThemedText type="defaultSemiBold">{getPartnerMeta(app).fitLabel}</ThemedText>
                  </View>
                  <View style={styles.partnerMetaCard}>
                    <ThemedText style={styles.analyticsLabel}>Dekking</ThemedText>
                    <ThemedText type="defaultSemiBold">{getPartnerMeta(app).regionCount}</ThemedText>
                  </View>
                </View>
                <View style={styles.topRegions}>
                  {app.regions.map((region) => (
                    <TazeBadge key={`${app.id}-${region}`} label={region} tone="neutral" />
                  ))}
                </View>
                <View style={styles.actionRow}>
                  <Pressable style={styles.actionChip} onPress={() => copyTransportLink(app).catch(() => {})}>
                    <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                      Kopieer
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.actionChip} onPress={() => saveAsFavorite(app).catch(() => {})}>
                    <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                      Favoriet
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.actionChip} onPress={() => saveAsDefault(app).catch(() => {})}>
                    <ThemedText type="defaultSemiBold" style={styles.actionChipText}>
                      Standaard
                    </ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            ))}
          </View>
        </TazeCard>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    backgroundColor: Brand.canvas,
  },
  screen: {
    gap: 18,
  },
  section: {
    gap: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsCard: {
    flexGrow: 1,
    flexBasis: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 4,
  },
  analyticsLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  analyticsValue: {
    color: '#0f172a',
    fontSize: 22,
  },
  analyticsDetail: {
    color: '#475569',
    fontSize: 12,
  },
  regionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topGrid: {
    gap: 10,
  },
  recommendationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  distributionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(14,116,144,0.2)',
    backgroundColor: 'rgba(236,254,255,0.94)',
    padding: 16,
    gap: 12,
  },
  distributionGrid: {
    gap: 8,
  },
  distributionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
  },
  distributionLabel: {
    minWidth: 96,
    color: '#0f766e',
    fontSize: 12,
  },
  distributionValue: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 19,
  },
  distributionEmailField: {
    alignSelf: 'stretch',
    width: '100%',
  },
  distributionActionButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  distributionActionButtonText: {
    color: '#ffffff',
    fontSize: 12,
  },
  distributionSecondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.28)',
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  distributionSecondaryButtonText: {
    color: '#0f766e',
    fontSize: 12,
  },
  distributionHelper: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  distributionDriverConfirmation: {
    color: '#0f766e',
    fontSize: 12,
    lineHeight: 18,
  },
  distributionConfirmation: {
    color: '#0f766e',
    fontSize: 12,
    lineHeight: 18,
  },
  distributionPostDepartureBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 8,
  },
  distributionTrackTraceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.18)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: 14,
    gap: 8,
  },
  distributionArrivalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.2)',
    backgroundColor: 'rgba(236,254,255,0.78)',
    padding: 14,
    gap: 8,
  },
  distributionBusinessCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.18)',
    backgroundColor: 'rgba(240,253,250,0.82)',
    padding: 14,
    gap: 8,
  },
  distributionReportCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.16)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 14,
    gap: 8,
  },
  distributionTrackTraceTitle: {
    color: '#0f172a',
    fontSize: 13,
  },
  spotlightCard: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,255,0.92)',
  },
  topCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  topHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topCopy: {
    flex: 1,
    minWidth: 150,
    gap: 2,
  },
  topMeta: {
    color: '#475569',
    fontSize: 12,
  },
  topNote: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  topRegions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  openButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openButtonText: {
    color: '#0f172a',
    fontSize: 12,
  },
  actionChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionChipText: {
    color: '#334155',
    fontSize: 12,
  },
  preferenceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 6,
  },
  preferenceList: {
    gap: 8,
  },
  preferenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  preferenceHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  auditList: {
    gap: 8,
  },
  auditCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 6,
  },
  listGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listCard: {
    flexGrow: 1,
    flexBasis: 250,
    minWidth: 220,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.06)',
  },
  listCardSpotlight: {
    boxShadow: '0px 6px 18px rgba(15, 118, 110, 0.12)',
    elevation: 3,
  },
  partnerMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  partnerMetaCard: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 10,
    gap: 3,
  },
  listHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});

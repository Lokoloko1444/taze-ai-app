import { Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { getCachedAiAuditEntries, loadAiAuditEntries, subscribeAiAudit, type AiAuditEntry } from 'lib/ai-audit';
import {
  clearLegalFocusHistory,
  clearLegalFocusRoute,
  getCachedLegalFocusState,
  loadLegalFocusStore,
  removeLegalFocusHistoryRoute,
  setLegalFocusRoute,
  subscribeLegalFocusState,
  syncLegalFocusHistory,
  type LegalFocusScreen,
} from 'lib/legal-focus-store';
import { LegalConfig } from 'lib/legal-config';

type Props = {
  currentScreen: LegalFocusScreen;
  configured: boolean;
  sessionEmail: string | null;
};

const suiteItems: {
  screen: LegalFocusScreen;
  label: string;
  route: Href;
  publicUrl: string;
  tone: 'info' | 'warning' | 'success';
}[] = [
  {
    screen: 'privacy',
    label: 'Privacy',
    route: LegalConfig.privacyRoute as Href,
    publicUrl: LegalConfig.privacyPolicyUrl,
    tone: 'info',
  },
  {
    screen: 'support',
    label: 'Hulp',
    route: LegalConfig.supportRoute as Href,
    publicUrl: LegalConfig.supportUrl,
    tone: 'warning',
  },
  {
    screen: 'contact',
    label: 'Contact',
    route: LegalConfig.contactRoute as Href,
    publicUrl: LegalConfig.contactUrl,
    tone: 'success',
  },
];

function formatAuditTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Onbekend moment';
  return date.toLocaleString('nl-BE');
}

function escapeCsv(value: string | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatTrendDayLabel(value: Date) {
  return value.toLocaleDateString('nl-BE', { weekday: 'short' }).replace('.', '');
}

function getLegalAuditStatusLabel(entry: AiAuditEntry) {
  if (entry.outcomeKind === 'success') return 'Succesvol uitgevoerd';
  if (entry.outcomeKind === 'failed') return 'Uitvoering mislukt';
  if (entry.interactionKind === 'action_applied') return 'Actie toegepast';
  if (entry.interactionKind === 'route_opened') return 'Route geopend';
  return 'Nog niet toegepast';
}

function buildScreenAuditCsv(entries: AiAuditEntry[]) {
  const header = [
    'Tijdstip',
    'Scherm',
    'Vraag',
    'Titel',
    'Aanbevolen route',
    'Route label',
    'Status',
    'Uitkomst',
  ].join(',');

  const rows = entries.map((entry) =>
    [
      escapeCsv(formatAuditTime(entry.createdAt)),
      escapeCsv(entry.screen),
      escapeCsv(entry.question),
      escapeCsv(entry.title),
      escapeCsv(entry.recommendedRoute),
      escapeCsv(entry.recommendedLabel),
      escapeCsv(getLegalAuditStatusLabel(entry)),
      escapeCsv(entry.outcomeLabel),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

function buildScreenAuditSummary(screenLabel: string, entries: AiAuditEntry[]) {
  const opened = entries.filter((entry) => entry.interactionKind === 'route_opened').length;
  const applied = entries.filter((entry) => entry.interactionKind === 'action_applied').length;
  const succeeded = entries.filter((entry) => entry.outcomeKind === 'success').length;

  return [
    `Taze legal-suite rapport - ${screenLabel}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `Totaal AI-items: ${entries.length}`,
    `Routes geopend: ${opened}`,
    `Acties toegepast: ${applied}`,
    `Succesvolle uitkomsten: ${succeeded}`,
    '',
    ...entries
      .slice(0, 5)
      .map((entry) => `- ${formatAuditTime(entry.createdAt)} | ${entry.title} | ${getLegalAuditStatusLabel(entry)}`),
  ].join('\n');
}

function buildRouteLeaders(entries: AiAuditEntry[]) {
  const byRoute = new Map<
    string,
    {
      label: string;
      route: string;
      count: number;
      opened: number;
      applied: number;
      succeeded: number;
      latestAt: string;
      latestEntryId: string;
      latestEntryQuestion: string;
      latestEntryTitle: string;
      latestStatusLabel: string;
    }
  >();

  entries.forEach((entry) => {
    const key = `${entry.recommendedRoute}::${entry.recommendedLabel}`;
    const existing = byRoute.get(key);
    const safeCreatedAt = new Date(entry.createdAt).getTime();

    if (existing) {
      existing.count += 1;
      if (entry.interactionKind === 'route_opened') existing.opened += 1;
      if (entry.interactionKind === 'action_applied') existing.applied += 1;
      if (entry.outcomeKind === 'success') existing.succeeded += 1;
      if (safeCreatedAt > new Date(existing.latestAt).getTime()) {
        existing.latestAt = entry.createdAt;
        existing.latestEntryId = entry.id;
        existing.latestEntryQuestion = entry.question;
        existing.latestEntryTitle = entry.title;
        existing.latestStatusLabel = getLegalAuditStatusLabel(entry);
      }
      return;
    }

    byRoute.set(key, {
      label: entry.recommendedLabel,
      route: entry.recommendedRoute,
      count: 1,
      opened: entry.interactionKind === 'route_opened' ? 1 : 0,
      applied: entry.interactionKind === 'action_applied' ? 1 : 0,
      succeeded: entry.outcomeKind === 'success' ? 1 : 0,
      latestAt: entry.createdAt,
      latestEntryId: entry.id,
      latestEntryQuestion: entry.question,
      latestEntryTitle: entry.title,
      latestStatusLabel: getLegalAuditStatusLabel(entry),
    });
  });

  return [...byRoute.values()]
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return new Date(right.latestAt).getTime() - new Date(left.latestAt).getTime();
    })
    .slice(0, 3)
    .map((route) => ({
      ...route,
      openRate: Math.round((route.opened / route.count) * 100),
      applyRate: Math.round((route.applied / route.count) * 100),
      successRate: route.applied > 0 ? Math.round((route.succeeded / route.applied) * 100) : 0,
    }));
}

function buildScreenManagementReport(screenLabel: string, entries: AiAuditEntry[]) {
  const opened = entries.filter((entry) => entry.interactionKind === 'route_opened').length;
  const applied = entries.filter((entry) => entry.interactionKind === 'action_applied').length;
  const succeeded = entries.filter((entry) => entry.outcomeKind === 'success').length;
  const failed = entries.filter((entry) => entry.outcomeKind === 'failed').length;
  const routeLeaders = buildRouteLeaders(entries);

  return [
    `Taze legal managementrapport - ${screenLabel}`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    `Totaal AI-items: ${entries.length}`,
    `Routes geopend: ${opened}`,
    `Acties toegepast: ${applied}`,
    `Succesvolle uitkomsten: ${succeeded}`,
    `Mislukte uitkomsten: ${failed}`,
    `Openratio: ${entries.length > 0 ? Math.round((opened / entries.length) * 100) : 0}%`,
    `Toepassingsratio: ${entries.length > 0 ? Math.round((applied / entries.length) * 100) : 0}%`,
    `Succesratio: ${applied > 0 ? Math.round((succeeded / applied) * 100) : 0}%`,
    '',
    'Top routes:',
    ...(routeLeaders.length > 0
      ? routeLeaders.map(
          (route, index) =>
            `${index + 1}. ${route.label} | ${route.route} | ${route.count}x | open ${route.openRate}% | apply ${route.applyRate}% | success ${route.successRate}%`
        )
      : ['Geen route-data beschikbaar.']),
    '',
    'Recente AI-items:',
    ...entries
      .slice(0, 5)
      .map((entry) => `- ${formatAuditTime(entry.createdAt)} | ${entry.title} | ${entry.recommendedLabel} | ${getLegalAuditStatusLabel(entry)}`),
  ].join('\n');
}

function buildRouteAuditSummary(screenLabel: string, routeLabel: string, routePath: string, entries: AiAuditEntry[]) {
  const opened = entries.filter((entry) => entry.interactionKind === 'route_opened').length;
  const applied = entries.filter((entry) => entry.interactionKind === 'action_applied').length;
  const succeeded = entries.filter((entry) => entry.outcomeKind === 'success').length;

  return [
    `Taze legal route-rapport - ${screenLabel}`,
    `Route: ${routeLabel} (${routePath})`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    `AI-items: ${entries.length}`,
    `Openratio: ${entries.length > 0 ? Math.round((opened / entries.length) * 100) : 0}%`,
    `Toepassingsratio: ${entries.length > 0 ? Math.round((applied / entries.length) * 100) : 0}%`,
    `Succesratio: ${applied > 0 ? Math.round((succeeded / applied) * 100) : 0}%`,
    '',
    'Recente items:',
    ...entries
      .slice(0, 5)
      .map((entry) => `- ${formatAuditTime(entry.createdAt)} | ${entry.title} | ${getLegalAuditStatusLabel(entry)}`),
  ].join('\n');
}

function buildRouteAuditCsv(entries: AiAuditEntry[]) {
  const header = [
    'Tijdstip',
    'Scherm',
    'Vraag',
    'Titel',
    'Aanbevolen route',
    'Route label',
    'Status',
    'Uitkomst',
  ].join(',');

  const rows = entries.map((entry) =>
    [
      escapeCsv(formatAuditTime(entry.createdAt)),
      escapeCsv(entry.screen),
      escapeCsv(entry.question),
      escapeCsv(entry.title),
      escapeCsv(entry.recommendedRoute),
      escapeCsv(entry.recommendedLabel),
      escapeCsv(getLegalAuditStatusLabel(entry)),
      escapeCsv(entry.outcomeLabel),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

function buildRouteManagementReport(screenLabel: string, routeLabel: string, routePath: string, entries: AiAuditEntry[]) {
  const opened = entries.filter((entry) => entry.interactionKind === 'route_opened').length;
  const applied = entries.filter((entry) => entry.interactionKind === 'action_applied').length;
  const succeeded = entries.filter((entry) => entry.outcomeKind === 'success').length;
  const failed = entries.filter((entry) => entry.outcomeKind === 'failed').length;

  return [
    `Taze legal route-managementrapport - ${screenLabel}`,
    `Route: ${routeLabel} (${routePath})`,
    `Gegenereerd: ${new Date().toLocaleString('nl-BE')}`,
    '',
    `AI-items: ${entries.length}`,
    `Routes geopend: ${opened}`,
    `Acties toegepast: ${applied}`,
    `Succesvolle uitkomsten: ${succeeded}`,
    `Mislukte uitkomsten: ${failed}`,
    `Openratio: ${entries.length > 0 ? Math.round((opened / entries.length) * 100) : 0}%`,
    `Toepassingsratio: ${entries.length > 0 ? Math.round((applied / entries.length) * 100) : 0}%`,
    `Succesratio: ${applied > 0 ? Math.round((succeeded / applied) * 100) : 0}%`,
    '',
    'Recente items:',
    ...entries
      .slice(0, 5)
      .map((entry) => `- ${formatAuditTime(entry.createdAt)} | ${entry.title} | ${getLegalAuditStatusLabel(entry)}`),
  ].join('\n');
}

function buildSingleAuditSummary(entry: AiAuditEntry) {
  return [
    `Taze legal AI-item - ${entry.screen.toUpperCase()}`,
    `Tijdstip: ${formatAuditTime(entry.createdAt)}`,
    `Titel: ${entry.title}`,
    `Vraag: ${entry.question}`,
    `Antwoord: ${entry.answer}`,
    `Aanbevolen route: ${entry.recommendedLabel} (${entry.recommendedRoute})`,
    `Status: ${getLegalAuditStatusLabel(entry)}`,
    `Uitkomst: ${entry.outcomeLabel ?? 'Nog geen uitkomst gelogd'}`,
  ].join('\n');
}

export function LegalSuitePanel({ currentScreen, configured, sessionEmail }: Props) {
  const router = useRouter();
  const [aiAuditEntries, setAiAuditEntries] = useState<AiAuditEntry[]>(() => getCachedAiAuditEntries());
  const [selectedRouteKey, setSelectedRouteKey] = useState<string | null>(
    () => getCachedLegalFocusState(currentScreen).selectedRouteKey
  );
  const [focusHistoryKeys, setFocusHistoryKeys] = useState<string[]>(
    () => getCachedLegalFocusState(currentScreen).historyKeys
  );
  const currentItem = suiteItems.find((item) => item.screen === currentScreen) ?? suiteItems[0];
  const otherItems = suiteItems.filter((item) => item.screen !== currentScreen);
  const currentAuditEntries = useMemo(
    () => aiAuditEntries.filter((entry) => entry.screen === currentScreen),
    [aiAuditEntries, currentScreen]
  );
  const legalAuditStats = useMemo(() => {
    const entries = aiAuditEntries.filter((entry) =>
      suiteItems.some((item) => item.screen === entry.screen)
    );
    const byScreen = new Map<string, number>();
    entries.forEach((entry) => {
      byScreen.set(entry.screen, (byScreen.get(entry.screen) ?? 0) + 1);
    });
    const topScreen = [...byScreen.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    const currentEntries = entries.filter((entry) => entry.screen === currentScreen);
    const currentOpened = currentEntries.filter((entry) => entry.interactionKind === 'route_opened').length;
    const currentApplied = currentEntries.filter((entry) => entry.interactionKind === 'action_applied').length;
    const currentSucceeded = currentEntries.filter((entry) => entry.outcomeKind === 'success').length;
    return {
      total: entries.length,
      opened: entries.filter((entry) => entry.interactionKind === 'route_opened').length,
      applied: entries.filter((entry) => entry.interactionKind === 'action_applied').length,
      topScreen,
      currentTotal: currentEntries.length,
      currentOpened,
      currentApplied,
      currentSucceeded,
      currentOpenRate: currentEntries.length > 0 ? Math.round((currentOpened / currentEntries.length) * 100) : 0,
      currentApplyRate: currentEntries.length > 0 ? Math.round((currentApplied / currentEntries.length) * 100) : 0,
      currentSuccessRate: currentApplied > 0 ? Math.round((currentSucceeded / currentApplied) * 100) : 0,
    };
  }, [aiAuditEntries, currentScreen]);
  const currentRouteLeaders = useMemo(() => buildRouteLeaders(currentAuditEntries), [currentAuditEntries]);
  const activeRouteFocus = useMemo(
    () =>
      selectedRouteKey
        ? currentRouteLeaders.find((route) => `${route.label}::${route.route}` === selectedRouteKey) ?? null
        : null,
    [currentRouteLeaders, selectedRouteKey]
  );
  const currentRouteFocus = currentRouteLeaders[0] ?? null;
  const displayedRouteFocus = activeRouteFocus ?? currentRouteFocus;
  const focusHistoryRoutes = useMemo(
    () =>
      focusHistoryKeys
        .map((key) => currentRouteLeaders.find((route) => `${route.label}::${route.route}` === key) ?? null)
        .filter((route): route is NonNullable<typeof route> => Boolean(route)),
    [currentRouteLeaders, focusHistoryKeys]
  );
  const activeRouteIndex = useMemo(
    () =>
      activeRouteFocus
        ? currentRouteLeaders.findIndex(
            (route) => route.label === activeRouteFocus.label && route.route === activeRouteFocus.route
          )
        : -1,
    [activeRouteFocus, currentRouteLeaders]
  );
  const previousRouteFocus =
    activeRouteIndex > 0 ? currentRouteLeaders[activeRouteIndex - 1] : null;
  const nextRouteFocus =
    activeRouteIndex >= 0 && activeRouteIndex < currentRouteLeaders.length - 1
      ? currentRouteLeaders[activeRouteIndex + 1]
      : null;
  const activeRoutePositionLabel =
    activeRouteIndex >= 0 ? `${activeRouteIndex + 1}/${currentRouteLeaders.length}` : null;
  const visibleAuditEntries = useMemo(() => {
    if (!activeRouteFocus) return currentAuditEntries;
    return currentAuditEntries.filter(
      (entry) =>
        entry.recommendedLabel === activeRouteFocus.label && entry.recommendedRoute === activeRouteFocus.route
    );
  }, [activeRouteFocus, currentAuditEntries]);
  const recentCurrentEntries = useMemo(() => visibleAuditEntries.slice(0, 2), [visibleAuditEntries]);
  const latestCurrentEntry = recentCurrentEntries[0] ?? null;
  const visibleAuditStats = useMemo(() => {
    const opened = visibleAuditEntries.filter((entry) => entry.interactionKind === 'route_opened').length;
    const applied = visibleAuditEntries.filter((entry) => entry.interactionKind === 'action_applied').length;
    const succeeded = visibleAuditEntries.filter((entry) => entry.outcomeKind === 'success').length;
    return {
      total: visibleAuditEntries.length,
      opened,
      applied,
      succeeded,
      openRate: visibleAuditEntries.length > 0 ? Math.round((opened / visibleAuditEntries.length) * 100) : 0,
      applyRate: visibleAuditEntries.length > 0 ? Math.round((applied / visibleAuditEntries.length) * 100) : 0,
      successRate: applied > 0 ? Math.round((succeeded / applied) * 100) : 0,
    };
  }, [visibleAuditEntries]);
  const focusComparison = useMemo(() => {
    if (!activeRouteFocus) return null;
    return {
      openDelta: visibleAuditStats.openRate - legalAuditStats.currentOpenRate,
      applyDelta: visibleAuditStats.applyRate - legalAuditStats.currentApplyRate,
      successDelta: visibleAuditStats.successRate - legalAuditStats.currentSuccessRate,
    };
  }, [activeRouteFocus, legalAuditStats.currentApplyRate, legalAuditStats.currentOpenRate, legalAuditStats.currentSuccessRate, visibleAuditStats]);
  const focusBenchmarkSummary = useMemo(() => {
    if (!focusComparison) return null;
    const positives = [focusComparison.openDelta, focusComparison.applyDelta, focusComparison.successDelta].filter(
      (value) => value > 0
    ).length;
    const negatives = [focusComparison.openDelta, focusComparison.applyDelta, focusComparison.successDelta].filter(
      (value) => value < 0
    ).length;

    if (positives === 3) return 'Deze route presteert momenteel sterker dan het schermgemiddelde op alle kernratioâ€™s.';
    if (negatives === 3) return 'Deze route presteert momenteel zwakker dan het schermgemiddelde op alle kernratioâ€™s.';
    if (positives > negatives) return 'Deze route ligt momenteel iets boven het schermgemiddelde.';
    if (negatives > positives) return 'Deze route ligt momenteel iets onder het schermgemiddelde.';
    return 'Deze route ligt momenteel ongeveer op het schermgemiddelde.';
  }, [focusComparison]);
  const currentTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        label: formatTrendDayLabel(date),
        total: 0,
        opened: 0,
        applied: 0,
        succeeded: 0,
      };
    });

    const byDay = new Map(days.map((day) => [day.key, day]));
    visibleAuditEntries.forEach((entry) => {
      const createdAt = new Date(entry.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;
      createdAt.setHours(0, 0, 0, 0);
      const bucket = byDay.get(createdAt.toISOString().slice(0, 10));
      if (!bucket) return;
      bucket.total += 1;
      if (entry.interactionKind === 'route_opened') bucket.opened += 1;
      if (entry.interactionKind === 'action_applied') bucket.applied += 1;
      if (entry.outcomeKind === 'success') bucket.succeeded += 1;
    });

    return {
      days,
      maxTotal: Math.max(1, ...days.map((day) => day.total)),
    };
  }, [visibleAuditEntries]);

  const exportCurrentScreenCsv = useCallback(async () => {
    if (currentAuditEntries.length === 0) {
      Alert.alert('Geen legal-data', `Er zijn nog geen AI-items voor ${currentItem.label}.`);
      return;
    }

    const csv = buildScreenAuditCsv(currentAuditEntries);
    if (Platform.OS === 'web') {
      const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      Linking.openURL(uri).catch(() => {
        Alert.alert('CSV export mislukt', 'Gebruik voorlopig het rapport als fallback.');
      });
      return;
    }

    try {
      await Share.share({ message: csv, title: `${currentItem.label.toLowerCase()}-legal-ai.csv` });
    } catch {
      Alert.alert('CSV export mislukt', 'Delen lukte niet op dit toestel.');
    }
  }, [currentAuditEntries, currentItem.label]);

  const shareCurrentScreenSummary = useCallback(async () => {
    if (currentAuditEntries.length === 0) {
      Alert.alert('Geen legal-data', `Er is nog geen legal-suite rapport voor ${currentItem.label}.`);
      return;
    }

    const summary = buildScreenAuditSummary(currentItem.label, currentAuditEntries);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(summary);
        Alert.alert('Gekopieerd', `${currentItem.label}-rapport staat in je clipboard.`);
        return;
      } catch {
        // fall through to share
      }
    }

    try {
      await Share.share({ message: summary, title: `${currentItem.label} legal-suite rapport` });
    } catch {
      Alert.alert('Delen mislukt', 'Het legal-suite rapport kon niet gedeeld worden.');
    }
  }, [currentAuditEntries, currentItem.label]);

  const shareCurrentScreenManagementReport = useCallback(async () => {
    if (currentAuditEntries.length === 0) {
      Alert.alert('Geen legal-data', `Er is nog geen managementrapport voor ${currentItem.label}.`);
      return;
    }

    const report = buildScreenManagementReport(currentItem.label, currentAuditEntries);
    if (Platform.OS === 'web') {
      const uri = `data:text/plain;charset=utf-8,${encodeURIComponent(report)}`;
      Linking.openURL(uri).catch(() => {
        Alert.alert('Rapport export mislukt', 'Gebruik voorlopig de rapportkopie als fallback.');
      });
      return;
    }

    try {
      await Share.share({ message: report, title: `${currentItem.label} managementrapport` });
    } catch {
      Alert.alert('Delen mislukt', 'Het managementrapport kon niet gedeeld worden.');
    }
  }, [currentAuditEntries, currentItem.label]);

  const shareSingleAuditItem = useCallback(async (entry: AiAuditEntry) => {
    const summary = buildSingleAuditSummary(entry);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(summary);
        Alert.alert('Gekopieerd', `${entry.title} staat in je clipboard.`);
        return;
      } catch {
        // fall through to share
      }
    }

    try {
      await Share.share({ message: summary, title: `${currentItem.label} AI-item` });
    } catch {
      Alert.alert('Delen mislukt', 'Het AI-item kon niet gedeeld worden.');
    }
  }, [currentItem.label]);

  const shareRouteSummary = useCallback(
    async (routeLabel: string, routePath: string) => {
      const routeEntries = currentAuditEntries.filter(
        (entry) => entry.recommendedLabel === routeLabel && entry.recommendedRoute === routePath
      );

      if (routeEntries.length === 0) {
        Alert.alert('Geen route-data', `Er zijn nog geen AI-items voor ${routeLabel}.`);
        return;
      }

      const summary = buildRouteAuditSummary(currentItem.label, routeLabel, routePath, routeEntries);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(summary);
          Alert.alert('Gekopieerd', `${routeLabel} staat in je clipboard.`);
          return;
        } catch {
          // fall through to share
        }
      }

      try {
        await Share.share({ message: summary, title: `${currentItem.label} route-rapport` });
      } catch {
        Alert.alert('Delen mislukt', 'Het route-rapport kon niet gedeeld worden.');
      }
    },
    [currentAuditEntries, currentItem.label]
  );

  const shareRouteManagementReport = useCallback(
    async (routeLabel: string, routePath: string) => {
      const routeEntries = currentAuditEntries.filter(
        (entry) => entry.recommendedLabel === routeLabel && entry.recommendedRoute === routePath
      );

      if (routeEntries.length === 0) {
        Alert.alert('Geen route-data', `Er is nog geen managementrapport voor ${routeLabel}.`);
        return;
      }

      const report = buildRouteManagementReport(currentItem.label, routeLabel, routePath, routeEntries);
      if (Platform.OS === 'web') {
        const uri = `data:text/plain;charset=utf-8,${encodeURIComponent(report)}`;
        Linking.openURL(uri).catch(() => {
          Alert.alert('Rapport export mislukt', 'Gebruik voorlopig het route-rapport als fallback.');
        });
        return;
      }

      try {
        await Share.share({ message: report, title: `${routeLabel} managementrapport` });
      } catch {
        Alert.alert('Delen mislukt', 'Het route-managementrapport kon niet gedeeld worden.');
      }
    },
    [currentAuditEntries, currentItem.label]
  );

  const exportRouteCsv = useCallback(
    async (routeLabel: string, routePath: string) => {
      const routeEntries = currentAuditEntries.filter(
        (entry) => entry.recommendedLabel === routeLabel && entry.recommendedRoute === routePath
      );

      if (routeEntries.length === 0) {
        Alert.alert('Geen route-data', `Er zijn nog geen AI-items voor ${routeLabel}.`);
        return;
      }

      const csv = buildRouteAuditCsv(routeEntries);
      if (Platform.OS === 'web') {
        const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
        Linking.openURL(uri).catch(() => {
          Alert.alert('CSV export mislukt', 'Gebruik voorlopig het route-rapport als fallback.');
        });
        return;
      }

      try {
        await Share.share({ message: csv, title: `${routeLabel.toLowerCase()}-legal-route.csv` });
      } catch {
        Alert.alert('CSV export mislukt', 'Route-CSV kon niet gedeeld worden.');
      }
    },
    [currentAuditEntries]
  );

  const exportFocusedRouteCsv = useCallback(async () => {
    if (!activeRouteFocus) return;
    const csv = buildRouteAuditCsv(visibleAuditEntries);
    if (Platform.OS === 'web') {
      const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
      Linking.openURL(uri).catch(() => {
        Alert.alert('CSV export mislukt', 'Gebruik voorlopig het route-rapport als fallback.');
      });
      return;
    }

    try {
      await Share.share({ message: csv, title: `${activeRouteFocus.label.toLowerCase()}-legal-focus.csv` });
    } catch {
      Alert.alert('CSV export mislukt', 'Routefocus-CSV kon niet gedeeld worden.');
    }
  }, [activeRouteFocus, visibleAuditEntries]);

  const shareFocusedRouteSummary = useCallback(async () => {
    if (!activeRouteFocus) return;
    const summary = buildRouteAuditSummary(
      currentItem.label,
      activeRouteFocus.label,
      activeRouteFocus.route,
      visibleAuditEntries
    );
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(summary);
        Alert.alert('Gekopieerd', `${activeRouteFocus.label} routefocus staat in je clipboard.`);
        return;
      } catch {
        // fall through to share
      }
    }

    try {
      await Share.share({ message: summary, title: `${currentItem.label} routefocus-rapport` });
    } catch {
      Alert.alert('Delen mislukt', 'Het routefocus-rapport kon niet gedeeld worden.');
    }
  }, [activeRouteFocus, currentItem.label, visibleAuditEntries]);

  const shareFocusedRouteManagementReport = useCallback(async () => {
    if (!activeRouteFocus) return;
    const report = buildRouteManagementReport(
      currentItem.label,
      activeRouteFocus.label,
      activeRouteFocus.route,
      visibleAuditEntries
    );
    if (Platform.OS === 'web') {
      const uri = `data:text/plain;charset=utf-8,${encodeURIComponent(report)}`;
      Linking.openURL(uri).catch(() => {
        Alert.alert('Rapport export mislukt', 'Gebruik voorlopig het routefocus-rapport als fallback.');
      });
      return;
    }

    try {
      await Share.share({ message: report, title: `${currentItem.label} routefocus-management` });
    } catch {
      Alert.alert('Delen mislukt', 'Het routefocus-managementrapport kon niet gedeeld worden.');
    }
  }, [activeRouteFocus, currentItem.label, visibleAuditEntries]);

  useEffect(() => {
    let cancelled = false;

    loadAiAuditEntries()
      .then((entries) => {
        if (cancelled) return;
        setAiAuditEntries(entries);
      })
      .catch(() => {});

    const unsubscribe = subscribeAiAudit((entries) => {
      if (cancelled) return;
      setAiAuditEntries(entries);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const cachedState = getCachedLegalFocusState(currentScreen);
    setSelectedRouteKey(cachedState.selectedRouteKey);
    setFocusHistoryKeys(cachedState.historyKeys);

    let cancelled = false;

    loadLegalFocusStore()
      .then(() => {
        if (cancelled) return;
        const hydratedState = getCachedLegalFocusState(currentScreen);
        setSelectedRouteKey(hydratedState.selectedRouteKey);
        setFocusHistoryKeys(hydratedState.historyKeys);
      })
      .catch(() => {});

    const unsubscribe = subscribeLegalFocusState(currentScreen, (state) => {
      if (cancelled) return;
      setSelectedRouteKey(state.selectedRouteKey);
      setFocusHistoryKeys(state.historyKeys);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentScreen]);

  useEffect(() => {
    const validKeys = currentRouteLeaders.map((route) => `${route.label}::${route.route}`);
    syncLegalFocusHistory(currentScreen, validKeys).catch(() => {});
  }, [currentRouteLeaders, currentScreen]);

  const activeFocusLabel = activeRouteFocus ? `${activeRouteFocus.label}` : currentItem.label;
  const activeFocusSubtitle = activeRouteFocus
    ? `${activeRouteFocus.label} is actief als routefocus binnen ${currentItem.label.toLowerCase()}. Alle recente items en trends hieronder volgen nu alleen die route.`
    : 'Privacy, support en contact werken hier als een samenhangende flow.';
  const activateRouteFocus = useCallback((routeLabel: string, routePath: string) => {
    const nextKey = `${routeLabel}::${routePath}`;
    setLegalFocusRoute(currentScreen, nextKey).catch(() => {});
  }, [currentScreen]);
  const removeFocusHistoryRoute = useCallback((routeLabel: string, routePath: string) => {
    const targetKey = `${routeLabel}::${routePath}`;
    removeLegalFocusHistoryRoute(currentScreen, targetKey).catch(() => {});
  }, [currentScreen]);
  const clearFocusHistory = useCallback(() => {
    clearLegalFocusHistory(currentScreen).catch(() => {});
  }, [currentScreen]);

  return (
    <TazeCard variant="muted">
      <TazeSectionHeader
        title="Taze legal suite"
        subtitle={activeFocusSubtitle}
        badge={currentItem.label}
        badgeTone={currentItem.tone}
      />

      <View style={styles.badges}>
        <TazeBadge label={currentItem.label} tone={currentItem.tone} />
        <TazeBadge label={configured ? 'Cloud klaar' : 'Lokaal'} tone={configured ? 'success' : 'warning'} />
        <TazeBadge label={sessionEmail ? 'Sessie actief' : 'Publiek bereikbaar'} tone={sessionEmail ? 'accent' : 'neutral'} />
        {activeRouteFocus ? <TazeBadge label={`Focus: ${activeRouteFocus.label}`} tone="accent" /> : null}
      </View>

      <View style={styles.metaCard}>
        <ThemedText type="defaultSemiBold">{LegalConfig.supportEmail}</ThemedText>
        <ThemedText style={styles.metaText}>
          {sessionEmail
            ? `Actieve sessie: ${sessionEmail}`
            : 'Geen actieve sessie. Deze routes blijven wel publiek en direct bereikbaar.'}
        </ThemedText>
      </View>

      <View style={styles.analyticsRow}>
        <View style={styles.analyticsCard}>
          <ThemedText style={styles.analyticsLabel}>Legal AI</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>{legalAuditStats.total}</ThemedText>
          <ThemedText style={styles.metaText}>
            Topscherm: {legalAuditStats.topScreen ? legalAuditStats.topScreen.toUpperCase() : 'Nog leeg'}
          </ThemedText>
        </View>
        <View style={styles.analyticsCard}>
          <ThemedText style={styles.analyticsLabel}>{activeRouteFocus ? 'Routefocus' : currentItem.label}</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
            {activeRouteFocus ? visibleAuditStats.total : legalAuditStats.currentTotal}
          </ThemedText>
          <ThemedText style={styles.metaText}>
            {activeRouteFocus ? 'AI-items voor deze legal-route' : 'AI-items voor dit scherm'}
          </ThemedText>
        </View>
        <View style={styles.analyticsCard}>
          <ThemedText style={styles.analyticsLabel}>Routes / acties</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
            {activeRouteFocus ? visibleAuditStats.opened : legalAuditStats.opened} / {activeRouteFocus ? visibleAuditStats.applied : legalAuditStats.applied}
          </ThemedText>
          <ThemedText style={styles.metaText}>
            {activeRouteFocus ? 'Voor de actieve routefocus' : 'Geopend tegenover toegepast'}
          </ThemedText>
        </View>
        <View style={styles.analyticsCard}>
          <ThemedText style={styles.analyticsLabel}>{activeRouteFocus ? 'Focusscore' : 'Schermscore'}</ThemedText>
          <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
            {activeRouteFocus ? visibleAuditStats.successRate : legalAuditStats.currentSuccessRate}%
          </ThemedText>
          <ThemedText style={styles.metaText}>
            Open {activeRouteFocus ? visibleAuditStats.openRate : legalAuditStats.currentOpenRate}% | Apply {activeRouteFocus ? visibleAuditStats.applyRate : legalAuditStats.currentApplyRate}% | Succes {activeRouteFocus ? visibleAuditStats.succeeded : legalAuditStats.currentSucceeded}
          </ThemedText>
        </View>
      </View>

      {displayedRouteFocus ? (
        <View style={styles.analyticsRow}>
          <View style={styles.analyticsCard}>
            <ThemedText style={styles.analyticsLabel}>{activeRouteFocus ? 'Actieve route' : 'Top route'}</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.routeValue}>{displayedRouteFocus.label}</ThemedText>
            <ThemedText style={styles.metaText}>
              {displayedRouteFocus.count}x geadviseerd Â· laatst {formatAuditTime(displayedRouteFocus.latestAt)}
            </ThemedText>
            <ThemedText style={styles.metaText}>{displayedRouteFocus.route}</ThemedText>
            <View style={styles.recentMetaRow}>
              <TazeBadge label={displayedRouteFocus.latestStatusLabel} tone="accent" />
            </View>
            <View style={styles.routeActions}>
              <TazeButton
                label={activeRouteFocus ? 'Open actieve route' : 'Open top route'}
                icon="arrow-forward"
                variant="secondary"
                onPress={() => router.push(displayedRouteFocus.route as Href)}
              />
              <TazeButton
                label={activeRouteFocus ? 'Open focusdetail' : 'Laatste route-detail'}
                icon="bolt"
                variant="ghost"
                onPress={() =>
                  router.push(
                    (`/audit?screen=${currentScreen}&entryId=${displayedRouteFocus.latestEntryId}`) as Href
                  )
                }
              />
              <TazeButton
                label="Route audit"
                icon="insights"
                variant="ghost"
                onPress={() =>
                  router.push(
                    (`/audit?screen=${currentScreen}&search=${encodeURIComponent(displayedRouteFocus.label)}`) as Href
                  )
                }
              />
              <TazeButton
                label="Deel route"
                icon="content-copy"
                variant="ghost"
                onPress={() => shareRouteSummary(displayedRouteFocus.label, displayedRouteFocus.route).catch(() => {})}
              />
              <TazeButton
                label="CSV route"
                icon="download"
                variant="ghost"
                onPress={() => exportRouteCsv(displayedRouteFocus.label, displayedRouteFocus.route).catch(() => {})}
              />
              <TazeButton
                label="Management route"
                icon="description"
                variant="ghost"
                onPress={() =>
                  shareRouteManagementReport(displayedRouteFocus.label, displayedRouteFocus.route).catch(() => {})
                }
              />
              <TazeButton
                label="Replay route"
                icon="refresh"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/helpdesk',
                    params: { prefill: displayedRouteFocus.latestEntryQuestion },
                  })
                }
              />
              <TazeButton
                label={
                  activeRouteFocus?.label === displayedRouteFocus.label && activeRouteFocus?.route === displayedRouteFocus.route
                    ? 'Route actief'
                    : 'Focus route'
                }
                icon="filter-alt"
                variant={
                  activeRouteFocus?.label === displayedRouteFocus.label && activeRouteFocus?.route === displayedRouteFocus.route
                    ? 'secondary'
                    : 'ghost'
                }
                onPress={() => activateRouteFocus(displayedRouteFocus.label, displayedRouteFocus.route)}
              />
            </View>
          </View>
          <View style={styles.analyticsCard}>
            <ThemedText style={styles.analyticsLabel}>{activeRouteFocus ? 'Focusflow' : 'Routeflow'}</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.analyticsValue}>
              {displayedRouteFocus.successRate}%
            </ThemedText>
            <ThemedText style={styles.metaText}>
              Open {displayedRouteFocus.openRate}% | Apply {displayedRouteFocus.applyRate}% | Success {displayedRouteFocus.succeeded}
            </ThemedText>
            <ThemedText style={styles.metaText}>
              Laatste AI-item: {displayedRouteFocus.latestEntryTitle}
            </ThemedText>
            <View style={styles.routeActions}>
              <TazeButton
                label={activeRouteFocus ? 'Replay focusroute' : 'Replay laatste route'}
                icon="refresh"
                variant="ghost"
                onPress={() =>
                  router.push({
                    pathname: '/helpdesk',
                    params: { prefill: displayedRouteFocus.latestEntryQuestion },
                  })
                }
              />
            </View>
          </View>
        </View>
      ) : null}

      {currentRouteLeaders.length > 1 ? (
        <View style={styles.routeLeaderPanel}>
          <ThemedText type="defaultSemiBold">Routeleaderboard</ThemedText>
          <ThemedText style={styles.metaText}>
            Meest geadviseerde routes voor {currentItem.label.toLowerCase()} op dit scherm.
          </ThemedText>
          <View style={styles.routeLeaderList}>
            {currentRouteLeaders.map((routeLeader, index) => (
              <View key={`${routeLeader.route}-${routeLeader.label}`} style={styles.routeLeaderCard}>
                <View style={styles.recentHeader}>
                  <TazeBadge label={`#${index + 1}`} tone={currentItem.tone} />
                  <ThemedText style={styles.metaText}>{routeLeader.count}x geadviseerd</ThemedText>
                </View>
                <ThemedText type="defaultSemiBold">{routeLeader.label}</ThemedText>
                <ThemedText style={styles.statusText}>{routeLeader.route}</ThemedText>
                <View style={styles.recentMetaRow}>
                  <TazeBadge label={routeLeader.latestStatusLabel} tone="accent" />
                  <TazeBadge label={formatAuditTime(routeLeader.latestAt)} tone="neutral" />
                </View>
                <ThemedText style={styles.metaText}>
                  Open {routeLeader.openRate}% | Apply {routeLeader.applyRate}% | Success {routeLeader.successRate}%
                </ThemedText>
                <ThemedText style={styles.metaText}>
                  Laatste AI-item: {routeLeader.latestEntryTitle}
                </ThemedText>
                <View style={styles.routeActions}>
                  <TazeButton
                    label="Open route"
                    icon="arrow-forward"
                    variant="secondary"
                    onPress={() => router.push(routeLeader.route as Href)}
                  />
                  <TazeButton
                    label="Open detail"
                    icon="bolt"
                    variant="ghost"
                    onPress={() =>
                      router.push((`/audit?screen=${currentScreen}&entryId=${routeLeader.latestEntryId}`) as Href)
                    }
                  />
                  <TazeButton
                    label="Route audit"
                    icon="insights"
                    variant="ghost"
                    onPress={() =>
                      router.push(
                        (`/audit?screen=${currentScreen}&search=${encodeURIComponent(routeLeader.label)}`) as Href
                      )
                    }
                  />
                  <TazeButton
                    label="Deel route"
                    icon="content-copy"
                    variant="ghost"
                    onPress={() => shareRouteSummary(routeLeader.label, routeLeader.route).catch(() => {})}
                  />
                  <TazeButton
                    label="CSV route"
                    icon="download"
                    variant="ghost"
                    onPress={() => exportRouteCsv(routeLeader.label, routeLeader.route).catch(() => {})}
                  />
                  <TazeButton
                    label="Management route"
                    icon="description"
                    variant="ghost"
                    onPress={() => shareRouteManagementReport(routeLeader.label, routeLeader.route).catch(() => {})}
                  />
                  <TazeButton
                    label="Replay route"
                    icon="refresh"
                    variant="ghost"
                    onPress={() =>
                      router.push({
                        pathname: '/helpdesk',
                        params: { prefill: routeLeader.latestEntryQuestion },
                      })
                    }
                  />
                  <TazeButton
                    label={activeRouteFocus?.label === routeLeader.label && activeRouteFocus?.route === routeLeader.route ? 'Route actief' : 'Focus route'}
                    icon="filter-alt"
                    variant={activeRouteFocus?.label === routeLeader.label && activeRouteFocus?.route === routeLeader.route ? 'secondary' : 'ghost'}
                    onPress={() => activateRouteFocus(routeLeader.label, routeLeader.route)}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {activeRouteFocus ? (
        <View style={styles.focusPanel}>
          <View style={styles.focusHeader}>
            <TazeBadge label="Routefocus actief" tone={currentItem.tone} />
            {activeRoutePositionLabel ? <TazeBadge label={`Route ${activeRoutePositionLabel}`} tone="neutral" /> : null}
            <ThemedText style={styles.metaText}>
              {activeRouteFocus.label} Â· {activeRouteFocus.route}
            </ThemedText>
          </View>
          <View style={styles.focusStatsRow}>
            <TazeBadge label={`${visibleAuditStats.total} items`} tone="accent" />
            <TazeBadge label={`Open ${visibleAuditStats.openRate}%`} tone="info" />
            <TazeBadge label={`Apply ${visibleAuditStats.applyRate}%`} tone="warning" />
            <TazeBadge label={`Succes ${visibleAuditStats.successRate}%`} tone="success" />
          </View>
          {focusComparison ? (
            <View style={styles.focusStatsRow}>
              <TazeBadge
                label={`vs scherm open ${focusComparison.openDelta >= 0 ? '+' : ''}${focusComparison.openDelta}pt`}
                tone={focusComparison.openDelta >= 0 ? 'success' : 'danger'}
              />
              <TazeBadge
                label={`vs scherm apply ${focusComparison.applyDelta >= 0 ? '+' : ''}${focusComparison.applyDelta}pt`}
                tone={focusComparison.applyDelta >= 0 ? 'success' : 'danger'}
              />
              <TazeBadge
                label={`vs scherm succes ${focusComparison.successDelta >= 0 ? '+' : ''}${focusComparison.successDelta}pt`}
                tone={focusComparison.successDelta >= 0 ? 'success' : 'danger'}
              />
            </View>
          ) : null}
          {focusBenchmarkSummary ? <ThemedText style={styles.metaText}>{focusBenchmarkSummary}</ThemedText> : null}
          <ThemedText style={styles.metaText}>
            {visibleAuditStats.total} items | Open {visibleAuditStats.openRate}% | Apply {visibleAuditStats.applyRate}% | Succes {visibleAuditStats.successRate}%
          </ThemedText>
          <View style={styles.routeActions}>
            <TazeButton
              label="Open focusroute"
              icon="arrow-forward"
              variant="secondary"
              onPress={() => router.push(activeRouteFocus.route as Href)}
            />
            <TazeButton
              label="Replay focus"
              icon="refresh"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/helpdesk',
                  params: { prefill: activeRouteFocus.latestEntryQuestion },
                })
              }
            />
            {previousRouteFocus ? (
              <TazeButton
                label={`Vorige: ${previousRouteFocus.label}`}
                icon="chevron-left"
                variant="ghost"
                onPress={() => activateRouteFocus(previousRouteFocus.label, previousRouteFocus.route)}
              />
            ) : null}
            {nextRouteFocus ? (
              <TazeButton
                label={`Volgende: ${nextRouteFocus.label}`}
                icon="chevron-right"
                variant="ghost"
                onPress={() => activateRouteFocus(nextRouteFocus.label, nextRouteFocus.route)}
              />
            ) : null}
            <TazeButton
              label="Wis routefocus"
              icon="close"
              variant="ghost"
              onPress={() => clearLegalFocusRoute(currentScreen).catch(() => {})}
            />
            <TazeButton
              label="Route audit"
              icon="insights"
              variant="secondary"
              onPress={() =>
                router.push((`/audit?screen=${currentScreen}&search=${encodeURIComponent(activeRouteFocus.label)}`) as Href)
              }
            />
            <TazeButton
              label="CSV focus"
              icon="download"
              variant="ghost"
              onPress={() => exportFocusedRouteCsv().catch(() => {})}
            />
            <TazeButton
              label="Rapport focus"
              icon="content-copy"
              variant="ghost"
              onPress={() => shareFocusedRouteSummary().catch(() => {})}
            />
            <TazeButton
              label="Management focus"
              icon="description"
              variant="ghost"
              onPress={() => shareFocusedRouteManagementReport().catch(() => {})}
            />
          </View>
        </View>
      ) : null}

      {currentRouteLeaders.length > 0 ? (
        <View style={styles.focusSwitchPanel}>
          <ThemedText type="defaultSemiBold">Snel wisselen</ThemedText>
          <ThemedText style={styles.metaText}>
            Schakel snel tussen schermbreed overzicht en de sterkste legal-routes.
          </ThemedText>
          <View style={styles.focusSwitchRow}>
            <TazeButton
              label={activeRouteFocus ? 'Schermbreed' : 'Schermbreed actief'}
              icon="dashboard"
              variant={activeRouteFocus ? 'ghost' : 'secondary'}
              onPress={() => clearLegalFocusRoute(currentScreen).catch(() => {})}
            />
            {currentRouteLeaders.map((routeLeader) => (
              <TazeButton
                key={`focus-switch-${routeLeader.route}-${routeLeader.label}`}
                label={`${routeLeader.label} (${routeLeader.count})`}
                icon="filter-alt"
                variant={
                  activeRouteFocus?.label === routeLeader.label && activeRouteFocus?.route === routeLeader.route
                    ? 'secondary'
                    : 'ghost'
                }
                onPress={() => activateRouteFocus(routeLeader.label, routeLeader.route)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {focusHistoryRoutes.length > 1 ? (
        <View style={styles.focusSwitchPanel}>
          <TazeSectionHeader
            title="Recente focusroutes"
            subtitle="Spring snel terug naar routes die je net bekeken hebt."
            badge={`${focusHistoryRoutes.length}`}
            badgeTone="accent"
            action={<TazeButton label="Wis lijst" icon="delete-outline" variant="ghost" onPress={clearFocusHistory} />}
          />
          <View style={styles.focusHistoryList}>
            {focusHistoryRoutes
              .filter(
                (route) =>
                  !(activeRouteFocus?.label === route.label && activeRouteFocus?.route === route.route)
              )
              .map((route) => (
                <View key={`focus-history-${route.route}-${route.label}`} style={styles.focusHistoryCard}>
                  <View style={styles.recentHeader}>
                    <TazeBadge label={route.label} tone="accent" />
                    <ThemedText style={styles.metaText}>{route.count}x geadviseerd</ThemedText>
                  </View>
                  <ThemedText style={styles.statusText}>{route.route}</ThemedText>
                  <View style={styles.recentMetaRow}>
                    <TazeBadge label={route.latestStatusLabel} tone="accent" />
                    <TazeBadge label={formatAuditTime(route.latestAt)} tone="neutral" />
                  </View>
                  <ThemedText style={styles.metaText}>Laatste AI-item: {route.latestEntryTitle}</ThemedText>
                  <View style={styles.routeActions}>
                    <TazeButton
                      label="Open focus"
                      icon="history"
                      variant="ghost"
                      onPress={() => activateRouteFocus(route.label, route.route)}
                    />
                    <TazeButton
                      label="Replay route"
                      icon="refresh"
                      variant="ghost"
                      onPress={() =>
                        router.push({
                          pathname: '/helpdesk',
                          params: { prefill: route.latestEntryQuestion },
                        })
                      }
                    />
                    <TazeButton
                      label="Route audit"
                      icon="insights"
                      variant="ghost"
                      onPress={() =>
                        router.push(
                          (`/audit?screen=${currentScreen}&search=${encodeURIComponent(route.label)}`) as Href
                        )
                      }
                    />
                    <TazeButton
                      label="Deel route"
                      icon="content-copy"
                      variant="ghost"
                      onPress={() => shareRouteSummary(route.label, route.route).catch(() => {})}
                    />
                    <TazeButton
                      label="CSV route"
                      icon="download"
                      variant="ghost"
                      onPress={() => exportRouteCsv(route.label, route.route).catch(() => {})}
                    />
                    <TazeButton
                      label="Management route"
                      icon="description"
                      variant="ghost"
                      onPress={() => shareRouteManagementReport(route.label, route.route).catch(() => {})}
                    />
                    <TazeButton
                      label="Verwijder"
                      icon="close"
                      variant="ghost"
                      onPress={() => removeFocusHistoryRoute(route.label, route.route)}
                    />
                  </View>
                </View>
              ))}
          </View>
        </View>
      ) : null}

      {recentCurrentEntries.length > 0 ? (
        <View style={styles.recentList}>
          <TazeSectionHeader
            title={activeRouteFocus ? `Recente adviezen voor ${activeRouteFocus.label}` : `Recente adviezen voor ${currentItem.label}`}
            subtitle={
              activeRouteFocus
                ? 'Deze lijst toont alleen recente AI-items voor de actieve routefocus.'
                : 'Deze lijst toont de meest recente legal-AI-items voor dit scherm.'
            }
            badge={activeRouteFocus ? 'Routefocus' : 'Schermbreed'}
            badgeTone={activeRouteFocus ? 'accent' : currentItem.tone}
            action={
              activeRouteFocus ? (
                <TazeButton
                  label="Wis focus"
                  icon="close"
                  variant="ghost"
                  onPress={() => clearLegalFocusRoute(currentScreen).catch(() => {})}
                />
              ) : undefined
            }
          />
          {recentCurrentEntries.map((entry) => (
            <View key={entry.id} style={styles.recentCard}>
              <View style={styles.recentHeader}>
                <TazeBadge label={entry.screen.toUpperCase()} tone={currentItem.tone} />
                <ThemedText style={styles.metaText}>{entry.recommendedLabel}</ThemedText>
              </View>
              <View style={styles.recentMetaRow}>
                <TazeBadge label={formatAuditTime(entry.createdAt)} tone="neutral" />
                <TazeBadge label={getLegalAuditStatusLabel(entry)} tone={entry.outcomeKind === 'success' ? 'success' : entry.outcomeKind === 'failed' ? 'danger' : 'accent'} />
              </View>
              <ThemedText type="defaultSemiBold">{entry.title}</ThemedText>
              <ThemedText style={styles.statusText}>
                Route: {entry.recommendedLabel} Â· {entry.recommendedRoute}
              </ThemedText>
              <ThemedText style={styles.metaText}>{entry.answer.slice(0, 140)}{entry.answer.length > 140 ? '...' : ''}</ThemedText>
              <View style={styles.recentActions}>
                <TazeButton
                  label="Open route"
                  icon="arrow-forward"
                  variant="secondary"
                  onPress={() => router.push(entry.recommendedRoute as Href)}
                />
                <TazeButton
                  label="Open controle"
                  icon="insights"
                  variant="ghost"
                  onPress={() => router.push((`/audit?screen=${entry.screen}&entryId=${entry.id}`) as Href)}
                />
                <TazeButton
                  label="Replay in Ria"
                  icon="refresh"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: '/helpdesk',
                      params: { prefill: entry.question },
                    })
                  }
                />
                <TazeButton
                  label="Deel item"
                  icon="content-copy"
                  variant="ghost"
                  onPress={() => shareSingleAuditItem(entry).catch(() => {})}
                />
                <TazeButton
                  label={
                    activeRouteFocus?.label === entry.recommendedLabel && activeRouteFocus?.route === entry.recommendedRoute
                      ? 'Route actief'
                      : 'Focus route'
                  }
                  icon="filter-alt"
                  variant={
                    activeRouteFocus?.label === entry.recommendedLabel && activeRouteFocus?.route === entry.recommendedRoute
                      ? 'secondary'
                      : 'ghost'
                  }
                  onPress={() => activateRouteFocus(entry.recommendedLabel, entry.recommendedRoute)}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.trendPanel}>
        <TazeSectionHeader
          title={activeRouteFocus ? `Trends voor ${activeRouteFocus.label}` : `Trends voor ${currentItem.label}`}
          subtitle={
            activeRouteFocus
              ? 'Alle trendkaarten hieronder volgen alleen de actieve routefocus.'
              : 'Alle trendkaarten hieronder tonen het volledige legal-scherm.'
          }
          badge={activeRouteFocus ? 'Routefocus' : 'Schermbreed'}
          badgeTone={activeRouteFocus ? 'accent' : currentItem.tone}
          action={
            <TazeButton
              label={activeRouteFocus ? 'Open focus audit' : 'Open controle'}
              icon="insights"
              variant="ghost"
              onPress={() =>
                router.push(
                  activeRouteFocus
                    ? ((`/audit?screen=${currentScreen}&search=${encodeURIComponent(activeRouteFocus.label)}`) as Href)
                    : ((`/audit?screen=${currentScreen}`) as Href)
                )
              }
            />
          }
        />
        <View style={styles.trendCard}>
          <ThemedText type="defaultSemiBold">Dagtrend {activeFocusLabel}</ThemedText>
          <ThemedText style={styles.metaText}>
            {activeRouteFocus ? 'AI-items voor deze routefocus in de laatste 7 dagen.' : 'AI-items voor dit scherm in de laatste 7 dagen.'}
          </ThemedText>
          <View style={styles.trendChartRow}>
            {currentTrend.days.map((day) => {
              const barHeight = Math.max(8, Math.round((day.total / currentTrend.maxTotal) * 72));
              return (
                <View key={`${currentItem.screen}-${day.key}`} style={styles.trendColumn}>
                  <ThemedText style={styles.trendValue}>{day.total}</ThemedText>
                  <View style={styles.trendBarTrack}>
                    <View style={[styles.trendBarFill, { height: barHeight }]} />
                  </View>
                  <ThemedText style={styles.trendLabel}>{day.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.trendCard}>
          <ThemedText type="defaultSemiBold">Openratio {activeFocusLabel}</ThemedText>
          <ThemedText style={styles.metaText}>
            {activeRouteFocus
              ? 'Hoeveel items binnen deze routefocus per dag minstens tot route-open gingen.'
              : 'Hoeveel legal-AI-items per dag minstens tot route-open gingen.'}
          </ThemedText>
          <View style={styles.trendChartRow}>
            {currentTrend.days.map((day) => {
              const ratio = day.total > 0 ? Math.round((day.opened / day.total) * 100) : 0;
              const barHeight = Math.max(8, Math.round((ratio / 100) * 72));
              return (
                <View key={`${currentItem.screen}-${day.key}-open`} style={styles.trendColumn}>
                  <ThemedText style={styles.trendValue}>{ratio}%</ThemedText>
                  <View style={styles.trendBarTrack}>
                    <View style={[styles.trendBarFill, styles.trendBarFillInfo, { height: barHeight }]} />
                  </View>
                  <ThemedText style={styles.trendLabel}>{day.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.trendCard}>
          <ThemedText type="defaultSemiBold">Toepassingsratio {activeFocusLabel}</ThemedText>
          <ThemedText style={styles.metaText}>
            {activeRouteFocus
              ? 'Hoeveel items binnen deze routefocus per dag echt naar actie gingen.'
              : 'Hoeveel legal-AI-items per dag echt naar actie gingen.'}
          </ThemedText>
          <View style={styles.trendChartRow}>
            {currentTrend.days.map((day) => {
              const ratio = day.total > 0 ? Math.round((day.applied / day.total) * 100) : 0;
              const barHeight = Math.max(8, Math.round((ratio / 100) * 72));
              return (
                <View key={`${currentItem.screen}-${day.key}-apply`} style={styles.trendColumn}>
                  <ThemedText style={styles.trendValue}>{ratio}%</ThemedText>
                  <View style={styles.trendBarTrack}>
                    <View style={[styles.trendBarFill, styles.trendBarFillSuccess, { height: barHeight }]} />
                  </View>
                  <ThemedText style={styles.trendLabel}>{day.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.trendCard}>
          <ThemedText type="defaultSemiBold">Succesratio {activeFocusLabel}</ThemedText>
          <ThemedText style={styles.metaText}>
            {activeRouteFocus
              ? 'Hoeveel toegepaste items binnen deze routefocus per dag succesvol eindigden.'
              : 'Hoeveel toegepaste legal-AI-items per dag succesvol eindigden.'}
          </ThemedText>
          <View style={styles.trendChartRow}>
            {currentTrend.days.map((day) => {
              const ratio = day.applied > 0 ? Math.round((day.succeeded / day.applied) * 100) : 0;
              const barHeight = Math.max(8, Math.round((ratio / 100) * 72));
              return (
                <View key={`${currentItem.screen}-${day.key}-success`} style={styles.trendColumn}>
                  <ThemedText style={styles.trendValue}>{ratio}%</ThemedText>
                  <View style={styles.trendBarTrack}>
                    <View style={[styles.trendBarFill, styles.trendBarFillWarning, { height: barHeight }]} />
                  </View>
                  <ThemedText style={styles.trendLabel}>{day.label}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {latestCurrentEntry ? (
          <TazeButton
            label={activeRouteFocus ? 'Open focusdetail' : 'Open adviesdetail'}
            icon="bolt"
            variant="primary"
            onPress={() =>
              router.push((`/audit?screen=${latestCurrentEntry.screen}&entryId=${latestCurrentEntry.id}`) as Href)
            }
          />
        ) : null}
        {latestCurrentEntry ? (
          <TazeButton
            label="Replay in Ria"
            icon="refresh"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/helpdesk',
                params: { prefill: latestCurrentEntry.question },
              })
            }
          />
        ) : null}
        <TazeButton
          label={activeRouteFocus ? `Audit ${activeRouteFocus.label}` : `Audit ${currentItem.label}`}
          icon="insights"
          variant="secondary"
          onPress={() =>
            router.push(
              activeRouteFocus
                ? ((`/audit?screen=${currentScreen}&search=${encodeURIComponent(activeRouteFocus.label)}`) as Href)
                : ((`/audit?screen=${currentScreen}`) as Href)
            )
          }
        />
        <TazeButton
          label={activeRouteFocus ? 'CSV focus' : 'CSV scherm'}
          icon="download"
          variant="ghost"
          onPress={() =>
            (activeRouteFocus ? exportFocusedRouteCsv() : exportCurrentScreenCsv()).catch(() => {})
          }
        />
        <TazeButton
          label={activeRouteFocus ? 'Rapport focus' : 'Deel rapport'}
          icon="content-copy"
          variant="ghost"
          onPress={() =>
            (activeRouteFocus ? shareFocusedRouteSummary() : shareCurrentScreenSummary()).catch(() => {})
          }
        />
        <TazeButton
          label={activeRouteFocus ? 'Management focus' : 'Management'}
          icon="description"
          variant="ghost"
          onPress={() =>
            (activeRouteFocus ? shareFocusedRouteManagementReport() : shareCurrentScreenManagementReport()).catch(() => {})
          }
        />
        <TazeButton
          label={activeRouteFocus ? 'Open focus audit' : 'Open legal audit'}
          icon="analytics"
          variant="ghost"
          onPress={() =>
            router.push(
              activeRouteFocus
                ? ((`/audit?screen=${currentScreen}&search=${encodeURIComponent(activeRouteFocus.label)}`) as Href)
                : ((`/audit?screen=${currentScreen}`) as Href)
            )
          }
        />
        {activeRouteFocus ? (
          <TazeButton
            label="Wis focus"
            icon="close"
            variant="ghost"
            onPress={() => clearLegalFocusRoute(currentScreen).catch(() => {})}
          />
        ) : null}
        {otherItems.map((item) => (
          <TazeButton
            key={item.screen}
            label={`Open ${item.label}`}
            icon="arrow-forward"
            variant="secondary"
            onPress={() => router.push(item.route)}
          />
        ))}
        <TazeButton
          label={`Open ${currentItem.label} publiek`}
          icon="open-in-new"
          variant="ghost"
          onPress={() => Linking.openURL(currentItem.publicUrl).catch(() => {})}
        />
      </View>
    </TazeCard>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 4,
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
  },
  analyticsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsCard: {
    flexGrow: 1,
    flexBasis: 170,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
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
  routeValue: {
    color: '#0f172a',
    fontSize: 18,
  },
  routeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  routeLeaderPanel: {
    gap: 10,
  },
  focusPanel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
  },
  focusHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  focusStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusSwitchPanel: {
    gap: 10,
  },
  focusSwitchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  focusHistoryList: {
    gap: 10,
  },
  focusHistoryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
  },
  routeLeaderList: {
    gap: 10,
  },
  routeLeaderCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 6,
  },
  recentList: {
    gap: 10,
  },
  recentCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 6,
  },
  recentMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '600',
  },
  recentHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  trendPanel: {
    gap: 10,
  },
  trendCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 8,
  },
  trendChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    minHeight: 104,
  },
  trendColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  trendValue: {
    fontSize: 12,
    color: '#0f172a',
  },
  trendBarTrack: {
    width: '100%',
    height: 74,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    justifyContent: 'flex-end',
    padding: 4,
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: '#c2410c',
  },
  trendBarFillInfo: {
    backgroundColor: '#2563eb',
  },
  trendBarFillSuccess: {
    backgroundColor: '#0f766e',
  },
  trendBarFillWarning: {
    backgroundColor: '#c2410c',
  },
  trendLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});






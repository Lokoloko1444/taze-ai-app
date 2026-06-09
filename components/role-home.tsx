import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { getLowStockAlertsByLocation, useInventory } from 'hooks/use-inventory';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { useAuth } from 'lib/auth-context';
import { getRoleLabel, normalizeAppRole, type AppRole } from 'lib/auth-model';
import { resolveAppLanguage } from 'lib/i18n';
import { getCachedTraceEvents, loadTraceEvents, subscribeTraceEvents, type TraceEventRecord } from 'lib/trace-event-log';

type ReleaseAction = {
  key: 'scan' | 'voorraad' | 'trace' | 'account';
  label: string;
  detail: string;
  href: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const releaseActions: ReleaseAction[] = [
  {
    key: 'scan',
    label: 'Start scan',
    detail: 'Scanner, Ria voorstel, menselijke bevestiging en trace.',
    href: '/scan',
    icon: 'qr-code-scanner',
  },
  {
    key: 'voorraad',
    label: 'Voorraad bekijken',
    detail: 'Locaties, lage stock, waste/verval en voorraadwaarde.',
    href: '/explore',
    icon: 'inventory-2',
  },
  {
    key: 'trace',
    label: 'Trace bekijken',
    detail: 'Bewegingen, audit trail, correcties en Ria history.',
    href: '/trace',
    icon: 'timeline',
  },
  {
    key: 'account',
    label: 'Account/bedrijf',
    detail: 'Company, branch, rol, membership en toegestane billing.',
    href: '/account',
    icon: 'person',
  },
];

type RoleReleaseCopy = {
  allowed: string[];
  hidden: string[];
};

const defaultRoleCopy: RoleReleaseCopy = {
  allowed: [
    'Maak of kies eerst je bedrijf in Account.',
    'Daarna opent Start met scan, voorraad, trace en account.',
  ],
  hidden: ['Admin, billing en transport staan buiten de normale release-flow.'],
};

const roleCopy: Partial<Record<AppRole, RoleReleaseCopy>> = {
  OWNER: {
    allowed: [
      'Ziet dezelfde 5 hoofdknoppen als de rest van het team.',
      'Volledige account-, billing- en settings-toegang achter Account.',
      'Kan scan, voorraad en trace controleren.',
    ],
    hidden: ['Geen extra admin- of payments-knop in de hoofdnav.'],
  },
  MANAGER: {
    allowed: [
      'Ziet dezelfde 5 hoofdknoppen.',
      'Billing en beperkte beheerrechten zitten achter Account.',
      'Kan scan, voorraad en trace opvolgen.',
    ],
    hidden: ['Geen losse admin-, pricing- of devtools-ingang.'],
  },
  WERKVLOER: {
    allowed: [
      'Kan producten scannen.',
      'Kan voorraad en eigen traceflow bekijken.',
      'Kan verbruik/waste registreren wanneer policy dit toestaat.',
      'Kan Ria advies lezen en corrigeren.',
    ],
    hidden: ['Geen billing, admin, role management, pricing of company settings.'],
  },
  CHAUFFEUR: {
    allowed: [
      'Ziet dezelfde 5 hoofdknoppen.',
      'Transport blijft rolgebonden en verschijnt alleen voor Chauffeur.',
      'Kan logistieke Ria-suggesties lezen.',
    ],
    hidden: ['Transport staat niet in de algemene hoofdnav.'],
  },
};

export function RoleHome() {
  const { isCompact } = useResponsiveLayout();
  const router = useRouter();
  const auth = useAuth();
  const { items, movements, liveAlerts } = useInventory();
  const [traceEvents, setTraceEvents] = useState(() => getCachedTraceEvents());

  const activeRole = useMemo(
    () => normalizeAppRole(auth.role ?? auth.activeMembership?.role ?? null),
    [auth.activeMembership?.role, auth.role]
  );
  const appLanguage = useMemo(() => resolveAppLanguage(), []);
  const activeRoleLabel = activeRole ? getRoleLabel(activeRole, appLanguage) : 'Nog geen rol';
  const activeRoleCopy = activeRole ? roleCopy[activeRole] ?? defaultRoleCopy : defaultRoleCopy;
  const companyLabel = auth.company?.name || auth.activeMembership?.company?.name || 'Nog geen bedrijf';
  const branchLabel = auth.branch?.name || auth.activeMembership?.branch?.name || 'Nog geen vestiging';
  const isReadyForScan = Boolean(auth.email && auth.activeMembership);
  const lowStockAlerts = useMemo(() => getLowStockAlertsByLocation(items), [items]);
  const expiringItems = useMemo(
    () => items.filter((item) => item.quantity > 0 && item.expiryDays !== null && item.expiryDays <= 2),
    [items]
  );
  const pendingConfirmations = useMemo(
    () =>
      liveAlerts.filter((alert) =>
        /bevestig|confirm|controle|wacht|pending|review/i.test(`${alert.title} ${alert.detail}`)
      ),
    [liveAlerts]
  );
  const traceAnomalies = useMemo(
    () =>
      traceEvents.filter((event) => {
        const note = event.note.toLowerCase();
        return (
          event.syncState === 'queued' ||
          Boolean(event.syncError) ||
          (event.confidence !== null && event.confidence < 0.75) ||
          note.includes('needs_review') ||
          note.includes('overridden') ||
          note.includes('correctie')
        );
      }),
    [traceEvents]
  );
  const latestScanEvent = useMemo(
    () => traceEvents.find((event) => event.eventKind === 'scan_saved') ?? null,
    [traceEvents]
  );
  const riaSignals = useMemo(
    () => [
      {
        label: 'Voorraad',
        value: `${items.length}`,
        detail: items.length > 0 ? `${movements.length} bewegingen in live context` : 'Nog geen live voorraad',
      },
      {
        label: 'Lage stock',
        value: `${lowStockAlerts.length}`,
        detail: lowStockAlerts[0]?.message ?? 'Geen directe lage-stock melding',
      },
      {
        label: 'Verval',
        value: `${expiringItems.length}`,
        detail: expiringItems[0] ? `${expiringItems[0].name} vraagt opvolging` : 'Geen acute vervaldruk',
      },
      {
        label: 'Trace',
        value: `${traceAnomalies.length}`,
        detail: traceAnomalies[0] ? `${traceAnomalies[0].itemName} vraagt controle` : 'Geen trace-anomalie in focus',
      },
    ],
    [expiringItems, items.length, lowStockAlerts, movements.length, traceAnomalies]
  );
  const riaAdviceLines = useMemo(() => {
    const lines: string[] = [];

    if (expiringItems.length > 0) {
      lines.push(`Verval: gebruik of controleer ${expiringItems[0].name} eerst.`);
    }

    if (lowStockAlerts.length > 0) {
      lines.push(lowStockAlerts[0].message);
    }

    if (pendingConfirmations.length > 0) {
      lines.push(`Openstaand: ${pendingConfirmations[0].title}. Menselijke bevestiging blijft nodig.`);
    }

    if (traceAnomalies.length > 0) {
      lines.push(`Trace: ${traceAnomalies[0].itemName} heeft een controlepunt in de historiek.`);
    }

    if (latestScanEvent) {
      lines.push(`Laatste scan: ${latestScanEvent.itemName} naar ${latestScanEvent.toLocation ?? latestScanEvent.location ?? 'onbekende locatie'}.`);
    }

    if (lines.length === 0) {
      lines.push(items.length > 0 ? 'Voorraad oogt stabiel. Start scan voor nieuwe intake of verbruik.' : 'Start met een scan zodat Ria product, locatie en trace kan voorstellen.');
    }

    return lines.slice(0, 5);
  }, [expiringItems, items.length, latestScanEvent, lowStockAlerts, pendingConfirmations, traceAnomalies]);

  useEffect(() => {
    let cancelled = false;

    loadTraceEvents()
      .then((entries: TraceEventRecord[]) => {
        if (!cancelled) {
          setTraceEvents(entries);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeTraceEvents((entries) => {
      if (!cancelled) {
        setTraceEvents(entries);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const openRoute = useCallback(
    (href: Href) => {
      router.push(href);
    },
    [router]
  );

  return (
    <View style={[styles.shell, isCompact && styles.shellCompact]}>
      <TazeCard variant="panel" style={[styles.heroCard, isCompact && styles.cardCompact]}>
        <View style={styles.heroTop}>
          <TazeBadge label="Release start" tone="primary" icon="dashboard" />
          <TazeBadge label={activeRoleLabel} tone="info" icon="badge" />
        </View>
        <ThemedText type="title" style={styles.heroTitle}>
          Start dashboard
        </ThemedText>
        <ThemedText style={styles.heroText}>
          Login, bedrijf en rol komen eerst. Daarna werkt de vloer vanuit Scan, Voorraad, Trace en Account.
        </ThemedText>
        <View style={styles.contextGrid}>
          <View style={styles.contextItem}>
            <ThemedText style={styles.contextLabel}>Bedrijf</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.contextValue}>
              {companyLabel}
            </ThemedText>
          </View>
          <View style={styles.contextItem}>
            <ThemedText style={styles.contextLabel}>Vestiging</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.contextValue}>
              {branchLabel}
            </ThemedText>
          </View>
          <View style={styles.contextItem}>
            <ThemedText style={styles.contextLabel}>Rol</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.contextValue}>
              {activeRoleLabel}
            </ThemedText>
          </View>
        </View>
        <View style={styles.heroActions}>
          <TazeButton
            label={isReadyForScan ? 'Start scan' : 'Maak bedrijf aan'}
            icon={isReadyForScan ? 'qr-code-scanner' : 'business'}
            variant="primary"
            onPress={() => openRoute(isReadyForScan ? '/scan' : '/account')}
            style={styles.primaryButton}
          />
          <TazeButton
            label="Open cockpit"
            icon="dashboard"
            variant="secondary"
            onPress={() => openRoute('/cockpit')}
            style={styles.primaryButton}
          />
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.cardCompact]}>
        <View style={styles.sectionHeader}>
          <TazeBadge label="Hoofdflow" tone="success" icon="apps" />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            5 hoofdknoppen
          </ThemedText>
        </View>
        <View style={[styles.actionGrid, isCompact && styles.actionGridCompact]}>
          {releaseActions.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => openRoute(action.href)}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}>
              <View style={styles.actionIcon}>
                <MaterialIcons name={action.icon} size={22} color={Brand.primaryStrong} />
              </View>
              <View style={styles.actionCopy}>
                <ThemedText type="defaultSemiBold" style={styles.actionTitle}>
                  {action.label}
                </ThemedText>
                <ThemedText style={styles.actionDetail}>{action.detail}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.cardCompact]}>
        <View style={styles.sectionHeader}>
          <TazeBadge label="Ria advies" tone="info" icon="psychology" />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Operationele AI, geen losse chat
          </ThemedText>
        </View>
        <ThemedText style={styles.bodyText}>
          Ria leest live voorraad, lage stock, verval, trace-afwijkingen en open bevestigingen. De mens
          bevestigt, corrigeert of overrulet.
        </ThemedText>
        <View style={[styles.riaSignalGrid, isCompact && styles.actionGridCompact]}>
          {riaSignals.map((signal) => (
            <View key={signal.label} style={styles.riaSignalCard}>
              <ThemedText style={styles.contextLabel}>{signal.label}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.riaSignalValue}>
                {signal.value}
              </ThemedText>
              <ThemedText style={styles.actionDetail}>{signal.detail}</ThemedText>
            </View>
          ))}
        </View>
        <View style={styles.riaAdviceList}>
          {riaAdviceLines.map((line) => (
            <View key={line} style={styles.listRow}>
              <MaterialIcons name="auto-awesome" size={16} color={Brand.primaryStrong} />
              <ThemedText style={styles.listText}>{line}</ThemedText>
            </View>
          ))}
        </View>
        <View style={styles.badgeRow}>
          <TazeBadge label="Tekst zichtbaar" tone="success" icon="visibility" />
          <TazeBadge label="Mens bevestigt" tone="warning" icon="verified" />
          <TazeBadge label="Geen auto-mutatie" tone="neutral" icon="lock" />
          <TazeBadge label="Live state actief" tone="info" icon="sync" />
        </View>
      </TazeCard>

      <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.cardCompact]}>
        <View style={styles.sectionHeader}>
          <TazeBadge label="Rolbewijs" tone="primary" icon="admin-panel-settings" />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Wat deze rol ziet
          </ThemedText>
        </View>
        <View style={[styles.permissionGrid, isCompact && styles.actionGridCompact]}>
          <View style={styles.permissionBox}>
            <ThemedText type="defaultSemiBold" style={styles.permissionTitle}>
              Toegestaan
            </ThemedText>
            {activeRoleCopy.allowed.map((item) => (
              <View key={item} style={styles.listRow}>
                <MaterialIcons name="check-circle" size={16} color={Brand.primaryStrong} />
                <ThemedText style={styles.listText}>{item}</ThemedText>
              </View>
            ))}
          </View>
          <View style={styles.permissionBox}>
            <ThemedText type="defaultSemiBold" style={styles.permissionTitle}>
              Verborgen in release mode
            </ThemedText>
            {activeRoleCopy.hidden.map((item) => (
              <View key={item} style={styles.listRow}>
                <MaterialIcons name="block" size={16} color="#9a3412" />
                <ThemedText style={styles.listText}>{item}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </TazeCard>

      {activeRole === 'CHAUFFEUR' ? (
        <TazeCard variant="muted" style={[styles.sectionCard, isCompact && styles.cardCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Alleen chauffeur" tone="accent" icon="local-shipping" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Transportflow
            </ThemedText>
          </View>
          <ThemedText style={styles.bodyText}>
            Transport blijft rolgebonden en staat niet in de algemene hoofdnav.
          </ThemedText>
          <TazeButton
            label="Open transport"
            icon="local-shipping"
            variant="secondary"
            onPress={() => openRoute('/transport')}
            style={styles.primaryButton}
          />
        </TazeCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    gap: 14,
    padding: 16,
  },
  shellCompact: {
    padding: 14,
  },
  heroCard: {
    gap: 14,
    padding: 20,
  },
  cardCompact: {
    padding: 16,
  },
  heroTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroTitle: {
    color: Brand.ink,
  },
  heroText: {
    maxWidth: 760,
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextItem: {
    flexGrow: 1,
    flexBasis: 180,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(255,255,255,0.86)',
    padding: 12,
  },
  contextLabel: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  contextValue: {
    color: Brand.ink,
  },
  primaryButton: {
    alignSelf: 'stretch',
  },
  heroActions: {
    gap: 10,
  },
  sectionCard: {
    gap: 12,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: Brand.ink,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionGridCompact: {
    flexDirection: 'column',
  },
  actionCard: {
    flexGrow: 1,
    flexBasis: 240,
    minHeight: 104,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  actionCardPressed: {
    opacity: 0.92,
    transform: [{ translateY: 1 }],
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 118, 110, 0.08)',
  },
  actionCopy: {
    flex: 1,
    gap: 5,
  },
  actionTitle: {
    color: Brand.ink,
  },
  actionDetail: {
    color: Brand.inkMuted,
    lineHeight: 19,
  },
  bodyText: {
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  riaSignalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  riaSignalCard: {
    flexGrow: 1,
    flexBasis: 170,
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  riaSignalValue: {
    color: Brand.primaryStrong,
    fontSize: 18,
  },
  riaAdviceList: {
    gap: 8,
  },
  permissionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  permissionBox: {
    flexGrow: 1,
    flexBasis: 260,
    gap: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  permissionTitle: {
    color: Brand.ink,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listText: {
    flex: 1,
    color: Brand.ink,
    lineHeight: 19,
  },
});

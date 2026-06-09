 import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { useAuth } from 'lib/auth-context';
import { getRoleLabel, normalizeAppRole } from 'lib/auth-model';
import { DomainConfig } from 'lib/domain-config';
import { resolveAppLanguage } from 'lib/i18n';

type RouteCard = {
  key: string;
  label: string;
  detail: string;
  href: Href | string;
  icon: keyof typeof MaterialIcons.glyphMap;
  tone: string;
  surface: string;
};

const routeCards: RouteCard[] = [
  {
    key: 'start',
    label: 'Start',
    detail: 'Terug naar de rol-home en je volgende stap.',
    href: '/',
    icon: 'home',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    key: 'scan',
    label: 'Scan',
    detail: 'Werkvloer, product, schade en verval.',
    href: '/scan',
    icon: 'camera-alt',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    key: 'food-chain',
    label: 'Voedselketen',
    detail: 'Ontvangst, scan, voorstel, bevestiging en auditbewijs.',
    href: '/food-chain',
    icon: 'hub',
    tone: '#0f766e',
    surface: '#f0fdfa',
  },
  {
    key: 'transport',
    label: 'Transport',
    detail: 'Vertrek, onderweg en aankomst.',
    href: '/transport',
    icon: 'local-shipping',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    key: 'invoice',
    label: 'Facturatie',
    detail: 'Concept, nummer en laatste controle.',
    href: DomainConfig.invoiceOrigin,
    icon: 'receipt-long',
    tone: '#b45309',
    surface: '#fffbeb',
  },
  {
    key: 'admin',
    label: 'Beheer',
    detail: 'Rollen, bedrijfsdata en audit.',
    href: '/admin',
    icon: 'admin-panel-settings',
    tone: '#7c3aed',
    surface: '#f5f3ff',
  },
  {
    key: 'account',
    label: 'Account',
    detail: 'Login, koppelingen en toegang.',
    href: '/account',
    icon: 'person',
    tone: '#475569',
    surface: '#f8fafc',
  },
];

const flowOrder = ['Scan', 'Transport', 'Invoice', 'Rollen', 'Bewijs', 'Rapport', 'RIA'];

async function openTarget(target: Href | string, routerPush: (href: Href) => void) {
  if (typeof target === 'string' && target.startsWith('http')) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(target);
      return Promise.resolve();
    }

    return Linking.openURL(target);
  }

  return Promise.resolve(routerPush(target as Href));
}

export default function HubScreen() {
  const router = useRouter();
  const { isCompact } = useResponsiveLayout();
  const auth = useAuth();
  const appLanguage = useMemo(() => resolveAppLanguage(), []);

  const activeRole = useMemo(() => normalizeAppRole(auth.role ?? auth.activeMembership?.role ?? null), [auth.activeMembership?.role, auth.role]);
  const activeRoleLabel = activeRole ? getRoleLabel(activeRole, appLanguage) : 'Nog geen rol actief';
  const roleSummary = activeRole
    ? `Je huidige rol is ${activeRoleLabel}.`
    : 'Kies eerst je rol op de startpagina en ga daarna naar de juiste lijn.';

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        isCompact && styles.scrollContentCompact,
      ]}>
      <ThemedView style={styles.screen}>
        <TazeCard variant="panel" style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
          <View style={styles.heroRow}>
            <View style={styles.logoFrame}>
              <TazeLogo size={60} framed={false} />
            </View>
            <View style={styles.heroCopy}>
              <TazeBadge label="Meer in de app" tone="info" icon="dashboard" />
              <ThemedText type="title" style={styles.heroTitle}>
                Snel naar de juiste plek
              </ThemedText>
              <ThemedText style={styles.heroText}>{roleSummary}</ThemedText>
            </View>
          </View>
        </TazeCard>

        <TazeCard variant="muted" style={[styles.boundaryCard, isCompact && styles.sectionCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Boundary fact" tone="success" icon="verified" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Vandaag helder, morgen aantoonbaar
            </ThemedText>
          </View>
          <ThemedText style={styles.boundaryText}>AI ondersteunt. De mens beslist. Taze neemt niet over.</ThemedText>
          <ThemedText style={styles.boundaryTextSecondary}>
            Alleen acties binnen scope, met rol, audit en verantwoordelijkheid.
          </ThemedText>
        </TazeCard>

        <TazeCard variant="muted" style={[styles.demoCard, isCompact && styles.sectionCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Live" tone="success" icon="qr-code-scanner" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Start voorraadflow
            </ThemedText>
          </View>
          <ThemedText style={styles.demoText}>
            Open de live scanflow voor camera, productherkenning en voorraadbeweging.
          </ThemedText>
          <TazeButton
            label="Start voorraadflow"
            icon="arrow-forward"
            variant="primary"
            onPress={() => void openTarget('/scan', (href) => router.push(href))}
            style={styles.demoButton}
          />
        </TazeCard>

        <TazeCard variant="muted" style={[styles.orderCard, isCompact && styles.sectionCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Volgorde" tone="primary" icon="timeline" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              De vaste app-volgorde
            </ThemedText>
          </View>
          <View style={styles.orderRow}>
            {flowOrder.map((step, index) => (
              <View key={step} style={styles.orderPill}>
                <ThemedText type="defaultSemiBold" style={styles.orderIndex}>
                  {index + 1}
                </ThemedText>
                <ThemedText style={styles.orderLabel}>{step}</ThemedText>
              </View>
            ))}
          </View>
        </TazeCard>

        <View style={styles.grid}>
          {routeCards.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => void openTarget(item.href, (href) => router.push(href))}
              style={({ pressed }) => [
                styles.cardPressable,
                pressed && styles.cardPressed,
              ]}>
              <TazeCard variant="muted" style={[styles.card, { borderColor: item.tone, backgroundColor: item.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: item.tone }]}>
                    <MaterialIcons name={item.icon} size={18} color="#fff" />
                  </View>
                  <TazeBadge label="Open" tone="neutral" />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                  {item.label}
                </ThemedText>
                <ThemedText style={styles.cardDetail}>{item.detail}</ThemedText>
              </TazeCard>
            </Pressable>
          ))}
        </View>

        <TazeCard variant="muted" style={[styles.footerCard, isCompact && styles.sectionCompact]}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Tip" tone="success" icon="arrow-forward" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Gebruik eerst de startpagina
            </ThemedText>
          </View>
          <ThemedText style={styles.footerText}>
            De startpagina toont je volgende stap. Deze pagina gebruik je als je al weet waar je heen wilt.
          </ThemedText>
          <View style={styles.footerActions}>
            <Pressable onPress={() => router.push('/')} style={styles.footerButton}>
              <ThemedText type="defaultSemiBold" style={styles.footerButtonText}>
                Naar start
              </ThemedText>
            </Pressable>
          </View>
        </TazeCard>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    backgroundColor: Brand.canvas,
    alignItems: 'center',
  },
  scrollContentCompact: {
    paddingHorizontal: 14,
  },
  screen: {
    width: '100%',
    gap: 14,
    maxWidth: 1080,
  },
  heroCard: {
    gap: 12,
    padding: 18,
  },
  boundaryCard: {
    gap: 10,
    padding: 18,
  },
  demoCard: {
    gap: 10,
    padding: 18,
  },
  heroCardCompact: {
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoFrame: {
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: Brand.ink,
  },
  heroText: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  orderCard: {
    gap: 12,
    padding: 18,
  },
  sectionCompact: {
    padding: 16,
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
  demoText: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  boundaryText: {
    color: Brand.ink,
    lineHeight: 22,
    fontSize: 16,
    fontWeight: '600',
  },
  boundaryTextSecondary: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  demoButton: {
    alignSelf: 'flex-start',
  },
  orderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  orderIndex: {
    color: '#0f766e',
  },
  orderLabel: {
    color: Brand.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cardPressable: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  card: {
    gap: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: Brand.ink,
  },
  cardDetail: {
    color: Brand.inkMuted,
    lineHeight: 18,
  },
  footerCard: {
    gap: 10,
    padding: 18,
  },
  footerText: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  footerButton: {
    borderRadius: 14,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerButtonText: {
    color: '#fff',
  },
});

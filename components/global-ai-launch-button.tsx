import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from 'constants/theme';
import { ThemedText } from 'components/themed-text';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

function getRouteLabel(pathname: string) {
  const normalized = pathname.replace(/\?.*$/, '').replace(/\/+$/, '') || '/';

  const labels: Record<string, string> = {
    '/': 'de homepagina',
    '/scan': 'de scanpagina',
    '/payments': 'de betalingenpagina',
    '/helpdesk': 'de Ria helpdesk',
    '/alerts': 'de meldingenpagina',
    '/trace': 'de tracepagina',
    '/transport': 'de transporthub',
    '/security': 'de beveiligingspagina',
    '/audit': 'de AI auditpagina',
    '/readiness': 'de go-live pagina',
    '/partners': 'de partnerpagina',
    '/services': 'de dienstenpagina',
    '/account': 'de accountpagina',
    '/privacy': 'de privacypagina',
    '/support': 'de supportpagina',
    '/contact': 'de contactpagina',
    '/newsletter': 'de nieuwsbriefpagina',
    '/updates': 'de updatepagina',
    '/translate': 'de vertaalpagina',
  };

  if (labels[normalized]) {
    return labels[normalized];
  }

  if (normalized.startsWith('/(tabs)/')) {
    const tabPath = `/${normalized.slice('/(tabs)/'.length)}`;
    if (labels[tabPath]) return labels[tabPath];
  }

  return 'deze pagina';
}

function isPrimarySurface(pathname: string) {
  const normalized = pathname.replace(/\?.*$/, '').replace(/\/+$/, '') || '/';
  const primaryRoutes = new Set(['/', '/scan', '/explore', '/hub']);

  if (primaryRoutes.has(normalized)) {
    return true;
  }

  if (normalized.startsWith('/(tabs)/')) {
    const tabPath = `/${normalized.slice('/(tabs)/'.length)}`;
    return primaryRoutes.has(tabPath);
  }

  return false;
}

function isScanSurface(pathname: string) {
  const normalized = pathname.replace(/\?.*$/, '').replace(/\/+$/, '') || '/';
  return normalized === '/scan' || normalized === '/(tabs)/scan';
}

type QuickAction = {
  key: string;
  label: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export function GlobalAiLaunchButton() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const scale = useRef(new Animated.Value(1)).current;
  const { isCompact } = useResponsiveLayout();
  const releaseModeHidesLooseDock = true;
  const isVisible = !releaseModeHidesLooseDock && isPrimarySurface(pathname) && !isScanSurface(pathname);

  const prefill = useMemo(() => {
    const routeLabel = getRouteLabel(pathname);
    return `Ik zit op ${routeLabel}. Geef me de slimste volgende stap.`;
  }, [pathname]);

  const actions: QuickAction[] = useMemo(
    () => [
      {
        key: 'scan',
        label: 'Scan',
        subtitle: 'Open scanner',
        icon: 'qr-code-scanner',
        onPress: () => router.push('/scan'),
      },
      {
        key: 'ria',
        label: 'Ria',
        subtitle: 'Voorstel',
        icon: 'psychology',
        onPress: () => router.push(`/helpdesk?prefill=${encodeURIComponent(prefill)}`),
      },
      {
        key: 'talkback',
        label: 'Talkback',
        subtitle: 'Stem & voorlezen',
        icon: 'volume-up',
        onPress: () =>
          router.push(
            `/helpdesk?prefill=${encodeURIComponent(
              'Lees dit scherm kort voor en geef alleen een advies. Voer niets automatisch uit.'
            )}`
          ),
      },
    ],
    [prefill, router]
  );

  if (!isVisible) {
    return null;
  }

  const handlePress = (onPress: () => void) => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 24,
        bounciness: 4,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 5,
      }),
    ]).start();

    onPress();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        isCompact ? styles.wrapCompact : styles.wrapWide,
        { bottom: insets.bottom + (isCompact ? 10 : 14) },
      ]}>
      <View style={[styles.dock, isCompact && styles.dockCompact]}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => handlePress(action.onPress)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [styles.buttonShell, pressed ? styles.buttonPressed : null]}>
            <Animated.View style={[styles.button, isCompact && styles.buttonCompact, { transform: [{ scale }] }]}>
              <MaterialIcons name={action.icon} size={18} color={Brand.white} />
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold" style={styles.title}>
                  {action.label}
                </ThemedText>
                {isCompact ? null : <ThemedText style={styles.subtitle}>{action.subtitle}</ThemedText>}
              </View>
            </Animated.View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 1001,
  },
  wrapWide: {
    right: 16,
  },
  wrapCompact: {
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  dock: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 8, 22, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    boxShadow: '0px 14px 26px rgba(5, 8, 22, 0.18)',
  },
  dockCompact: {
    alignItems: 'stretch',
    width: '100%',
  },
  buttonShell: {
    borderRadius: 16,
  },
  buttonPressed: {
    opacity: 0.94,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 148,
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  buttonCompact: {
    minWidth: 0,
    width: '100%',
    justifyContent: 'flex-start',
  },
  copy: {
    flexShrink: 1,
  },
  title: {
    color: Brand.white,
    fontSize: 12.8,
    lineHeight: 16,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 10.5,
    lineHeight: 13,
  },
});

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';

import { AppBackdrop } from 'components/app-backdrop';
import { AdminGatewayPage } from 'components/admin-gateway-page';
import { AiGatewayPage } from 'components/ai-gateway-page';
import { ApiOnlyPage } from 'components/api-only-page';
import { AuthGate } from 'components/auth-gate';
import { DemoExperiencePage } from 'components/demo-experience-page';
import { GlobalAiLaunchButton } from 'components/global-ai-launch-button';
import { GlobalBrandMark } from 'components/global-brand-mark';
import { InvoiceGatewayPage } from 'components/invoice-gateway-page';
import OfflineIndicator from 'components/OfflineIndicator';
import { PublicWebsitePage } from 'components/public-website-page';
import TransportScreen from 'app/transport';
import { ScanShellPage } from 'components/scan-shell-page';
import { SecurityLockScreen } from 'components/security-lock-screen';
import { UnknownHostPage } from 'components/unknown-host-page';
import { useColorScheme } from 'hooks/use-color-scheme';
import { AuthProvider } from 'lib/auth-context';
import { getHostSurface } from 'lib/domain-config';
import { getPageSeo, getPageSeoUrl } from 'lib/page-seo';
import { resolveRootLayoutSurface } from 'lib/root-layout-routing';
import { useSecurityGuard } from 'lib/security-guard';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const SERVICE_WORKER_VERSION = 'scan-runtime-20260528';
const serviceWorkerRegistrationScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js?v=${SERVICE_WORKER_VERSION}', { updateViaCache: 'none' })
      .then(function (registration) {
        registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'TAZE_SKIP_WAITING' });
        }
        registration.addEventListener('updatefound', function () {
          var installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', function () {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'TAZE_SKIP_WAITING' });
            }
          });
        });
      })
      .catch(function () {});
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (window.__TAZE_SW_RELOADED__) return;
    window.__TAZE_SW_RELOADED__ = true;
    window.location.reload();
  });
}
`;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const security = useSecurityGuard();
  const pathname = usePathname();
  const hostname = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : null;
  const hostSurface =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? getHostSurface(window.location.hostname)
      : 'app';
  const layoutSurface = resolveRootLayoutSurface({ hostSurface, pathname, hostname });
  const seoHostSurface =
      layoutSurface === 'demo-website'
        ? 'demo'
      : layoutSurface === 'platform-protected'
        ? 'platform'
      : layoutSurface === 'transport-protected'
          ? 'transport'
        : layoutSurface === 'invoice-protected'
          ? 'invoice'
          : layoutSurface === 'ai-protected'
            ? 'ai'
          : layoutSurface === 'app-protected'
            ? 'app'
          : layoutSurface === 'scan-protected'
            ? 'scan'
            : layoutSurface === 'admin-protected'
              ? 'admin'
              : layoutSurface === 'api-only'
                ? 'api'
                : 'public';
  const pageSeo = getPageSeo(pathname, seoHostSurface, null);
  const pageSeoUrl = getPageSeoUrl(pathname, seoHostSurface, null);
  const pageHead = (
    <Head>
      <title>{pageSeo.title}</title>
      <meta name="description" content={pageSeo.description} />
      <meta property="og:title" content={pageSeo.title} />
      <meta property="og:description" content={pageSeo.description} />
      <meta property="og:url" content={pageSeoUrl} />
      <meta property="og:type" content={pageSeo.ogType ?? 'website'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="robots" content={pageSeo.robots ?? 'index,follow'} />
      <meta name="theme-color" content="#04131F" />
      <link rel="manifest" href="/manifest.json" />
      <script dangerouslySetInnerHTML={{ __html: serviceWorkerRegistrationScript }} />
    </Head>
  );

  if (layoutSurface === 'api-only') {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          {pageHead}
          <AppBackdrop variant={colorScheme === 'dark' ? 'dark' : 'light'} />
          <ApiOnlyPage />
          <StatusBar style="auto" />
        </View>
      </ThemeProvider>
    );
  }

  if (layoutSurface === 'blocked') {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          <Head>
            <title>Taze | Host niet geconfigureerd</title>
            <meta name="description" content="Deze Taze-host is niet geconfigureerd." />
            <meta property="og:title" content="Taze | Host niet geconfigureerd" />
            <meta property="og:description" content="Deze Taze-host is niet geconfigureerd." />
            <meta property="og:url" content={pageSeoUrl} />
            <meta property="og:type" content="website" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="robots" content="noindex,nofollow" />
          </Head>
          <AppBackdrop variant={colorScheme === 'dark' ? 'dark' : 'light'} />
          <UnknownHostPage />
          <StatusBar style="auto" />
        </View>
      </ThemeProvider>
    );
  }

  if (layoutSurface === 'public-info') {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          {pageHead}
          <AppBackdrop variant={colorScheme === 'dark' ? 'dark' : 'light'} />
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
          <StatusBar style="auto" />
        </View>
      </ThemeProvider>
    );
  }

  if (layoutSurface === 'demo-website') {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          {pageHead}
          <AppBackdrop variant={colorScheme === 'dark' ? 'dark' : 'light'} />
          <DemoExperiencePage />
          <StatusBar style="auto" />
        </View>
      </ThemeProvider>
    );
  }

  if (
    layoutSurface === 'platform-protected' ||
    layoutSurface === 'app-protected' ||
    layoutSurface === 'transport-protected' ||
    layoutSurface === 'invoice-protected' ||
    layoutSurface === 'ai-protected' ||
    layoutSurface === 'scan-protected' ||
    layoutSurface === 'admin-protected'
  ) {
    const protectedContent =
      layoutSurface === 'platform-protected' ? (
        <>
          <Stack screenOptions={{ headerShown: false }} />
          <GlobalBrandMark />
          <GlobalAiLaunchButton />
        </>
      ) : layoutSurface === 'app-protected' ? (
        <>
          <Stack screenOptions={{ headerShown: false }} />
          <GlobalBrandMark />
          <GlobalAiLaunchButton />
        </>
      ) : layoutSurface === 'transport-protected' ? (
        <TransportScreen />
      ) : layoutSurface === 'invoice-protected' ? (
        <InvoiceGatewayPage />
      ) : layoutSurface === 'ai-protected' ? (
        <AiGatewayPage />
      ) : layoutSurface === 'scan-protected' ? (
        <ScanShellPage />
      ) : (
        <AdminGatewayPage />
      );

    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1 }}>
          {pageHead}
          <AppBackdrop variant={colorScheme === 'dark' ? 'dark' : 'light'} />
          <OfflineIndicator />
          {security.ready && security.locked ? (
            <>
              <SecurityLockScreen busy={security.busy} error={security.lastError} onUnlock={security.unlock} />
              {layoutSurface === 'app-protected' || layoutSurface === 'platform-protected' ? <GlobalBrandMark /> : null}
            </>
          ) : (
            <AuthProvider>
                <AuthGate
                  hostSurface={
                    layoutSurface === 'platform-protected'
                      ? 'platform'
                      : layoutSurface === 'app-protected'
                      ? 'app'
                      : layoutSurface === 'transport-protected'
                        ? 'transport'
                      : layoutSurface === 'invoice-protected'
                        ? 'invoice'
                        : layoutSurface === 'ai-protected'
                          ? 'ai'
                        : layoutSurface === 'scan-protected'
                          ? 'scan'
                        : 'admin'
                }>
                {protectedContent}
              </AuthGate>
            </AuthProvider>
          )}
          <StatusBar style="auto" />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        {pageHead}
        <AppBackdrop variant={colorScheme === 'dark' ? 'dark' : 'light'} />
        <PublicWebsitePage />
        <StatusBar style="auto" />
      </View>
    </ThemeProvider>
  );
}

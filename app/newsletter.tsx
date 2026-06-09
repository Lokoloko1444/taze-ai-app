import { Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenAiPanel } from 'components/screen-ai-panel';
import { TazeButton } from 'components/taze-button';
import { TazeInput } from 'components/taze-input';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { getItem, setItem } from 'lib/app-storage';
import { LegalConfig } from 'lib/legal-config';
import { getServerBaseUrl } from 'lib/server-url';

const STORAGE_KEY = 'newsletter-user-email-v1';

function isProbablyEmail(value: string) {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed);
}

export default function NewsletterScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const [userEmail, setUserEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) setUserEmail(raw);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const mailtoUrl = useMemo(() => {
    const subject = encodeURIComponent('Nieuwsbrief / updates');
    const body = encodeURIComponent(`Ik wil de nieuwsbrief.\n\nMijn e-mail: ${userEmail.trim()}\n\n`);
    return `mailto:${encodeURIComponent(LegalConfig.supportEmail)}?subject=${subject}&body=${body}`;
  }, [userEmail]);

  const handleSubscribe = useCallback(async () => {
    const email = userEmail.trim();
    if (!isProbablyEmail(email)) {
      Alert.alert('E-mail ongeldig', 'Vul een geldig e-mailadres in.');
      return;
    }

    setBusy(true);
    try {
      await setItem(STORAGE_KEY, email);

      const res = await fetch(`${getServerBaseUrl()}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        Alert.alert('Ingeschreven', 'Je e-mail is toegevoegd aan de nieuwsbrief (live server).');
        return;
      }
    } catch {
      // ignore and fallback to mailto
    } finally {
      setBusy(false);
    }

    Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert('Link openen mislukt', 'Gebruik een mailclient of kopieer het e-mailadres.');
    });
  }, [mailtoUrl, userEmail]);

  const newsletterPanel = (
    <View style={styles.panel}>
      <ThemedText type="defaultSemiBold">Jouw e-mail</ThemedText>
      <TazeInput
        icon="mail"
        value={userEmail}
        onChangeText={setUserEmail}
        placeholder="jij@bedrijf.be"
        autoCapitalize="none"
        keyboardType="email-address"
        containerStyle={styles.formInput}
      />

      <View style={styles.actions}>
        <TazeButton
          label={busy ? 'Bezig...' : 'Inschrijven'}
          onPress={() => handleSubscribe().catch(() => {})}
          disabled={busy}
          variant="primary"
          style={styles.primaryBtn}
        />
        <TazeButton
          label="Mail openen"
          onPress={() => Linking.openURL(mailtoUrl).catch(() => {})}
          variant="secondary"
          style={styles.secondaryBtn}
        />
        <TazeButton
          label="Privacybeleid"
          onPress={() => router.push(LegalConfig.privacyRoute as Href)}
          variant="ghost"
          accessibilityRole="button"
          accessibilityLabel="Privacybeleid"
          style={styles.secondaryBtn}
        />
        <TazeButton
          label="Hulp"
          onPress={() => router.push(LegalConfig.supportRoute as Href)}
          variant="ghost"
          style={styles.secondaryBtn}
        />
        <TazeButton
          label="Contact"
          onPress={() => router.push(LegalConfig.contactRoute as Href)}
          variant="ghost"
          style={styles.secondaryBtn}
        />
      </View>

      <ThemedText style={styles.meta}>
        Tip: voor productie verbind je direct met je live mailing provider (Mailchimp/Brevo/Sendgrid).
      </ThemedText>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <View style={styles.hero}>
          <View style={styles.heroBrandRow}>
            <View style={styles.heroLogoFrame}>
              <TazeLogo size={72} framed={false} />
            </View>
            <View style={styles.heroCopy}>
              <ThemedText type="title">Taze Nieuwsbrief</ThemedText>
              <ThemedText>Voeg je e-mail toe en link direct met {LegalConfig.supportEmail}.</ThemedText>
            </View>
          </View>
          <View style={styles.heroBadge}>
            <ThemedText style={styles.heroBadgeLabel}>Contact</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.heroBadgeValue}>
              {LegalConfig.supportEmail}
            </ThemedText>
            <ThemedText style={styles.heroBadgeText}>Updates, releases, support</ThemedText>
          </View>
        </View>

        {isWeb ? newsletterPanel : <ScreenAiPanel screen="newsletter" status={{ userEmail }} />}
        {isWeb ? <ScreenAiPanel screen="newsletter" status={{ userEmail }} /> : newsletterPanel}
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
    gap: 18,
  },
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroBrandRow: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroLogoFrame: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(196,181,253,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.primary,
    gap: 4,
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  heroBadgeValue: {
    color: '#ffffff',
  },
  heroBadgeText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 12,
    boxShadow: '0px 16px 34px rgba(15, 23, 42, 0.07)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  formInput: {
    minWidth: 180,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flex: 1,
    minWidth: 160,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 160,
  },
  meta: {
    color: '#64748b',
    fontSize: 12,
  },
});


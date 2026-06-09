import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useAuth } from 'lib/auth-context';
import { normalizeAppRole, roleHasPermission } from 'lib/auth-model';
import { resolveAppLanguage, t, type AppLanguage, type TranslationKey } from 'lib/i18n';
import { supabase } from 'lib/supabase';
import { uploadDeliveryProof } from 'lib/uploadProof';

type DeliveryRow = {
  id: string;
  order_id: string | null;
  geleverd_op: string | null;
  foto_bewijs: string[] | null;
  klant_handtekening: string | null;
  chauffeur_id: string | null;
  klant_bevestigd: boolean | null;
  klant_bevestigd_op: string | null;
  confirm_token: string | null;
  created_at: string | null;
};

type PhotoDraft = {
  uri: string;
  path: string | null;
};

function formatDeliveryAlertTranslation(
  template: string,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
}

function createToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

function formatDate(value: string | null, language: AppLanguage) {
  if (!value) return t('delivery.alert.notDelivered', language);
  const localeByLanguage: Record<AppLanguage, string> = {
    nl: 'nl-BE',
    en: 'en-US',
    fr: 'fr-BE',
    de: 'de-DE',
    es: 'es-ES',
    bg: 'bg-BG',
    hi: 'hi-IN',
    ja: 'ja-JP',
    pl: 'pl-PL',
    id: 'id-ID',
    ar: 'ar-SA',
  };
  return new Intl.DateTimeFormat(localeByLanguage[language], { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function DeliveryScreen() {
  const auth = useAuth();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<DeliveryRow | null>(null);
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>([]);
  const uiLanguage = useMemo(resolveAppLanguage, []);
  const deliveryAlertT = useMemo(
    () => (key: TranslationKey, replacements?: Record<string, string | number | null | undefined>) =>
      formatDeliveryAlertTranslation(t(key, uiLanguage), replacements),
    [uiLanguage]
  );

  const role = useMemo(() => normalizeAppRole(auth.role ?? auth.activeMembership?.role ?? null), [auth.activeMembership?.role, auth.role]);
  const canUseDelivery =
    role === 'CHAUFFEUR' ||
    roleHasPermission(role, 'delivery.update_status', auth.permissions) ||
    roleHasPermission(role, 'delivery.confirm', auth.permissions);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!supabase) {
      setError(deliveryAlertT('delivery.alert.supabaseMissing'));
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;

    if (!userId) {
      setError(deliveryAlertT('delivery.alert.loginRequired'));
      setDeliveries([]);
      setLoading(false);
      return;
    }

    const { data, error: deliveryError } = await supabase
      .schema('transacties')
      .from('deliveries')
      .select('id,order_id,geleverd_op,foto_bewijs,klant_handtekening,chauffeur_id,klant_bevestigd,klant_bevestigd_op,confirm_token,created_at')
      .or(`chauffeur_id.is.null,chauffeur_id.eq.${userId}`)
      .or('geleverd_op.is.null,klant_bevestigd.eq.false')
      .order('created_at', { ascending: true });

    if (deliveryError) {
      setError(deliveryError.message);
      setDeliveries([]);
    } else {
      setDeliveries((data ?? []) as DeliveryRow[]);
    }

    setLoading(false);
  }, [deliveryAlertT]);

  useEffect(() => {
    fetchDeliveries().catch((caught) => {
      setError(caught instanceof Error ? caught.message : deliveryAlertT('delivery.alert.loadFailed'));
      setLoading(false);
    });
  }, [deliveryAlertT, fetchDeliveries]);

  const startDelivery = useCallback(
    async (delivery: DeliveryRow) => {
      if (!permission?.granted) {
        const nextPermission = await requestPermission();
        if (!nextPermission.granted) {
          Alert.alert(
            deliveryAlertT('delivery.alert.cameraPermission.title'),
            deliveryAlertT('delivery.alert.cameraPermission.body')
          );
          return;
        }
      }

      setActiveDelivery(delivery);
      setPhotoDrafts(
        (delivery.foto_bewijs ?? []).map((path) => ({
          uri: path,
          path,
        }))
      );
      setError(null);
    },
    [deliveryAlertT, permission?.granted, requestPermission]
  );

  const capturePhoto = useCallback(async () => {
    if (!activeDelivery || !cameraRef.current || !supabase) return;
    if (photoDrafts.length >= 3) {
      Alert.alert(deliveryAlertT('delivery.alert.maxPhotos.title'), deliveryAlertT('delivery.alert.maxPhotos.body'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.72, exif: false });
      if (!picture?.uri) {
        throw new Error(deliveryAlertT('delivery.alert.cameraNoPhoto'));
      }

      const blob = await fetch(picture.uri).then((response) => response.blob());
      const uploaded = await uploadDeliveryProof(activeDelivery.id, blob);
      setPhotoDrafts((current) => [...current, { uri: uploaded.signedUrl ?? picture.uri, path: uploaded.path }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : deliveryAlertT('delivery.alert.photoUploadFailed'));
    } finally {
      setBusy(false);
    }
  }, [activeDelivery, deliveryAlertT, photoDrafts.length]);

  const completeDelivery = useCallback(async () => {
    if (!activeDelivery || !supabase) return;

    const proofPaths = photoDrafts.map((photo) => photo.path).filter((path): path is string => Boolean(path));
    if (proofPaths.length === 0) {
      Alert.alert(deliveryAlertT('delivery.alert.photoRequired.title'), deliveryAlertT('delivery.alert.photoRequired.body'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const token = activeDelivery.confirm_token ?? createToken();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      if (!userId) {
        throw new Error(deliveryAlertT('delivery.alert.driverSessionMissing'));
      }

      const { error: updateError } = await supabase
        .schema('transacties')
        .rpc('complete_delivery_for_current_user', {
          p_delivery_id: activeDelivery.id,
          p_foto_bewijs: proofPaths,
          p_confirm_token: token,
        });

      if (updateError) {
        throw updateError;
      }

      Alert.alert(
        deliveryAlertT('delivery.alert.registered.title'),
        deliveryAlertT('delivery.alert.registered.body', { url: `https://app.taze.to/confirm-delivery?token=${token}` })
      );
      setActiveDelivery(null);
      setPhotoDrafts([]);
      await fetchDeliveries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : deliveryAlertT('delivery.alert.saveFailed'));
    } finally {
      setBusy(false);
    }
  }, [activeDelivery, deliveryAlertT, fetchDeliveries, photoDrafts]);

  return (
    <ScrollView contentContainerStyle={styles.shell}>
      <TazeCard variant="panel" style={styles.heroCard}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <TazeBadge label="Chauffeur" tone="primary" icon="local-shipping" />
            <ThemedText type="title" style={styles.title}>
              Leveringen
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Registreer foto’s, zet geleverd_op en maak een klantbevestigingslink klaar.
            </ThemedText>
          </View>
          <TazeButton label="Vernieuw" icon="refresh" variant="secondary" onPress={fetchDeliveries} disabled={loading || busy} />
        </View>
        {!canUseDelivery ? (
          <View style={styles.warningBox}>
            <MaterialIcons name="lock" size={18} color="#9a3412" />
            <ThemedText style={styles.warningText}>
              Deze pagina is bedoeld voor Chauffeur of gebruikers met delivery.update_status.
            </ThemedText>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={18} color="#b91c1c" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}
      </TazeCard>

      {activeDelivery ? (
        <TazeCard variant="muted" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Foto bewijs" tone="info" icon="photo-camera" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Levering {activeDelivery.order_id ?? activeDelivery.id.slice(0, 8)}
            </ThemedText>
          </View>
          <View style={styles.cameraFrame}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          </View>
          <View style={styles.photoGrid}>
            {photoDrafts.map((photo) => (
              <Image key={photo.path ?? photo.uri} source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
            ))}
          </View>
          <View style={styles.actionRow}>
            <TazeButton label="Foto nemen" icon="photo-camera" variant="secondary" onPress={capturePhoto} disabled={busy || photoDrafts.length >= 3} />
            <TazeButton label="Levering afronden" icon="check-circle" variant="primary" onPress={completeDelivery} disabled={busy || photoDrafts.length === 0} />
            <TazeButton label="Annuleer" icon="close" variant="ghost" onPress={() => setActiveDelivery(null)} disabled={busy} />
          </View>
        </TazeCard>
      ) : (
        <TazeCard variant="muted" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <TazeBadge label="Openstaand" tone="success" icon="assignment" />
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Mijn leveringen
            </ThemedText>
          </View>
          {loading ? (
            <ThemedText style={styles.mutedText}>{deliveryAlertT('delivery.alert.loading')}</ThemedText>
          ) : deliveries.length > 0 ? (
            deliveries.map((delivery) => (
              <View key={delivery.id} style={styles.deliveryCard}>
                <View style={styles.deliveryCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.deliveryTitle}>
                    Order {delivery.order_id ?? delivery.id.slice(0, 8)}
                  </ThemedText>
                  <ThemedText style={styles.mutedText}>Geleverd: {formatDate(delivery.geleverd_op, uiLanguage)}</ThemedText>
                  <ThemedText style={styles.mutedText}>
                    Klant bevestigd: {delivery.klant_bevestigd ? 'ja' : 'nee'}
                  </ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start levering"
                  onPress={() => startDelivery(delivery)}
                  style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}>
                  <MaterialIcons name="play-arrow" size={20} color="#fff" />
                  <ThemedText style={styles.startButtonText}>Start levering</ThemedText>
                </Pressable>
              </View>
            ))
          ) : (
            <ThemedText style={styles.mutedText}>Geen open leveringen voor deze chauffeur.</ThemedText>
          )}
        </TazeCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 14,
    padding: 16,
    paddingBottom: 120,
  },
  heroCard: {
    gap: 14,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    maxWidth: 720,
    gap: 8,
  },
  title: {
    color: Brand.ink,
  },
  subtitle: {
    color: Brand.inkMuted,
    lineHeight: 21,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: '#9a3412',
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: '#b91c1c',
  },
  sectionCard: {
    gap: 14,
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
  cameraFrame: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.2)',
    backgroundColor: '#020617',
  },
  camera: {
    width: '100%',
    minHeight: 340,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  actionRow: {
    gap: 10,
  },
  deliveryCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 14,
  },
  deliveryCopy: {
    gap: 5,
  },
  deliveryTitle: {
    color: Brand.ink,
  },
  mutedText: {
    color: Brand.inkMuted,
  },
  startButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: Brand.primaryStrong,
    paddingHorizontal: 14,
  },
  startButtonPressed: {
    opacity: 0.86,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});

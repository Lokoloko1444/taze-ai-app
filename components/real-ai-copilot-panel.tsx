import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { Brand } from 'constants/theme';
import { type RealAiResponse } from 'lib/real-ai';
import { TazeButton } from 'components/taze-button';
import { TazeBadge } from 'components/taze-badge';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';

type Props = {
  title: string;
  hint: string;
  buttonLabel: string;
  loading: boolean;
  onAsk: () => void;
  result: RealAiResponse | null;
  error: string | null;
  onOpenRoute: (route: RealAiResponse['recommendedRoute']) => void;
  onApplyAction?: (action: NonNullable<RealAiResponse['action']>) => void;
  onOpenTransportPartner?: () => void;
  onSaveTransportPreference?: (kind: 'favorite' | 'default') => void;
  onRemoveTransportPreference?: (kind: 'favorite' | 'default') => void;
};

export function RealAiCopilotPanel({
  title,
  hint,
  buttonLabel,
  loading,
  onAsk,
  result,
  error,
  onOpenRoute,
  onOpenTransportPartner,
  onSaveTransportPreference,
  onRemoveTransportPreference,
}: Props) {
  return (
    <RealAiCopilotPanelContent
      title={title}
      hint={hint}
      buttonLabel={buttonLabel}
      loading={loading}
      onAsk={onAsk}
      result={result}
      error={error}
      onOpenRoute={onOpenRoute}
      onOpenTransportPartner={onOpenTransportPartner}
      onSaveTransportPreference={onSaveTransportPreference}
      onRemoveTransportPreference={onRemoveTransportPreference}
    />
  );
}

function RealAiCopilotPanelContent({
  title,
  hint,
  buttonLabel,
  loading,
  onAsk,
  result,
  error,
  onOpenRoute,
  onOpenTransportPartner,
  onSaveTransportPreference,
  onRemoveTransportPreference,
}: Props) {
  const transportMeta = result?.transportMeta ?? null;
  const { isCompact } = useResponsiveLayout();

  return (
    <ThemedView style={[styles.panel, isCompact && styles.panelCompact]}>
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <View style={styles.headerCopy}>
          <View style={styles.badge}>
            <MaterialIcons name="smart-toy" size={16} color={Brand.primary} />
            <ThemedText type="defaultSemiBold" style={styles.badgeText}>
              Echte AI
            </ThemedText>
          </View>
          <ThemedText type="defaultSemiBold">{title}</ThemedText>
          <ThemedText style={styles.hint}>{hint}</ThemedText>
        </View>
        <TazeButton
          icon={loading ? 'hourglass-top' : 'auto-awesome'}
          label={loading ? 'AI denkt...' : buttonLabel}
          onPress={onAsk}
          variant="primary"
          style={[loading ? styles.askButtonBusy : undefined, isCompact && styles.askButtonCompact]}
        />
      </View>

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <ThemedText type="defaultSemiBold">{result.title}</ThemedText>
            <View style={styles.modelBadge}>
              <ThemedText type="defaultSemiBold" style={styles.modelBadgeText}>
                {result.model}
              </ThemedText>
            </View>
          </View>
          <ThemedText>{result.answer}</ThemedText>
          {transportMeta ? (
            <View style={styles.transportMetaBlock}>
              <ThemedText type="defaultSemiBold" style={styles.transportMetaTitle}>
                Transportstatus
              </ThemedText>
              <View style={styles.transportMetaRow}>
                <TazeBadge label={transportMeta.partnerLabel} tone="success" />
                {transportMeta.isDefault ? <TazeBadge label="Standaard" tone="success" /> : null}
                {transportMeta.favoriteCount > 0 ? <TazeBadge label="Favoriet" tone="accent" /> : null}
                {transportMeta.syncState === 'synced' ? <TazeBadge label="Synced" tone="success" /> : null}
                {transportMeta.syncState === 'queued' ? <TazeBadge label="Wachtrij" tone="warning" /> : null}
                {transportMeta.syncState === 'local' ? <TazeBadge label="Lokaal" tone="neutral" /> : null}
              </View>
              {transportMeta.statusSummary ? (
                <ThemedText style={styles.transportMetaText}>Status: {transportMeta.statusSummary}</ThemedText>
              ) : null}
              {transportMeta.syncSummary ? (
                <ThemedText style={styles.transportMetaText}>Sync: {transportMeta.syncSummary}</ThemedText>
              ) : null}
              {onOpenTransportPartner || onSaveTransportPreference || onRemoveTransportPreference ? (
                <View style={styles.transportMetaActions}>
                  {onOpenTransportPartner ? (
                    <TazeButton
                      label={`Open ${transportMeta.partnerLabel}`}
                      icon="launch"
                      variant="secondary"
                      onPress={onOpenTransportPartner}
                    />
                  ) : null}
                  {transportMeta.favoriteCount > 0 ? (
                    onRemoveTransportPreference ? (
                      <TazeButton
                        label="Verwijder favoriet"
                        icon="heart-broken"
                        variant="ghost"
                        onPress={() => onRemoveTransportPreference('favorite')}
                      />
                    ) : null
                  ) : onSaveTransportPreference ? (
                    <TazeButton
                      label="Bewaar favoriet"
                      icon="favorite-border"
                      variant="ghost"
                      onPress={() => onSaveTransportPreference('favorite')}
                    />
                  ) : null}
                  {transportMeta.isDefault ? (
                    onRemoveTransportPreference ? (
                      <TazeButton
                        label="Verwijder standaard"
                        icon="remove-circle-outline"
                        variant="ghost"
                        onPress={() => onRemoveTransportPreference('default')}
                      />
                    ) : null
                  ) : onSaveTransportPreference ? (
                    <TazeButton
                      label="Zet als standaard"
                      icon="check-circle-outline"
                      variant="ghost"
                      onPress={() => onSaveTransportPreference('default')}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.advisoryNote}>
            <ThemedText type="defaultSemiBold" style={styles.advisoryNoteTitle}>
              RIA geeft advies, geen besluit
            </ThemedText>
            <ThemedText style={styles.advisoryNoteText}>
              Gebruik het antwoord als richting. Uitvoering, toewijzing en mutatie blijven bij de mens of de bevoegde persoon.
            </ThemedText>
          </View>
          <View style={[styles.actionRow, isCompact && styles.actionRowCompact]}>
            <TazeButton
              label={result.recommendedLabel}
              onPress={() => onOpenRoute(result.recommendedRoute)}
              variant="primary"
            />
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorCard}>
          <ThemedText type="defaultSemiBold">Live AI-antwoord nog niet beschikbaar</ThemedText>
          <ThemedText>{error}</ThemedText>
          <ThemedText style={styles.errorHint}>
            Controleer de serververbinding of probeer het opnieuw.
          </ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.panelBorder,
    backgroundColor: Brand.panel,
    padding: 16,
    gap: 12,
  },
  panelCompact: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  headerCompact: {
    alignItems: 'stretch',
  },
  headerCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: Brand.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: Brand.primary,
    fontSize: 12,
  },
  hint: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  askButtonBusy: {
    opacity: 0.85,
  },
  askButtonCompact: {
    width: '100%',
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.panelBorder,
    backgroundColor: Brand.white,
    padding: 14,
    gap: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  modelBadge: {
    borderRadius: 999,
    backgroundColor: Brand.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modelBadgeText: {
    color: Brand.accent,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionRowCompact: {
    flexDirection: 'column',
  },
  transportMetaBlock: {
    gap: 8,
  },
  transportMetaTitle: {
    color: Brand.ink,
    fontSize: 13,
  },
  transportMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transportMetaText: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  transportMetaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advisoryNote: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(248,250,252,0.92)',
    padding: 12,
  },
  advisoryNoteTitle: {
    color: Brand.ink,
    fontSize: 13,
  },
  advisoryNoteText: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: 14,
    gap: 6,
  },
  errorHint: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
});

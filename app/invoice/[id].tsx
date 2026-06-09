import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { useAuth } from 'lib/auth-context';
import {
  appendInvoiceEvent,
  getCachedInvoiceEvents,
  loadInvoiceEvents,
  syncInvoiceEvents,
  subscribeInvoiceEvents,
  type InvoiceEventRecord,
} from 'lib/invoice-event-log';
import { getServerBaseUrl } from 'lib/server-url';
import { getPermissionMessage, hasPermission } from 'lib/role-permissions';
import { loadInvoiceHistory, syncInvoiceHistory, updateInvoiceDraft, type InvoiceDraftRecord } from 'lib/invoice-history';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('nl-BE');
}

function getStatusTone(status: InvoiceDraftRecord['status']) {
  if (status === 'paid') return 'success' as const;
  if (status === 'sent') return 'warning' as const;
  if (status === 'ready') return 'info' as const;
  return 'neutral' as const;
}

function getSyncTone(syncState: InvoiceDraftRecord['syncState']) {
  if (syncState === 'synced') return 'success' as const;
  if (syncState === 'queued') return 'warning' as const;
  return 'neutral' as const;
}

function getEventSyncTone(syncState: InvoiceEventRecord['syncState']) {
  if (syncState === 'synced') return 'success' as const;
  if (syncState === 'queued') return 'warning' as const;
  return 'neutral' as const;
}

function getInvoiceTimelineTone(kind: 'saved' | 'synced' | InvoiceEventRecord['kind'], syncState: InvoiceEventRecord['syncState'] | InvoiceDraftRecord['syncState']) {
  if (kind === 'status_paid') return 'success' as const;
  if (kind === 'mail_sent' || kind === 'status_sent') return 'info' as const;
  if (kind === 'sync_retry') return 'warning' as const;
  if (kind === 'synced') return getSyncTone(syncState as InvoiceDraftRecord['syncState']);
  return getEventSyncTone(syncState as InvoiceEventRecord['syncState']);
}

function getInvoiceReturnUrl(invoiceId: string, status: 'success' | 'cancel') {
  const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://app.taze.to';
  return `${origin}/invoice/${encodeURIComponent(invoiceId)}?checkout=${status}`;
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { email, role } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceDraftRecord | null>(null);
  const [invoiceEvents, setInvoiceEvents] = useState<InvoiceEventRecord[]>(() => getCachedInvoiceEvents());
  const [busy, setBusy] = useState(false);
  const serverBaseUrl = useMemo(() => getServerBaseUrl(), []);
  const canManageFinance = useMemo(
    () => hasPermission({ permission: 'manage_finance', role, email }),
    [email, role]
  );

  const refresh = useCallback(async () => {
    const entries = await loadInvoiceHistory();
    const match = entries.find((entry) => entry.id === id) ?? null;
    setInvoice(match);
  }, [id]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    syncInvoiceHistory()
      .then((entries) => {
        const match = entries.find((entry) => entry.id === id) ?? null;
        setInvoice(match);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    loadInvoiceEvents()
      .then(async (entries) => {
        if (!cancelled) {
          setInvoiceEvents(entries);
        }
        const syncedEntries = await syncInvoiceEvents();
        if (!cancelled) {
          setInvoiceEvents(syncedEntries);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeInvoiceEvents((entries) => {
      if (!cancelled) {
        setInvoiceEvents(entries);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const appendStatusEvent = useCallback(async (targetInvoice: InvoiceDraftRecord, status: InvoiceDraftRecord['status']) => {
    if (status !== 'sent' && status !== 'paid') {
      return;
    }
    await appendInvoiceEvent({
      invoiceId: targetInvoice.id,
      invoiceNumber: targetInvoice.invoiceNumber,
      kind: status === 'paid' ? 'status_paid' : 'status_sent',
      label: status === 'paid' ? 'Status betaald' : 'Status verzonden',
      detail:
        status === 'paid'
          ? 'Status automatisch bijgewerkt naar betaald in het detailscherm.'
          : 'Status automatisch bijgewerkt naar verzonden in het detailscherm.',
    });
  }, []);

  const updateStatus = useCallback(
    async (status: InvoiceDraftRecord['status']) => {
      if (!invoice) return;
      if (!canManageFinance) {
        Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
        return;
      }
      setBusy(true);
      try {
        await updateInvoiceDraft(invoice.id, { status });
        await appendStatusEvent(invoice, status);
        await refresh();
      } catch {
        Alert.alert('Status mislukt', 'De factuurstatus kon niet worden bijgewerkt.');
      } finally {
        setBusy(false);
      }
    },
    [appendStatusEvent, canManageFinance, invoice, refresh]
  );

  const sendInvoice = useCallback(async () => {
    if (!invoice) return;
    if (!canManageFinance) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${serverBaseUrl}/api/invoices/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        const error = typeof data?.error === 'string' ? data.error : 'invoice_mail_failed';
        if (error === 'invoice_mail_not_configured') {
          Alert.alert('Mail niet ingesteld', 'Configureer BREVO_API_KEY en BREVO_SENDER_EMAIL op de server.');
        } else if (error === 'invalid_email') {
          Alert.alert('E-mail ongeldig', 'Controleer het facturatieadres van deze klant.');
        } else {
          Alert.alert('Verzenden mislukt', 'De server kon deze factuur nu niet mailen.');
        }
        return;
      }

      await updateInvoiceDraft(invoice.id, { status: 'sent' });
      await appendStatusEvent(invoice, 'sent');
      await appendInvoiceEvent({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        kind: 'mail_sent',
        label: 'Mail verstuurd',
        detail: `Factuur succesvol verstuurd naar ${invoice.invoiceEmail} via de serverflow.${typeof data?.messageId === 'string' && data.messageId ? ` Provider ref: ${data.messageId}.` : ''}`,
      });
      await refresh();
      Alert.alert('Factuur verzonden', `Factuur ${invoice.invoiceNumber} is via de server verstuurd.`);
    } catch {
      Alert.alert('Server niet bereikbaar', 'De factuur kon niet via de server verstuurd worden.');
    } finally {
      setBusy(false);
    }
  }, [appendStatusEvent, canManageFinance, invoice, refresh, serverBaseUrl]);

  const startStripeCheckout = useCallback(async () => {
    if (!invoice) return;
    if (!canManageFinance) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      return;
    }
    if (invoice.status === 'paid') {
      Alert.alert('Al betaald', 'Deze factuur staat al op betaald.');
      return;
    }

    const amount = Math.round(invoice.monthInvoiceTotal * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Bedrag ontbreekt', 'Deze factuur heeft geen positief totaalbedrag om via Stripe te betalen.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${serverBaseUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount,
          currency: 'eur',
          successUrl: getInvoiceReturnUrl(invoice.id, 'success'),
          cancelUrl: getInvoiceReturnUrl(invoice.id, 'cancel'),
          email: invoice.invoiceEmail?.trim() || email?.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        const reason = typeof data?.error === 'string' ? data.error : 'checkout_failed';
        const hint = typeof data?.hint === 'string' ? data.hint : '';
        Alert.alert('Stripe checkout mislukt', hint ? `${reason}: ${hint}` : 'De betaalpagina kon niet worden aangemaakt.');
        return;
      }

      const checkoutSessionId = typeof data.id === 'string' ? data.id.trim() : '';
      if (checkoutSessionId) {
        try {
          await updateInvoiceDraft(invoice.id, { checkoutSessionId, status: invoice.status === 'concept' ? 'ready' : invoice.status });
          await refresh();
        } catch {
          // De Stripe checkout mag doorgaan, ook als lokale factuurtracking niet meteen bijgewerkt raakt.
        }
      }

      const checkoutUrl = String(data.url);
      if (Platform.OS === 'web') {
        window.location.href = checkoutUrl;
        return;
      }

      await WebBrowser.openBrowserAsync(checkoutUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      Alert.alert('Stripe niet bereikbaar', 'De checkout kon nu niet worden gestart. Probeer opnieuw zodra de verbinding stabiel is.');
    } finally {
      setBusy(false);
    }
  }, [canManageFinance, email, invoice, refresh, serverBaseUrl]);

  if (!invoice) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.screen}>
          <TazeHero
            title="Factuurdetail"
            description="Open een bewaard factuurconcept vanuit payments om hier alle details en acties te zien."
            badgeLabel="Status"
            badgeValue="Niet gevonden"
            badgeText="Controleer of dit concept nog bestaat"
          />
          <TazeCard>
            <ThemedText type="defaultSemiBold">Geen factuur gevonden</ThemedText>
            <ThemedText>Dit concept bestaat niet meer of is nog niet geladen uit de historiek.</ThemedText>
            <TazeButton label="Terug naar payments" icon="arrow-back" onPress={() => router.push('/payments')} variant="secondary" />
          </TazeCard>
        </ThemedView>
      </ScrollView>
    );
  }

  const filteredEvents = invoiceEvents.filter((entry) => entry.invoiceId === invoice.id).slice(0, 12);
  const eventSyncSummary = filteredEvents.reduce(
    (summary, entry) => {
      summary[entry.syncState] += 1;
      return summary;
    },
    { local: 0, queued: 0, synced: 0 }
  );
  const paymentTimelineLabel = filteredEvents.find((entry) => entry.kind === 'status_paid')?.label ?? 'Nog niet betaald';
  const latestProviderEvent =
    filteredEvents.find((entry) => entry.kind === 'mail_sent')?.detail ??
    filteredEvents.find((entry) => entry.kind === 'status_sent')?.detail ??
    'Nog geen provider- of verzendevent gelogd.';
  const retryCount = filteredEvents.filter((entry) => entry.kind === 'sync_retry').length;
  const timelineEntries = [
    {
      id: `saved-${invoice.id}`,
      label: 'Concept opgeslagen',
      detail: `Concept bewaard via ${invoice.savedFrom}.`,
      timestamp: invoice.savedAt,
      tone: getInvoiceTimelineTone('saved', invoice.syncState),
      syncLabel: invoice.syncState === 'synced' ? 'BACKEND SYNCED' : invoice.syncState.toUpperCase(),
    },
    ...(invoice.lastSyncAt
      ? [
          {
            id: `invoice-sync-${invoice.id}`,
            label: invoice.syncState === 'synced' ? 'Backend sync voltooid' : 'Laatste syncpoging',
            detail:
              invoice.syncState === 'synced'
                ? 'De factuurkern staat in cloudsync.'
                : invoice.syncError || 'Deze factuur wacht nog op een volgende syncpoging.',
            timestamp: invoice.lastSyncAt,
            tone: getInvoiceTimelineTone('synced', invoice.syncState),
            syncLabel: invoice.syncState === 'synced' ? 'SYNCED' : invoice.syncState.toUpperCase(),
          },
        ]
      : []),
    ...filteredEvents.map((event) => ({
      id: event.id,
      label: event.label,
      detail: event.detail,
      timestamp: event.createdAt,
      tone: getInvoiceTimelineTone(event.kind, event.syncState),
      syncLabel: event.syncState === 'synced' ? 'SYNCED' : event.syncState.toUpperCase(),
      syncError: event.syncError,
    })),
  ].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  const runSyncNow = async () => {
    setBusy(true);
    try {
      await Promise.all([syncInvoiceHistory(), syncInvoiceEvents()]);
      await refresh();
      Alert.alert('Sync bijgewerkt', 'Factuurkern en eventlog zijn opnieuw naar de cloudlaag doorgestuurd.');
    } catch {
      Alert.alert('Sync mislukt', 'De cloudsync kon nu niet opnieuw uitgevoerd worden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title={`Factuur ${invoice.invoiceNumber}`}
          subtitle={invoice.invoiceTo}
          description="Volledige detailweergave voor finance, verzending en opvolging."
          badgeLabel="Totaal"
          badgeValue={formatCurrency(invoice.monthInvoiceTotal)}
          badgeText={`Vervaldag ${formatDate(invoice.dueDate)}`}
        />

        {!canManageFinance ? (
          <TazeCard style={styles.notice}>
            <ThemedText type="defaultSemiBold">Alleen-lezen</ThemedText>
            <ThemedText>{getPermissionMessage('manage_finance')}</ThemedText>
          </TazeCard>
        ) : null}

        <View style={styles.badgeRow}>
          <TazeBadge label={invoice.status.toUpperCase()} tone={getStatusTone(invoice.status)} />
          <TazeBadge label={invoice.syncState === 'synced' ? 'BACKEND SYNCED' : invoice.syncState.toUpperCase()} tone={getSyncTone(invoice.syncState)} />
          <TazeBadge label={invoice.savedFrom.toUpperCase()} tone="accent" />
        </View>

        <View style={styles.timelineSummaryRow}>
          <View style={styles.metaCard}>
            <ThemedText style={styles.metaLabel}>Betaalflow</ThemedText>
            <ThemedText type="defaultSemiBold">{paymentTimelineLabel}</ThemedText>
            <ThemedText style={styles.syncCopy}>
              {invoice.status === 'paid' ? 'Factuur staat volledig op betaald.' : 'Betaalstatus volgt nog of wacht op bevestiging.'}
            </ThemedText>
          </View>
          <View style={styles.metaCard}>
            <ThemedText style={styles.metaLabel}>Provider / verzending</ThemedText>
            <ThemedText type="defaultSemiBold">{filteredEvents.some((entry) => entry.kind === 'mail_sent') ? 'Mailflow aanwezig' : 'Nog geen mailflow'}</ThemedText>
            <ThemedText style={styles.syncCopy}>{latestProviderEvent}</ThemedText>
          </View>
          <View style={styles.metaCard}>
            <ThemedText style={styles.metaLabel}>Retries</ThemedText>
            <ThemedText type="defaultSemiBold">{retryCount}</ThemedText>
            <ThemedText style={styles.syncCopy}>
              {retryCount > 0 ? 'Er zijn eerdere sync- of recoverypogingen gelogd.' : 'Nog geen retry nodig geweest.'}
            </ThemedText>
          </View>
        </View>

        <TazeCard style={styles.section}>
          <TazeSectionHeader
            title="Cloud sync"
            subtitle="Supabase-ready status voor factuurkern en eventlog."
            badge="Sync"
            badgeTone="accent"
          />
          <View style={styles.syncGrid}>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Factuurrecord</ThemedText>
              <TazeBadge
                label={invoice.syncState === 'synced' ? 'SYNCED' : invoice.syncState.toUpperCase()}
                tone={getSyncTone(invoice.syncState)}
              />
              <ThemedText style={styles.syncCopy}>
                {invoice.syncState === 'synced'
                  ? `Laatste sync: ${formatDate(invoice.lastSyncAt ?? invoice.savedAt)}`
                  : invoice.syncError || 'Nog lokaal of in wachtrij tot cloudsync beschikbaar is.'}
              </ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Eventlog</ThemedText>
              <View style={styles.badgeRow}>
                <TazeBadge label={`${eventSyncSummary.synced} synced`} tone="success" />
                <TazeBadge label={`${eventSyncSummary.queued} queued`} tone="warning" />
                <TazeBadge label={`${eventSyncSummary.local} local`} tone="neutral" />
              </View>
              <ThemedText style={styles.syncCopy}>
                {filteredEvents.length > 0
                  ? `${filteredEvents.length} event(s) gekoppeld aan deze factuur.`
                  : 'Nog geen aparte factuurevents gelogd.'}
              </ThemedText>
            </View>
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader title="Factuurkern" badge="Core" badgeTone="primary" />
          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Factuurnummer</ThemedText>
              <ThemedText type="defaultSemiBold">{invoice.invoiceNumber}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Betaalreferentie</ThemedText>
              <ThemedText type="defaultSemiBold">{invoice.paymentReference}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Klant</ThemedText>
              <ThemedText type="defaultSemiBold">{invoice.invoiceTo}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Facturatie e-mail</ThemedText>
              <ThemedText type="defaultSemiBold">{invoice.invoiceEmail}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Vervaldag</ThemedText>
              <ThemedText type="defaultSemiBold">{formatDate(invoice.dueDate)}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Bewaard op</ThemedText>
              <ThemedText type="defaultSemiBold">{formatDate(invoice.savedAt)}</ThemedText>
            </View>
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader title="Bedragen" badge="Financiën" badgeTone="accent" />
          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Omzet</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(invoice.monthRevenue)}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Food cost</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(invoice.monthFoodCost)}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>Verlies</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(invoice.monthLoss)}</ThemedText>
            </View>
            <View style={styles.metaCard}>
              <ThemedText style={styles.metaLabel}>BTW</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(invoice.monthVatAmount)}</ThemedText>
            </View>
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader title="Acties" badge="Flow" badgeTone="info" />
          <View style={styles.actions}>
            <TazeButton label="Betalen via Stripe" icon="payments" onPress={() => startStripeCheckout().catch(() => {})} disabled={busy || !canManageFinance || invoice.status === 'paid'} variant="primary" />
            <TazeButton label="Verzend via server" icon="send" onPress={() => sendInvoice().catch(() => {})} disabled={busy || !canManageFinance} variant="primary" />
            <TazeButton label="Sync opnieuw" icon="sync" onPress={() => runSyncNow().catch(() => {})} disabled={busy} variant="secondary" />
            <TazeButton label="Markeer verzonden" icon="send" onPress={() => updateStatus('sent').catch(() => {})} disabled={busy || !canManageFinance} variant="ghost" />
            <TazeButton label="Markeer betaald" icon="check-circle" onPress={() => updateStatus('paid').catch(() => {})} disabled={busy || !canManageFinance} variant="secondary" />
            <TazeButton label="Terug naar payments" icon="arrow-back" onPress={() => router.push('/payments')} variant="secondary" />
          </View>
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader title="Tijdlijn" subtitle="Van concept tot sync en verzending." badge="Audit" badgeTone="warning" />
          {timelineEntries.length > 0 ? (
            <View style={styles.eventList}>
              {timelineEntries.map((entry) => (
                <View key={entry.id} style={[styles.timelineRow, styles.eventCard]}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: entry.tone === 'success' ? '#16a34a' : entry.tone === 'warning' ? '#d97706' : entry.tone === 'info' ? '#2563eb' : '#64748b' }]} />
                    <View style={styles.timelineLine} />
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.eventHeader}>
                      <ThemedText type="defaultSemiBold" style={styles.eventTitle}>
                        {entry.label}
                      </ThemedText>
                      <TazeBadge label={entry.syncLabel} tone={entry.tone} />
                    </View>
                    <ThemedText style={styles.metaLabel}>{formatDate(entry.timestamp)}</ThemedText>
                    <ThemedText>{entry.detail}</ThemedText>
                    {'syncError' in entry && entry.syncError ? (
                      <ThemedText style={styles.eventError}>{entry.syncError}</ThemedText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText>Nog geen tijdlijnitems voor dit dossier.</ThemedText>
          )}
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader title="Ruwe eventlog" badge="Events" badgeTone="neutral" />
          {filteredEvents.length > 0 ? (
            <View style={styles.eventList}>
              {filteredEvents.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <ThemedText type="defaultSemiBold" style={styles.eventTitle}>
                      {event.label}
                    </ThemedText>
                    <TazeBadge
                      label={event.syncState === 'synced' ? 'SYNCED' : event.syncState.toUpperCase()}
                      tone={getEventSyncTone(event.syncState)}
                    />
                  </View>
                  <ThemedText style={styles.metaLabel}>{formatDate(event.createdAt)}</ThemedText>
                  <ThemedText>{event.detail}</ThemedText>
                  {event.syncError ? <ThemedText style={styles.eventError}>{event.syncError}</ThemedText> : null}
                </View>
              ))}
            </View>
          ) : (
            <ThemedText>Nog geen factuurevents voor dit dossier.</ThemedText>
          )}
        </TazeCard>

        <TazeCard style={styles.section}>
          <TazeSectionHeader title="Preview" badge="TXT" badgeTone="neutral" />
          <View style={styles.previewBox}>
            <ThemedText style={styles.previewText}>{invoice.previewText}</ThemedText>
          </View>
        </TazeCard>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  screen: {
    gap: 18,
  },
  notice: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    gap: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  syncGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timelineSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 4,
  },
  syncCopy: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 18,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  eventList: {
    gap: 10,
  },
  eventCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  timelineRail: {
    width: 16,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e2e8f0',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 4,
  },
  eventHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    minWidth: 160,
  },
  eventError: {
    color: '#b91c1c',
    fontSize: 12,
  },
  previewBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
  },
  previewText: {
    color: '#0f172a',
    fontSize: 12,
    lineHeight: 20,
  },
});


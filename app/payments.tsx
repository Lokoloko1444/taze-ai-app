import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';

import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeHero } from 'components/taze-hero';
import { TazeInput } from 'components/taze-input';
import { TazeSectionHeader } from 'components/taze-section-header';
import { TazeStatusPill } from 'components/taze-status-pill';
import { Brand, BrandIdentity } from 'constants/theme';
import { getInventoryMetrics, useInventory } from 'hooks/use-inventory';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { useAuth } from 'lib/auth-context';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { TazeLogo } from 'components/taze-logo';
import { getItem, setItem } from 'lib/app-storage';
import {
  loadInvoiceHistory,
  saveInvoiceDraft,
  syncInvoiceHistory,
  updateInvoiceDraft,
  type InvoiceDraftRecord,
} from 'lib/invoice-history';
import { appendInvoiceEvent } from 'lib/invoice-event-log';
import { getPermissionMessage, hasPermission } from 'lib/role-permissions';
import { requestRealAi, type RealAiAvailableAction, type RealAiResponse } from 'lib/real-ai';
import { getServerBaseUrl } from 'lib/server-url';
import { LegalConfig } from 'lib/legal-config';
import { secureGetItem, secureSetItem } from 'lib/secure-storage';
import { buildSepaEpcPayload, isProbablyBic, isProbablyIban } from 'lib/sepa-epc';
import { unlockScanAccess } from 'lib/scan-access';
import { supabase } from 'lib/supabase';
import {
  getTransportRecommendation,
  topTransportAppHighlights,
  transportApps,
  type TransportApp,
  type TransportAppHighlight,
} from 'lib/transport-hub';
import {
  getCachedTransportPreferences,
  getDefaultTransportAppId,
  getTransportPreferenceForScope,
  loadTransportPreferences,
  removeTransportPreferenceByMatch,
  saveTransportPreference,
  subscribeTransportPreferences,
  syncTransportPreferences,
} from 'lib/transport-favorites';
import { buildTransportAiContext, buildTransportHubPath } from 'lib/transport-ai';
import { logTransportAudit } from 'lib/transport-audit';

type PaymentCategory = 'Alle' | 'Lokaal' | 'Kaarten' | 'Wallets' | 'Bank' | 'Zakelijk' | 'Later';
type CustomerType = 'Bedrijven' | 'Particulieren';
type BillingCycle = 'Maandelijks' | 'Kwartaal' | 'Jaarlijks';
type StripeCheckoutFailure =
  | 'stripe_not_configured'
  | 'price_not_configured'
  | 'bad_return_url'
  | 'stripe_price_invalid'
  | 'stripe_auth_error'
  | 'stripe_error'
  | 'network_error'
  | 'unknown';
type StripeCheckoutResult = { ok: true } | { ok: false; reason: StripeCheckoutFailure };
type StripeStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  hasAnyPrice: boolean;
  priceKeysConfigured: number;
  returnOrigins: string[];
  returnOriginsConfigured: boolean;
  checkoutReady: boolean;
};

type PendingCheckoutInvoice = {
  invoiceId: string;
  invoiceNumber: string;
  methodId: string;
  planId: string;
  checkoutSessionId?: string | null;
  createdAt: string;
};

type PaymentMethod = {
  id: string;
  label: string;
  category: Exclude<PaymentCategory, 'Alle'>;
  icon: keyof typeof MaterialIcons.glyphMap;
  detail: string;
  fee: string;
  speed: string;
  tone: string;
  surface: string;
};

type PlanKey = 'start' | 'werkvloer' | 'pro' | 'multi' | 'enterprise';

type PlanFeatureFlags = {
  canScan: boolean;
  canUsePhotoProof: boolean;
  canUseTrace: boolean;
  canUseAiSuggestions: boolean;
  canUseManagerDashboard: boolean;
  canUseOwnerDashboard: boolean;
  canUseMultiLocation: boolean;
  canUseExports: boolean;
  canUseApiIntegrations: boolean;
  canUseCustomRoles: boolean;
  canUseSlaSupport: boolean;
};

type HubAppLink = {
  id: string;
  label: string;
  url: string;
};

type PrijzenPlan = {
  id: PlanKey;
  audience: CustomerType;
  title: string;
  badge: string;
  target: string;
  description: string;
  cta: string;
  promise: string;
  monthlyPrice: number;
  yearlyPrice: number;
  onboardingFee: number;
  tone: string;
  surface: string;
  features: string[];
  featureFlags: PlanFeatureFlags;
};

const paymentCategories: PaymentCategory[] = [
  'Alle',
  'Lokaal',
  'Kaarten',
  'Wallets',
  'Bank',
  'Zakelijk',
  'Later',
];

const paymentMethods: PaymentMethod[] = [
  {
    id: 'bancontact',
    label: 'Bancontact',
    category: 'Lokaal',
    icon: 'payments',
    detail: 'Belgische standaard voor directe online betalingen.',
    fee: '1.4%',
    speed: 'Direct',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'ideal',
    label: 'iDEAL',
    category: 'Lokaal',
    icon: 'account-balance',
    detail: 'Populaire bankbetaling voor Nederland.',
    fee: '1.2%',
    speed: 'Direct',
    tone: '#be185d',
    surface: '#fdf2f8',
  },
  {
    id: 'visa',
    label: 'Visa',
    category: 'Kaarten',
    icon: 'credit-card',
    detail: 'Internationale kaartbetaling voor retail en business.',
    fee: '2.1%',
    speed: 'Direct',
    tone: '#2563eb',
    surface: '#eff6ff',
  },
  {
    id: 'mastercard',
    label: 'Mastercard',
    category: 'Kaarten',
    icon: 'credit-score',
    detail: 'Breed ondersteunde kaart voor online betaling.',
    fee: '2.1%',
    speed: 'Direct',
    tone: '#ea580c',
    surface: '#fff7ed',
  },
  {
    id: 'maestro',
    label: 'Maestro',
    category: 'Kaarten',
    icon: 'credit-card',
    detail: 'Debetkaart voor snelle en lage-frictie betalingen.',
    fee: '1.8%',
    speed: 'Direct',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'amex',
    label: 'American Express',
    category: 'Kaarten',
    icon: 'workspace-premium',
    detail: 'Premium kaart voor zakelijke en internationale klanten.',
    fee: '2.9%',
    speed: 'Direct',
    tone: '#4338ca',
    surface: '#eef2ff',
  },
  {
    id: 'apple-pay',
    label: 'Apple Pay',
    category: 'Wallets',
    icon: 'phone-iphone',
    detail: 'Snelle wallet-betaling op Apple-apparaten.',
    fee: '2.0%',
    speed: 'Direct',
    tone: '#111827',
    surface: '#f3f4f6',
  },
  {
    id: 'google-pay',
    label: 'Mobiele wallet',
    category: 'Wallets',
    icon: 'phone-android',
    detail: 'Mobiele wallet voor web en Android betaling.',
    fee: '2.0%',
    speed: 'Direct',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    category: 'Wallets',
    icon: 'account-balance-wallet',
    detail: 'Wereldwijde wallet met vertrouwde consumentflow.',
    fee: '2.7%',
    speed: 'Direct',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'sepa',
    label: 'SEPA Overschrijving',
    category: 'Bank',
    icon: 'account-balance',
    detail: 'Bankoverschrijving voor grotere of geplande betalingen.',
    fee: '0.8%',
    speed: '1-2 dagen',
    tone: '#475569',
    surface: '#f8fafc',
  },
  {
    id: 'sofort',
    label: 'SOFORT',
    category: 'Bank',
    icon: 'receipt-long',
    detail: 'Realtime bankflow voor Duitsland en omliggende markten.',
    fee: '1.6%',
    speed: 'Direct',
    tone: '#7c2d12',
    surface: '#fef2f2',
  },
  {
    id: 'partner-invoice',
    label: 'Partnerfactuur',
    category: 'Zakelijk',
    icon: 'business-center',
    detail: 'Facturatie voor vaste leveranciers en B2B-partners.',
    fee: '0.6%',
    speed: '7-30 dagen',
    tone: '#7c3aed',
    surface: '#f5f3ff',
  },
  {
    id: 'subscription',
    label: 'Abonnement',
    category: 'Zakelijk',
    icon: 'autorenew',
    detail: 'Terugkerende betalingen voor software en servicecontracten.',
    fee: '1.1%',
    speed: 'Automatisch',
    tone: '#0369a1',
    surface: '#f0f9ff',
  },
  {
    id: 'klarna',
    label: 'Klarna',
    category: 'Later',
    icon: 'schedule',
    detail: 'Koop nu, betaal later voor flexibele klantbetaling.',
    fee: '3.2%',
    speed: 'Direct akkoord',
    tone: '#db2777',
    surface: '#fdf2f8',
  },
  {
    id: 'riverty',
    label: 'Riverty',
    category: 'Later',
    icon: 'event-note',
    detail: 'Achteraf betalen voor zakelijke en consumententransacties.',
    fee: '3.0%',
    speed: 'Direct akkoord',
    tone: '#9333ea',
    surface: '#faf5ff',
  },
];

const customerTypes: CustomerType[] = ['Bedrijven'];
const billingCycles: BillingCycle[] = ['Maandelijks', 'Jaarlijks'];

function getPlanPriceByBillingCycle(plan: PrijzenPlan | undefined, cycle: BillingCycle) {
  if (!plan) return 0;
  if (cycle === 'Jaarlijks') return plan.yearlyPrice > 0 ? plan.yearlyPrice : plan.monthlyPrice;
  if (cycle === 'Kwartaal') return Math.round(plan.monthlyPrice * 3 * 0.95 * 100) / 100;
  return plan.monthlyPrice;
}

function getBillingCycleLabel(cycle: BillingCycle) {
  if (cycle === 'Jaarlijks') return 'Jaarprijs';
  if (cycle === 'Kwartaal') return 'Kwartaalprijs';
  return 'Maandprijs';
}

function getBillingCycleHint(cycle: BillingCycle) {
  if (cycle === 'Jaarlijks') return '12 maanden bundel';
  if (cycle === 'Kwartaal') return '3 maanden bundel';
  return 'Per maand';
}
const STRIPE_PAYMENT_METHODS_DASHBOARD_URL = 'https://dashboard.stripe.com/settings/payment_methods';
const PENDING_CHECKOUT_STORAGE_KEY = 'pending-checkout-invoice-v1';
const hubAppLinks: HubAppLink[] = [
  { id: 'ai-app', label: 'AI app', url: '/explore' },
  { id: 'taze-app', label: 'Taze', url: '/' },
  { id: 'amazon', label: 'Amazon', url: 'https://www.amazon.com' },
  { id: 'taze', label: 'Taze', url: 'https://taze.to' },
  { id: 'chuxing', label: 'Chuxing', url: 'https://www.didiglobal.com' },
  ...transportApps.map((item) => ({ id: item.id, label: item.label, url: item.url })),
];

const pricingPlans: PrijzenPlan[] = [
  {
    id: 'start',
    audience: 'Bedrijven',
    title: 'Taze Start',
    badge: 'Instap',
    target: 'Voor kleine zelfstandigen, foodtrucks, kleine cafés en eenvoudige stockcontrole.',
    description: 'Begin met scannen, kies een locatie en zie waar je voorraad staat zonder zware AI-laag.',
    cta: 'Start eenvoudig',
    promise: 'Begin met scannen en zie waar je voorraad staat.',
    monthlyPrice: 39,
    yearlyPrice: 390,
    onboardingFee: 0,
    tone: '#0f766e',
    surface: '#ecfeff',
    features: [
      '1 vestiging',
      '2 gebruikers',
      'Barcode/manual scan',
      'Basisvoorraad',
      'Locatiekeuze: Bar, Keuken, Koelcel, Transport',
      'Eenvoudige trace',
      'Basisrapport wat staat waar',
      'Basisstatus zonder zware AI',
    ],
    featureFlags: {
      canScan: true,
      canUsePhotoProof: false,
      canUseTrace: true,
      canUseAiSuggestions: false,
      canUseManagerDashboard: false,
      canUseOwnerDashboard: false,
      canUseMultiLocation: false,
      canUseExports: false,
      canUseApiIntegrations: false,
      canUseCustomRoles: false,
      canUseSlaSupport: false,
    },
  },
  {
    id: 'werkvloer',
    audience: 'Bedrijven',
    title: 'Taze Werkvloer',
    badge: 'Meest gekozen',
    target: 'Voor cafés, restaurants, kleine winkels en teams die echte werkvloercontrole willen.',
    description: 'Iedere scan krijgt een plaats, actie en bewijs zodat managers zien wat echt gebeurt.',
    cta: 'Meest gekozen',
    promise: 'Iedere scan krijgt een plaats, actie en bewijs.',
    monthlyPrice: 89,
    yearlyPrice: 890,
    onboardingFee: 0,
    tone: '#1d4ed8',
    surface: '#eff6ff',
    features: [
      '1 vestiging',
      'Tot 5 gebruikers',
      'Scan + foto',
      'Foto voor bewijs',
      'Acties: Toegekomen, Verplaatst, Verbruikt, Afgeleverd, Naar transport, Naar afval, Bijbestellen nodig',
      'Manageroverzicht',
      'Refresh/tweede toestel proof',
      'Basis AI-voorstellen en rapport per locatie',
    ],
    featureFlags: {
      canScan: true,
      canUsePhotoProof: true,
      canUseTrace: true,
      canUseAiSuggestions: true,
      canUseManagerDashboard: true,
      canUseOwnerDashboard: false,
      canUseMultiLocation: false,
      canUseExports: false,
      canUseApiIntegrations: false,
      canUseCustomRoles: false,
      canUseSlaSupport: false,
    },
  },
  {
    id: 'pro',
    audience: 'Bedrijven',
    title: 'Taze Pro',
    badge: 'AI + bewijs',
    target: 'Voor restaurants, bars, stockrooms, transportteams en groeiende bedrijven.',
    description: 'AI helpt met herkenning en controles, maar de werkvloer blijft beslissen.',
    cta: 'Voor teams met controle',
    promise: 'AI stelt voor, de werkvloer beslist, de manager controleert.',
    monthlyPrice: 149,
    yearlyPrice: 1490,
    onboardingFee: 0,
    tone: '#7c3aed',
    surface: '#f5f3ff',
    features: [
      '1 vestiging',
      'Tot 10 gebruikers',
      'Alles van Werkvloer',
      'AI-herkenning product/categorie',
      'AI-voorstel locatie en actie',
      "Bewijsfoto's per event",
      'Afwijkingen: lage voorraad, afval, schade, verval en transport',
      'Export rapporten, audit trail en bijbestellijst',
    ],
    featureFlags: {
      canScan: true,
      canUsePhotoProof: true,
      canUseTrace: true,
      canUseAiSuggestions: true,
      canUseManagerDashboard: true,
      canUseOwnerDashboard: true,
      canUseMultiLocation: false,
      canUseExports: true,
      canUseApiIntegrations: false,
      canUseCustomRoles: false,
      canUseSlaSupport: false,
    },
  },
  {
    id: 'multi',
    audience: 'Bedrijven',
    title: 'Taze Multi',
    badge: 'Meerdere locaties',
    target: 'Voor meerdere afdelingen, zones of locaties.',
    description: 'Volg voorraad, bewijs en transport over zones heen zonder losse lijsten.',
    cta: 'Voor meerdere locaties',
    promise: 'Van bar tot transport: elke beweging zichtbaar.',
    monthlyPrice: 249,
    yearlyPrice: 2490,
    onboardingFee: 0,
    tone: '#be185d',
    surface: '#fdf2f8',
    features: [
      'Tot 3 vestigingen/zones',
      'Tot 25 gebruikers',
      'Alles van Pro',
      'Voorraad per vestiging',
      'Transfer tussen locaties',
      'Transportbewijs',
      'Levering/aflevering bewijs',
      'Managerdashboard per locatie en owner-dashboard over alles',
    ],
    featureFlags: {
      canScan: true,
      canUsePhotoProof: true,
      canUseTrace: true,
      canUseAiSuggestions: true,
      canUseManagerDashboard: true,
      canUseOwnerDashboard: true,
      canUseMultiLocation: true,
      canUseExports: true,
      canUseApiIntegrations: false,
      canUseCustomRoles: false,
      canUseSlaSupport: true,
    },
  },
  {
    id: 'enterprise',
    audience: 'Bedrijven',
    title: 'Taze Enterprise',
    badge: 'Maatwerk',
    target: 'Voor grotere bedrijven, ketens, magazijnen, logistiek en productie.',
    description: 'Controleer voorraad, bewijs en bewegingen over de hele organisatie met maatwerkregels.',
    cta: 'Vraag offerte',
    promise: 'Controleer voorraad, bewijs en bewegingen over de hele organisatie.',
    monthlyPrice: 499,
    yearlyPrice: 0,
    onboardingFee: 0,
    tone: '#111827',
    surface: '#f8fafc',
    features: [
      'Maatwerk aantal vestigingen',
      'Maatwerk gebruikers',
      'API-koppelingen',
      'Rollen/rechten op maat',
      'Rapportage op maat',
      'Integratie met boekhouding/POS/ERP',
      'SLA/support en onboarding',
      'Audit/export en AI-regels per bedrijf',
    ],
    featureFlags: {
      canScan: true,
      canUsePhotoProof: true,
      canUseTrace: true,
      canUseAiSuggestions: true,
      canUseManagerDashboard: true,
      canUseOwnerDashboard: true,
      canUseMultiLocation: true,
      canUseExports: true,
      canUseApiIntegrations: true,
      canUseCustomRoles: true,
      canUseSlaSupport: true,
    },
  },
];

const pricingExtras = [
  'Extra gebruiker: EUR 9/maand',
  'Extra vestiging: EUR 49/maand',
  'Extra AI-herkenningsbundel: vanaf EUR 25/maand',
  "Extra opslag bewijsfoto's: vanaf EUR 15/maand",
  'Onboarding op afstand: EUR 199 eenmalig',
  'On-site setup: vanaf EUR 499',
  'Custom koppeling: offerte',
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function getTransactionStatusKind(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'betaald') return 'success' as const;
  if (normalized === 'in verwerking') return 'info' as const;
  if (normalized === 'gepland') return 'warning' as const;
  return 'pending' as const;
}

function getInvoiceStatusMeta(status: InvoiceDraftRecord['status']) {
  switch (status) {
    case 'ready':
      return { label: 'Klaar voor verzending', tone: 'info' as const };
    case 'sent':
      return { label: 'Verzonden', tone: 'warning' as const };
    case 'paid':
      return { label: 'Betaald', tone: 'success' as const };
    default:
      return { label: 'Concept', tone: 'neutral' as const };
  }
}

function getInvoiceSyncMeta(state: InvoiceDraftRecord['syncState']) {
  switch (state) {
    case 'synced':
      return { label: 'Backend synced', tone: 'success' as const };
    case 'queued':
      return { label: 'Sync wachtrij', tone: 'warning' as const };
    default:
      return { label: 'Lokaal', tone: 'neutral' as const };
  }
}

function getTransportPreferenceSyncMeta(state: 'local' | 'queued' | 'synced') {
  switch (state) {
    case 'synced':
      return { label: 'Voorkeur synced', tone: 'success' as const };
    case 'queued':
      return { label: 'Sync wachtrij', tone: 'warning' as const };
    default:
      return { label: 'Lokaal', tone: 'neutral' as const };
  }
}

function formatInvoiceDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('nl-BE');
}

function normalizeStripeStatus(payload: unknown): StripeStatus {
  const fallback: StripeStatus = {
    configured: false,
    webhookConfigured: false,
    hasAnyPrice: false,
    priceKeysConfigured: 0,
    returnOrigins: [],
    returnOriginsConfigured: false,
    checkoutReady: false,
  };
  if (!payload || typeof payload !== 'object') return fallback;

  const data = payload as Partial<Record<string, unknown>>;
  const returnOrigins = Array.isArray(data.returnOrigins)
    ? data.returnOrigins
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
    : [];

  return {
    configured: Boolean(data.configured),
    webhookConfigured: Boolean(data.webhookConfigured),
    hasAnyPrice: Boolean(data.hasAnyPrice),
    priceKeysConfigured: Number(data.priceKeysConfigured ?? 0) || 0,
    returnOrigins,
    returnOriginsConfigured: Boolean(data.returnOriginsConfigured),
    checkoutReady: Boolean(data.checkoutReady),
  };
}

function buildPaymentsTransportFollowupLabel(partnerLabel: string, scopeLabel: string, methodLabel: string, customerType: CustomerType) {
  if (scopeLabel.toLowerCase().includes('zakelijk')) {
    return `${partnerLabel} geopend voor zakelijke transportkeuze. Volgende stap: bevestig nu factuur- of betaalflow voor ${customerType.toLowerCase()}.`;
  }
  if (methodLabel) {
    return `${partnerLabel} geopend voor ${scopeLabel.toLowerCase()}. Volgende stap: rond nu ${methodLabel.toLowerCase()} of facturatie af.`;
  }
  return `${partnerLabel} geopend voor ${scopeLabel.toLowerCase()}. Volgende stap: werk nu betaling of factuurkeuze af.`;
}

export default function PaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkout?: string }>();
  const { email, role } = useAuth();
  const { items, financeEntries, locations } = useInventory();
  const metrics = getInventoryMetrics(items);
  const { pageMaxWidth, pagePadding } = useResponsiveLayout();
  const [customerType, setCustomerType] = useState<CustomerType>('Bedrijven');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('Maandelijks');
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory>('Alle');
  const [selectedPlanId, setSelectedPlanId] = useState<PlanKey>('werkvloer');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('bancontact');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'processing' | 'done'>('idle');
  const [advicePinned, setAdvicePinned] = useState(false);
  const [invoiceTo, setInvoiceTo] = useState('Klantbedrijf BV');
  const [invoiceVat, setInvoiceVat] = useState('BE0123456789');
  const [invoiceEmail, setInvoiceEmail] = useState('facturatie@klant.be');
  const [invoiceCountry, setInvoiceCountry] = useState('BE');
  const [invoiceVatRate, setInvoiceVatRate] = useState(21);
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceDraftRecord[]>([]);
  const [activeInvoiceDraftId, setActiveInvoiceDraftId] = useState<string | null>(null);
  const [refundRequestState, setRefundRequestState] = useState<'idle' | 'processing'>('idle');
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');

  const [payoutHolder, setPayoutHolder] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [payoutBic, setPayoutBic] = useState('');
  const [sepaAmount, setSepaAmount] = useState('');
  const [sepaRemittance, setSepaRemittance] = useState('Abonnement / factuur');
  const [sepaPayload, setSepaPayload] = useState<string | null>(null);
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [transportPreferences, setTransportPreferences] = useState(() => getCachedTransportPreferences());
  const [transportFollowupNote, setTransportFollowupNote] = useState<string | null>(null);
  const serverBaseUrl = useMemo(() => getServerBaseUrl(), []);
  const currentWebOrigin = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (typeof window === 'undefined' || !window.location?.origin) return null;
    return window.location.origin;
  }, []);
  const canManageFinanciën = useMemo(
    () => hasPermission({ permission: 'manage_finance', role, email }),
    [email, role]
  );

  const cancelCheckout = useCallback(() => {
    setCheckoutState('idle');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function clearPendingCheckoutMarker() {
      await setItem(PENDING_CHECKOUT_STORAGE_KEY, '');
    }

    async function handleSuccessfulCheckout() {
      setCheckoutState('done');

      const rawPending = await getItem(PENDING_CHECKOUT_STORAGE_KEY).catch(() => null);
      const parsedPending = rawPending ? (JSON.parse(rawPending) as Partial<PendingCheckoutInvoice>) : null;
      const pendingInvoiceId =
        parsedPending && typeof parsedPending.invoiceId === 'string' && parsedPending.invoiceId
          ? parsedPending.invoiceId
          : null;
      const pendingMethodId =
        parsedPending && typeof parsedPending.methodId === 'string' ? parsedPending.methodId : selectedMethodId;

      const currentHistory = await loadInvoiceHistory();
      const targetDraft =
        currentHistory.find((entry) => entry.id === pendingInvoiceId) ??
        currentHistory.find((entry) => entry.savedFrom === 'checkout' && entry.status !== 'paid') ??
        null;

      if (!targetDraft) {
        await clearPendingCheckoutMarker().catch(() => {});
        return;
      }

      const nextHistory =
        targetDraft.status === 'paid' ? currentHistory : await updateInvoiceDraft(targetDraft.id, { status: 'paid' });

      if (cancelled) return;

      setInvoiceHistory(nextHistory);
      setActiveInvoiceDraftId(targetDraft.id);

      const refreshedDraft = nextHistory.find((entry) => entry.id === targetDraft.id) ?? targetDraft;
      if (targetDraft.status !== 'paid') {
        const methodLabel =
          paymentMethods.find((method) => method.id === pendingMethodId)?.label ??
          paymentMethods.find((method) => method.id === refreshedDraft.selectedMethodId)?.label ??
          'Stripe betaling';

        appendInvoiceEvent({
          invoiceId: refreshedDraft.id,
          invoiceNumber: refreshedDraft.invoiceNumber,
          kind: 'status_paid',
          label: 'Betaling automatisch bevestigd',
          detail: `Betaling succesvol afgerond via ${methodLabel}. Factuurstatus automatisch naar betaald gezet.`,
        }).catch(() => {});
      }

      await clearPendingCheckoutMarker().catch(() => {});
    }

    if (params.checkout === 'success') {
      unlockScanAccess().catch(() => {});
      handleSuccessfulCheckout().catch(() => {
        setCheckoutState('done');
      });
    }

    if (params.checkout === 'cancel') {
      setCheckoutState('idle');
      clearPendingCheckoutMarker().catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [params.checkout, selectedMethodId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${serverBaseUrl}/api/stripe/status`);
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        setStripeStatus(normalizeStripeStatus(data));
      } catch {
        if (cancelled) return;
        setStripeStatus(
          normalizeStripeStatus({
            configured: false,
            webhookConfigured: false,
            hasAnyPrice: false,
            priceKeysConfigured: 0,
            returnOrigins: [],
            returnOriginsConfigured: false,
            checkoutReady: false,
          })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverBaseUrl]);

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

  const stripeWarning = useMemo(() => {
    if (!stripeStatus) return null;
    if (!stripeStatus.configured) {
      return 'Stripe secret ontbreekt op de server. Zet STRIPE_SECRET_KEY als server secret op je productiehost of Cloudflare Worker. Zie docs/STRIPE_SETUP.md.';
    }
    if (!stripeStatus.hasAnyPrice) {
      return 'Geen Stripe price IDs gevonden. Voeg STRIPE_PRICE_* server-variabelen toe voor de live betaling. Zie docs/STRIPE_SETUP.md.';
    }
    if (!stripeStatus.webhookConfigured) {
      return 'STRIPE_WEBHOOK_SECRET ontbreekt nog. Voeg de webhook secret toe zodat betalingen en betaalstatussen live kunnen bevestigen. Zie docs/STRIPE_SETUP.md.';
    }
    if (!stripeStatus.returnOriginsConfigured) {
      return 'RETURN_URL_ORIGINS ontbreekt voor productie. Voeg je app origins toe op de server. Zie docs/STRIPE_SETUP.md.';
    }
    if (
      currentWebOrigin &&
      stripeStatus.returnOrigins.length > 0 &&
      !stripeStatus.returnOrigins.includes(currentWebOrigin)
    ) {
      return `RETURN_URL_ORIGINS bevat ${currentWebOrigin} nog niet. Voeg deze origin toe op de server.`;
    }
    return null;
  }, [currentWebOrigin, stripeStatus]);

  const checkoutBlocked =
    checkoutState === 'processing' || !canManageFinanciën || (stripeStatus ? !stripeStatus.checkoutReady : false);

  const openMethodConnectLink = useCallback((method: PaymentMethod) => {
    const url = `${STRIPE_PAYMENT_METHODS_DASHBOARD_URL}?method=${encodeURIComponent(method.id)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Link openen mislukt', 'Kon de koppelpagina voor deze betaalmethode niet openen.');
    });
  }, []);

  const openHubAppLink = useCallback(
    (item: HubAppLink) => {
      const target = item.url.startsWith('http') ? item.url : `${serverBaseUrl}${item.url}`;
      Linking.openURL(target).catch(() => {
        Alert.alert('Link openen mislukt', `Kon ${item.label} niet openen.`);
      });
    },
    [serverBaseUrl]
  );
  const openTransportPartnerAction = useCallback(
    async (item: TransportApp, scopeLabel: string) => {
      const methodLabel = paymentMethods.find((method) => method.id === selectedMethodId)?.label ?? '';
      const followupLabel = buildPaymentsTransportFollowupLabel(item.label, scopeLabel, methodLabel, customerType);
      const activeDraft = activeInvoiceDraftId ? invoiceHistory.find((draft) => draft.id === activeInvoiceDraftId) ?? null : null;
      await logTransportAudit({
        appId: item.id,
        appLabel: item.label,
        action: 'opened',
        scopeLabel,
        detail: `${item.label} direct geopend via payments transportactie.`,
      });
      await logTransportAudit({
        appId: item.id,
        appLabel: item.label,
        action: 'followup_logged',
        scopeLabel,
        detail: followupLabel,
      });
      if (activeDraft) {
        await appendInvoiceEvent({
          invoiceId: activeDraft.id,
          invoiceNumber: activeDraft.invoiceNumber,
          kind: 'concept_saved',
          label: 'Transport opvolging',
          detail: followupLabel,
        });
      }
      openHubAppLink(item);
      setTransportFollowupNote(followupLabel);
    },
    [activeInvoiceDraftId, customerType, invoiceHistory, openHubAppLink, selectedMethodId]
  );
  const syncTransportPreferencesNow = useCallback(async () => {
    const synced = await syncTransportPreferences();
    setTransportPreferences(synced);
    Alert.alert('Transport sync', 'Transportvoorkeuren zijn opnieuw gesynchroniseerd.');
  }, []);

  const tryStripeCheckout = useCallback(async (): Promise<StripeCheckoutResult> => {
    const interval = billingCycle === 'Jaarlijks' ? 'year' : billingCycle === 'Kwartaal' ? 'quarter' : 'month';
    const successUrl =
      Platform.OS === 'web' && currentWebOrigin
        ? `${currentWebOrigin}/payments?checkout=success`
        : ExpoLinking.createURL('payments', { queryParams: { checkout: 'success' } });
    const cancelUrl =
      Platform.OS === 'web' && currentWebOrigin
        ? `${currentWebOrigin}/payments?checkout=cancel`
        : ExpoLinking.createURL('payments', { queryParams: { checkout: 'cancel' } });

    let email: string | undefined;
    try {
      const session = await supabase?.auth.getSession();
      const candidate = session?.data?.session?.user?.email;
      if (typeof candidate === 'string' && candidate.trim()) email = candidate.trim();
    } catch {
      // ignore
    }

    try {
      const response = await fetch(`${serverBaseUrl}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlanId,
          interval,
          paymentMethodId: selectedMethodId,
          successUrl,
          cancelUrl,
          email,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        const serverReason = typeof data?.error === 'string' ? data.error : 'unknown';
        const serverHint = typeof data?.hint === 'string' ? data.hint : '';
        if (
          serverReason === 'stripe_not_configured' ||
          serverReason === 'price_not_configured' ||
          serverReason === 'bad_return_url' ||
          serverReason === 'stripe_error'
        ) {
          if (serverReason === 'stripe_error' && serverHint === 'stripe_price_invalid') {
            return { ok: false, reason: 'stripe_price_invalid' };
          }
          if (serverReason === 'stripe_error' && serverHint === 'stripe_auth_error') {
            return { ok: false, reason: 'stripe_auth_error' };
          }
          return { ok: false, reason: serverReason };
        }
        return { ok: false, reason: 'unknown' };
      }

      const checkoutSessionId = typeof data.id === 'string' ? data.id.trim() : '';
      if (checkoutSessionId && activeInvoiceDraftId) {
        const activeDraft = invoiceHistory.find((draft) => draft.id === activeInvoiceDraftId && draft.savedFrom === 'checkout') ?? null;
        if (activeDraft) {
          try {
            const nextHistory = await updateInvoiceDraft(activeDraft.id, { checkoutSessionId });
            setInvoiceHistory(nextHistory);
          } catch {
            // checkout should continue even if local session tracking cannot be saved
          }
        }
      }

      const url = String(data.url);
      if (Platform.OS === 'web') {
        window.location.href = url;
        return { ok: true };
      }

      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      return { ok: true };
    } catch {
      return { ok: false, reason: 'network_error' };
    }
  }, [activeInvoiceDraftId, billingCycle, currentWebOrigin, invoiceHistory, selectedMethodId, selectedPlanId, serverBaseUrl]);

  const requestRefund = useCallback(async () => {
    if (!canManageFinanciën) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      return;
    }

    if (!email) {
      Alert.alert('E-mail ontbreekt', 'We konden je accountmail niet vinden. Log opnieuw in en probeer het daarna nog eens.');
      return;
    }

    const refundTarget =
      invoiceHistory.find((draft) => draft.savedFrom === 'checkout' && draft.status === 'paid') ??
      invoiceHistory.find((draft) => draft.status === 'paid') ??
      null;
    if (!refundTarget || refundTarget.status !== 'paid') {
      Alert.alert(
        'Geen betaalde betaling',
        'Er is nog geen bevestigde betaling gevonden om een terugbetaling voor te starten.'
      );
      return;
    }

    const interval =
      refundTarget.billingCycle === 'Jaarlijks'
        ? 'year'
        : refundTarget.billingCycle === 'Kwartaal'
          ? 'quarter'
          : 'month';

    setRefundRequestState('processing');
    try {
      const response = await fetch(`${serverBaseUrl}/api/refunds/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: email,
          requesterEmail: email,
          planId: refundTarget.selectedPlanId,
          interval,
          checkoutSessionId: refundTarget.checkoutSessionId ?? null,
          invoiceNumber: refundTarget.invoiceNumber,
          reason: 'Niet tevreden. Geld terug gevraagd via de app.',
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        const error = typeof data?.error === 'string' ? data.error : 'refund_request_failed';
        if (error === 'payment_not_found') {
          Alert.alert(
            'Betaling niet gevonden',
            'De Stripe-betaling is nog niet teruggevonden. Probeer opnieuw zodra de webhook is verwerkt.'
          );
        } else if (error === 'already_refunded') {
          Alert.alert('Al terugbetaald', 'Deze betaling is al terugbetaald.');
        } else if (error === 'invalid_email') {
          Alert.alert('E-mail ongeldig', 'Je accountmail lijkt ongeldig.');
        } else if (error === 'payment_owner_mismatch') {
          Alert.alert('Betaling past niet', 'De gevonden betaling hoort niet bij dit account.');
        } else {
          Alert.alert(
            'Terugbetalingsverzoek mislukt',
            'De app kon nu geen refund-aanvraag versturen. Controleer serverlogs en support-config.'
          );
        }
        return;
      }

      Alert.alert(
        'Terugbetalingsverzoek verzonden',
        `De aanvraag is verstuurd naar ${LegalConfig.supportEmail}. Zodra de mail wordt goedgekeurd, voert Stripe de refund uit.`
      );
    } catch {
      Alert.alert('Netwerkfout', 'De refund-aanvraag kon niet worden verstuurd.');
    } finally {
      setRefundRequestState('idle');
    }
  }, [canManageFinanciën, email, invoiceHistory, serverBaseUrl]);

  const visiblePlans = useMemo(() => pricingPlans, []);
  const transportAppLinks = useMemo(() => transportApps, []);
  const topTransportApps = useMemo(
    () =>
      topTransportAppHighlights
        .map((highlight) => {
          const app = transportApps.find((item) => item.id === highlight.id);
          if (!app) return null;
          return { ...highlight, ...app };
        })
        .filter((entry): entry is TransportAppHighlight & TransportApp => Boolean(entry)),
    []
  );
  const recommendedTransportPartner = useMemo(
    () => {
      const useCase = customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget';
      const preferredAppId =
        getDefaultTransportAppId(transportPreferences, { scopeType: 'useCase', scopeValue: useCase }) ??
        getDefaultTransportAppId(transportPreferences, { scopeType: 'region', scopeValue: 'Europa' });

      if (preferredAppId) {
        const preferredApp = transportApps.find((app) => app.id === preferredAppId);
        if (preferredApp) {
          return {
            ...preferredApp,
            reason: `${preferredApp.label} wordt nu als standaard gebruikt voor payments (${useCase}).`,
          };
        }
      }

      return getTransportRecommendation('Europa', useCase);
    },
    [customerType, transportPreferences]
  );
  const setPaymentsTransportDefault = useCallback(async () => {
    if (!recommendedTransportPartner) return;
    const scopeValue = customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget';
    await saveTransportPreference({
      appId: recommendedTransportPartner.id,
      scopeType: 'useCase',
      scopeValue,
      kind: 'default',
    });
    await logTransportAudit({
      appId: recommendedTransportPartner.id,
      appLabel: recommendedTransportPartner.label,
      action: 'default_saved',
      scopeLabel: `Use case ${scopeValue}`,
      detail: `${recommendedTransportPartner.label} als payments-standaard gezet.`,
    });
    Alert.alert('Standaard bewaard', `${recommendedTransportPartner.label} staat nu als standaard voor ${scopeValue}.`);
  }, [customerType, recommendedTransportPartner]);
  const savePaymentsTransportFavorite = useCallback(async () => {
    if (!recommendedTransportPartner) return;
    const scopeValue = customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget';
    await saveTransportPreference({
      appId: recommendedTransportPartner.id,
      scopeType: 'useCase',
      scopeValue,
      kind: 'favorite',
    });
    await logTransportAudit({
      appId: recommendedTransportPartner.id,
      appLabel: recommendedTransportPartner.label,
      action: 'favorite_saved',
      scopeLabel: `Use case ${scopeValue}`,
      detail: `${recommendedTransportPartner.label} als payments-favoriet gezet.`,
    });
    Alert.alert('Favoriet bewaard', `${recommendedTransportPartner.label} staat nu als favoriet voor ${scopeValue}.`);
  }, [customerType, recommendedTransportPartner]);
  const removePaymentsTransportPreference = useCallback(
    async (kind: 'favorite' | 'default') => {
      if (!recommendedTransportPartner) return;
      const scopeValue = customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget';
      await removeTransportPreferenceByMatch({
        appId: recommendedTransportPartner.id,
        scopeType: 'useCase',
        scopeValue,
        kind,
      });
      await logTransportAudit({
        appId: recommendedTransportPartner.id,
        appLabel: recommendedTransportPartner.label,
        action: kind === 'favorite' ? 'favorite_removed' : 'default_removed',
        scopeLabel: `Use case ${scopeValue}`,
        detail: `${recommendedTransportPartner.label} ${kind === 'favorite' ? 'als favoriet' : 'als standaard'} verwijderd via payments.`,
      });
      Alert.alert(
        'Voorkeur verwijderd',
        `${recommendedTransportPartner.label} is verwijderd als ${kind === 'favorite' ? 'favoriet' : 'standaard'} voor ${scopeValue}.`
      );
    },
    [customerType, recommendedTransportPartner]
  );
  const transportPreferenceStats = useMemo(() => {
    const synced = transportPreferences.filter((entry) => entry.syncState === 'synced').length;
    const queued = transportPreferences.filter((entry) => entry.syncState === 'queued').length;
    const defaults = transportPreferences.filter((entry) => entry.kind === 'default').length;
    const favorites = transportPreferences.filter((entry) => entry.kind === 'favorite').length;
    const activeScope = customerType === 'Bedrijven' ? 'Use case Zakelijk' : 'Use case Budget';
    const activeDefault =
      getDefaultTransportAppId(transportPreferences, {
        scopeType: 'useCase',
        scopeValue: customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget',
      }) ??
      getDefaultTransportAppId(transportPreferences, {
        scopeType: 'region',
        scopeValue: 'Europa',
      });
    const activeDefaultApp = activeDefault ? transportApps.find((entry) => entry.id === activeDefault) ?? null : null;

    return {
      synced,
      queued,
      defaults,
      favorites,
      activeScope,
      activeDefaultApp,
    };
  }, [customerType, transportPreferences]);
  const paymentsTransportPreferenceMeta = useMemo(() => {
    if (!recommendedTransportPartner) return null;
    const scopeValue = customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget';
    const activeDefault =
      getTransportPreferenceForScope(transportPreferences, {
        scopeType: 'useCase',
        scopeValue,
        kind: 'default',
      })[0] ??
      getTransportPreferenceForScope(transportPreferences, {
        scopeType: 'region',
        scopeValue: 'Europa',
        kind: 'default',
      })[0] ??
      null;
    const favoriteCount = transportPreferences.filter(
      (entry) =>
        entry.kind === 'favorite' &&
        entry.appId === recommendedTransportPartner.id &&
        ((entry.scopeType === 'useCase' && entry.scopeValue === scopeValue) ||
          (entry.scopeType === 'region' && entry.scopeValue === 'Europa'))
    ).length;
    const activePreference = activeDefault?.appId === recommendedTransportPartner.id ? activeDefault : null;
    return {
      isDefault: Boolean(activePreference),
      favoriteCount,
      syncMeta: activePreference ? getTransportPreferenceSyncMeta(activePreference.syncState) : null,
    };
  }, [customerType, recommendedTransportPartner, transportPreferences]);
  useEffect(() => {
    if (!visiblePlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(visiblePlans[0]?.id ?? 'werkvloer');
    }
  }, [selectedPlanId, visiblePlans]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await getItem('invoice-recipients-v1');
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<{ to: string; vat: string; email: string }>;
          if (typeof parsed.to === 'string') setInvoiceTo(parsed.to);
          if (typeof parsed.vat === 'string') setInvoiceVat(parsed.vat);
          if (typeof parsed.email === 'string') setInvoiceEmail(parsed.email);
        }

        const rawVat = await getItem('invoice-vat-settings-v1');
        if (cancelled) return;
        if (rawVat) {
          const parsed = JSON.parse(rawVat) as Partial<{ country: string; rate: number }>;
          if (typeof parsed.country === 'string') setInvoiceCountry(parsed.country);
          if (typeof parsed.rate === 'number') setInvoiceVatRate(parsed.rate);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeInvoiceDraftId) return;
    if (invoiceHistory.length === 0) return;
    setActiveInvoiceDraftId(invoiceHistory[0]?.id ?? null);
  }, [activeInvoiceDraftId, invoiceHistory]);

  useEffect(() => {
    let cancelled = false;

    loadInvoiceHistory()
      .then(async (entries) => {
        if (!cancelled) {
          setInvoiceHistory(entries);
        }
        return syncInvoiceHistory();
      })
      .then((entries) => {
        if (cancelled) return;
        setInvoiceHistory(entries);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await secureGetItem('payout-account-v1');
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<{ holder: string; iban: string; bic: string }>;
          if (typeof parsed.holder === 'string') setPayoutHolder(parsed.holder);
          if (typeof parsed.iban === 'string') setPayoutIban(parsed.iban);
          if (typeof parsed.bic === 'string') setPayoutBic(parsed.bic);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setPayoutLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const savePayoutAccount = useCallback(async () => {
    if (!canManageFinanciën) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      return;
    }
    const holder = payoutHolder.trim();
    const iban = payoutIban.trim();
    const bic = payoutBic.trim();

    if (!holder) {
      Alert.alert('Ontbreekt', 'Vul de naam van de rekeninghouder in.');
      return;
    }

    if (!isProbablyIban(iban)) {
      Alert.alert('IBAN ongeldig', 'Controleer het IBAN-formaat (bv. BE00...).');
      return;
    }

    if (bic && !isProbablyBic(bic)) {
      Alert.alert('BIC ongeldig', 'Controleer het BIC-formaat (8 of 11 tekens).');
      return;
    }

    try {
      await secureSetItem('payout-account-v1', JSON.stringify({ holder, iban, bic }));
      Alert.alert('Opgeslagen', 'Rekening is gekoppeld voor SEPA overschrijvingen en facturatie.');
    } catch {
      Alert.alert('Opslaan mislukt', 'Probeer opnieuw.');
    }
  }, [canManageFinanciën, payoutBic, payoutHolder, payoutIban]);

  const generateSepaRequest = useCallback(async () => {
    if (!canManageFinanciën) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      return;
    }
    const holder = payoutHolder.trim();
    const iban = payoutIban.trim();
    const bic = payoutBic.trim();
    const amountValue = Number.parseFloat(sepaAmount.replace(',', '.'));

    if (!holder || !isProbablyIban(iban)) {
      Alert.alert('Rekening niet klaar', 'Koppel eerst een geldige naam + IBAN.');
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      Alert.alert('Bedrag ongeldig', 'Vul een bedrag in (bv. 24.90).');
      return;
    }

    if (bic && !isProbablyBic(bic)) {
      Alert.alert('BIC ongeldig', 'Controleer het BIC-formaat (8 of 11 tekens).');
      return;
    }

    const payload = buildSepaEpcPayload({
      name: holder,
      iban,
      bic: bic || null,
      amountEur: amountValue,
      remittance: sepaRemittance,
    });

    setSepaPayload(payload);

    const message = `SEPA betaalverzoek (EPC/GiroCode payload)\n\n${payload}\n\nTip: plak dit in een EPC QR generator of deel het met je klant/boekhouder.`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(payload);
          Alert.alert('Gekopieerd', 'EPC payload staat in je clipboard.');
          return;
        } catch {
          // fallback to share alert below
        }
      }

      Alert.alert('EPC payload', payload);
      return;
    }

    try {
      await Share.share({ message });
    } catch {
      // ignore
    }
  }, [canManageFinanciën, payoutBic, payoutHolder, payoutIban, sepaAmount, sepaRemittance]);

  useEffect(() => {
    const payload = { to: invoiceTo, vat: invoiceVat, email: invoiceEmail };
    setItem('invoice-recipients-v1', JSON.stringify(payload)).catch(() => {});
  }, [invoiceTo, invoiceVat, invoiceEmail]);

  useEffect(() => {
    const payload = { country: invoiceCountry, rate: invoiceVatRate };
    setItem('invoice-vat-settings-v1', JSON.stringify(payload)).catch(() => {});
  }, [invoiceCountry, invoiceVatRate]);

  const visibleMethods =
    selectedCategory === 'Alle'
      ? paymentMethods
      : paymentMethods.filter((method) => method.category === selectedCategory);

  const selectedPlan = visiblePlans.find((plan) => plan.id === selectedPlanId) ?? visiblePlans[0];
  const recommendedPlan = useMemo(() => {
    if (locations.length >= 4 || metrics.totalProducts >= 25 || metrics.totalUnits >= 80) {
      return visiblePlans.find((plan) => plan.id === 'enterprise') ?? visiblePlans[0];
    }

    if (locations.length >= 2 || metrics.totalProducts >= 12 || metrics.totalUnits >= 40) {
      return visiblePlans.find((plan) => plan.id === 'multi') ?? visiblePlans[0];
    }

    if (metrics.totalProducts >= 6 || metrics.totalUnits >= 16) {
      return visiblePlans.find((plan) => plan.id === 'pro') ?? visiblePlans[0];
    }

    if (metrics.totalProducts >= 2 || metrics.totalUnits >= 6) {
      return visiblePlans.find((plan) => plan.id === 'werkvloer') ?? visiblePlans[0];
    }

    return visiblePlans.find((plan) => plan.id === 'start') ?? visiblePlans[0];
  }, [locations.length, metrics.totalProducts, metrics.totalUnits, visiblePlans]);
  const selectedMethod =
    paymentMethods.find((method) => method.id === selectedMethodId) ?? paymentMethods[0];
  const currentYear = new Date().getFullYear();
  const currentYearFinanciënEntries = financeEntries.filter((entry) => {
    const recordedAt = new Date(entry.recordedAt);
    return !Number.isNaN(recordedAt.getTime()) && recordedAt.getFullYear() === currentYear;
  });
  const revenueTotal = currentYearFinanciënEntries.reduce(
    (sum, entry) => (entry.kind === 'revenue' ? sum + entry.amount : sum),
    0
  );
  const businessIntensity = metrics.totalProducts + metrics.totalUnits + locations.length * 2;
  const currentMonth = new Date().getMonth();
  const currentMonthFinanciënEntries = financeEntries.filter((entry) => {
    const recordedAt = new Date(entry.recordedAt);
    return (
      !Number.isNaN(recordedAt.getTime()) &&
      recordedAt.getFullYear() === currentYear &&
      recordedAt.getMonth() === currentMonth
    );
  });
  const monthRevenue = currentMonthFinanciënEntries
    .filter((entry) => entry.kind === 'revenue')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const monthFoodCost = currentMonthFinanciënEntries
    .filter((entry) => entry.kind === 'food_cost')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const monthLoss = currentMonthFinanciënEntries
    .filter((entry) => entry.kind === 'loss')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const monthNet = monthRevenue - monthFoodCost - monthLoss;
  const monthVatAmount = Math.max(0, (invoiceVatRate / 100) * monthRevenue);
  const monthInvoiceTotal = monthRevenue + monthVatAmount;

  const recommendedMethod = useMemo(() => {
    if (customerType === 'Bedrijven') {
      if (selectedPlan?.id === 'enterprise' || selectedPlan?.id === 'multi' || locations.length >= 6 || revenueTotal >= 10000) {
        return paymentMethods.find((method) => method.id === 'partner-invoice') ?? paymentMethods[0];
      }

      if (billingCycle !== 'Maandelijks') {
        return paymentMethods.find((method) => method.id === 'partner-invoice') ?? paymentMethods[0];
      }

      return paymentMethods.find((method) => method.id === 'sepa') ?? paymentMethods[0];
    }

    if (selectedPlan?.id === 'pro' || selectedPlan?.id === 'multi' || metrics.totalUnits >= 12) {
      return paymentMethods.find((method) => method.id === 'paypal') ?? paymentMethods[0];
    }

    if (billingCycle !== 'Maandelijks') {
      return paymentMethods.find((method) => method.id === 'bancontact') ?? paymentMethods[0];
    }

    return paymentMethods.find((method) => method.id === 'bancontact') ?? paymentMethods[0];
  }, [billingCycle, customerType, locations.length, metrics.totalUnits, revenueTotal, selectedPlan?.id]);
  const basePlanPrice = getPlanPriceByBillingCycle(selectedPlan, billingCycle);
  const onboardingFee =
    checkoutState === 'done' ? 0 : selectedPlan?.onboardingFee ?? 0;
  const methodFeePercent = Number.parseFloat(selectedMethod.fee.replace('%', '')) || 0;
  const transactionEstimate = (basePlanPrice * methodFeePercent) / 100;
  const billingCycleDiscount =
    selectedPlan && billingCycle === 'Jaarlijks'
      ? Math.max(selectedPlan.monthlyPrice * 12 - selectedPlan.yearlyPrice, 0)
      : selectedPlan && billingCycle === 'Kwartaal'
        ? Math.max(selectedPlan.monthlyPrice * 3 - basePlanPrice, 0)
        : 0;
  const billingCycleDiscountLabel =
    billingCycle === 'Jaarlijks' ? 'Jaarvoordeel' : billingCycle === 'Kwartaal' ? 'Kwartaalvoordeel' : null;
  const total = Math.max(0, basePlanPrice + onboardingFee + transactionEstimate);
  const monthlyEquivalent =
    billingCycle === 'Jaarlijks'
      ? basePlanPrice / 12
      : billingCycle === 'Kwartaal'
        ? basePlanPrice / 3
        : basePlanPrice;
  const billingCycleLabel = getBillingCycleLabel(billingCycle);
  const billingCycleHint = getBillingCycleHint(billingCycle);

  const transactionFeed = (items.length ? items.slice(0, 4) : []).map((item, index) => ({
    id: item.id,
    title: item.name,
    amount: item.quantity * 6.4 + 2.1,
    status: index === 0 ? 'Betaald' : index === 1 ? 'In verwerking' : index === 2 ? 'Gepland' : 'Open',
    meta: `${item.category} - ${item.source}`,
  }));

  const transactions =
    transactionFeed.length > 0
      ? transactionFeed
        : [
          {
            id: 'seed-payment',
            title: 'Nog geen live betalingen',
            amount: 0,
            status: 'Nog gestart',
            meta: 'De eerste live betaling verschijnt hier.',
          },
        ];

  const methodCounts = useMemo(() => {
    return paymentCategories.map((category) => ({
      category,
      count:
        category === 'Alle'
          ? paymentMethods.length
          : paymentMethods.filter((method) => method.category === category).length,
    }));
  }, []);

  function buildInvoiceText() {
    const lines = [
      `Factuurconcept - ${invoiceTo}`,
      `Land: ${invoiceCountry}`,
      `BTW nr: ${invoiceVat}`,
      `Facturatiecyclus: ${billingCycle}`,
      `Prijsregel: ${billingCycleLabel} ${formatCurrency(basePlanPrice)}`,
      `Maand: ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
      `Omzet: ${formatCurrency(monthRevenue)}`,
      `Voedselkost: ${formatCurrency(monthFoodCost)}`,
      `Verlies: ${formatCurrency(monthLoss)}`,
      `BTW (${invoiceVatRate}%): ${formatCurrency(monthVatAmount)}`,
      `Totaal incl. BTW: ${formatCurrency(monthInvoiceTotal)}`,
      '',
      'Per vestiging:',
      ...locations.map((loc) => {
        const scopedRevenue = currentMonthFinanciënEntries
          .filter((entry) => entry.location === loc && entry.kind === 'revenue')
          .reduce((sum, entry) => sum + entry.amount, 0);
        return `- ${loc}: ${formatCurrency(scopedRevenue)}`;
      }),
      '',
      'Stuuradvies samenvatting:',
      `Netto (na cost & live winst/verlies): ${formatCurrency(monthNet)}`,
      `Klant: ${invoiceEmail}`,
    ];
    return lines.join('\n');
  }

  const invoicePreviewText = buildInvoiceText();

  const persistInvoiceConcept = useCallback(
    async (savedFrom: InvoiceDraftRecord['savedFrom']) => {
      if (!canManageFinanciën) {
        Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
        return false;
      }

      try {
        const nextHistory = await saveInvoiceDraft({
          invoiceTo,
          invoiceVat,
          invoiceEmail,
          invoiceCountry,
          invoiceVatRate,
          billingCycle,
          customerType,
          selectedPlanId,
          selectedMethodId,
          monthRevenue,
          monthFoodCost,
          monthLoss,
          monthVatAmount,
          monthInvoiceTotal,
          previewText: invoicePreviewText,
          savedFrom,
          status: savedFrom === 'checkout' ? 'ready' : 'concept',
        });
        setInvoiceHistory(nextHistory);
        const activeDraft = nextHistory[0] ?? null;
        setActiveInvoiceDraftId(activeDraft?.id ?? null);
        if (activeDraft) {
          if (savedFrom === 'checkout') {
            setItem(
              PENDING_CHECKOUT_STORAGE_KEY,
              JSON.stringify({
                invoiceId: activeDraft.id,
                invoiceNumber: activeDraft.invoiceNumber,
                methodId: selectedMethodId,
                planId: selectedPlanId,
                createdAt: new Date().toISOString(),
              } satisfies PendingCheckoutInvoice)
            ).catch(() => {});
          }
          appendInvoiceEvent({
            invoiceId: activeDraft.id,
            invoiceNumber: activeDraft.invoiceNumber,
            kind: 'concept_saved',
            label: 'Concept bewaard',
            detail: `Concept opgeslagen via ${savedFrom}.`,
          }).catch(() => {});
        }
        return activeDraft;
      } catch {
        Alert.alert('Concept bewaren mislukt', 'Het factuurconcept kon niet lokaal worden opgeslagen.');
        return null;
      }
    },
    [
      billingCycle,
      canManageFinanciën,
      customerType,
      invoiceCountry,
      invoiceEmail,
      invoicePreviewText,
      invoiceTo,
      invoiceVat,
      invoiceVatRate,
      monthFoodCost,
      monthInvoiceTotal,
      monthLoss,
      monthRevenue,
      monthVatAmount,
      selectedMethodId,
      selectedPlanId,
    ]
  );

  const applyInvoiceDraft = useCallback(
    (draft: InvoiceDraftRecord) => {
      setInvoiceTo(draft.invoiceTo);
      setInvoiceVat(draft.invoiceVat);
      setInvoiceEmail(draft.invoiceEmail);
      setInvoiceCountry(draft.invoiceCountry);
      setInvoiceVatRate(draft.invoiceVatRate);
      setBillingCycle(draft.billingCycle === 'Jaarlijks' ? 'Jaarlijks' : draft.billingCycle === 'Kwartaal' ? 'Kwartaal' : 'Maandelijks');
      setCustomerType('Bedrijven');
      setSelectedPlanId(pricingPlans.some((plan) => plan.id === draft.selectedPlanId) ? (draft.selectedPlanId as PlanKey) : 'werkvloer');
      setSelectedMethodId(draft.selectedMethodId);
      setActiveInvoiceDraftId(draft.id);
      cancelCheckout();
      Alert.alert('Concept geladen', `Factuurconcept voor ${draft.invoiceTo} staat opnieuw klaar.`);
    },
    [cancelCheckout]
  );

  const activeInvoiceDraft = useMemo(
    () => invoiceHistory.find((draft) => draft.id === activeInvoiceDraftId) ?? null,
    [activeInvoiceDraftId, invoiceHistory]
  );
  const latestPaidCheckout = useMemo(
    () => invoiceHistory.find((draft) => draft.savedFrom === 'checkout' && draft.status === 'paid') ?? null,
    [invoiceHistory]
  );

  const updateInvoiceDraftStatus = useCallback(
    async (id: string, status: InvoiceDraftRecord['status']) => {
      if (!canManageFinanciën) {
        Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
        return;
      }
      try {
        const nextHistory = await updateInvoiceDraft(id, { status });
        setInvoiceHistory(nextHistory);
        setActiveInvoiceDraftId(id);
        const draft = nextHistory.find((entry) => entry.id === id) ?? null;
        if (draft) {
          appendInvoiceEvent({
            invoiceId: draft.id,
            invoiceNumber: draft.invoiceNumber,
            kind: status === 'paid' ? 'status_paid' : 'status_sent',
            label: status === 'paid' ? 'Status betaald' : 'Status verzonden',
            detail: `Factuurstatus aangepast naar ${status}.`,
          }).catch(() => {});
        }
        Alert.alert(
          'Factuurstatus bijgewerkt',
          status === 'paid'
            ? 'De factuur staat nu als betaald.'
            : status === 'sent'
              ? 'De factuur staat nu als verzonden.'
              : 'De factuurstatus is bijgewerkt.'
        );
      } catch {
        Alert.alert('Status update mislukt', 'De factuurstatus kon niet worden bijgewerkt.');
      }
    },
    [canManageFinanciën]
  );

  const retryInvoiceDraftSync = useCallback(
    async (id: string) => {
      try {
        const nextHistory = await updateInvoiceDraft(id, {});
        setInvoiceHistory(nextHistory);
        const draft = nextHistory.find((entry) => entry.id === id) ?? null;
        if (draft) {
          appendInvoiceEvent({
            invoiceId: draft.id,
            invoiceNumber: draft.invoiceNumber,
            kind: 'sync_retry',
            label: 'Sync opnieuw',
            detail: 'Factuursync opnieuw gestart vanuit payments.',
          }).catch(() => {});
        }
      } catch {
        Alert.alert('Sync mislukt', 'De factuur kon nu niet opnieuw gesynchroniseerd worden.');
      }
    },
    []
  );

  async function copyInvoiceText() {
    if (!(await persistInvoiceConcept('copy'))) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      Alert.alert('Kopieren niet beschikbaar', 'Clipboard niet ondersteund in deze omgeving.');
      return;
    }
    try {
      await navigator.clipboard.writeText(buildInvoiceText());
    } catch {
      Alert.alert('Kopieren mislukt', 'Probeer opnieuw of gebruik de mail-knop.');
    }
  }

  function mailInvoiceText() {
    if (!canManageFinanciën) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      return;
    }
    void persistInvoiceConcept('mail');
    const subject = encodeURIComponent(
      `Factuurconcept ${invoiceTo} - ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    );
    const body = encodeURIComponent(buildInvoiceText());
    const recipient = invoiceEmail ? `mailto:${encodeURIComponent(invoiceEmail)}` : 'mailto:';
    const mailto = `${recipient}?subject=${subject}&body=${body}`;
    Linking.openURL(mailto).catch(() => {
      Alert.alert('Mail openen mislukt', 'Gebruik een mailclient of kopieer de tekst.');
    });
  }

  async function downloadInvoicePdf() {
    if (!(await persistInvoiceConcept('pdf'))) {
      return;
    }
    const fileName = `taze-factuurconcept-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}.pdf`;

    if (Platform.OS !== 'web') {
      try {
        await Share.share({
          title: BrandIdentity.invoiceLabel,
          message: buildInvoiceText(),
        });
      } catch {
        Alert.alert('PDF export op web', 'Open de webversie om het factuurconcept als PDF te downloaden.');
      }
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      pdf.setFillColor(4, 19, 31);
      pdf.roundedRect(36, 32, 523, 92, 24, 24, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(28);
      pdf.text(BrandIdentity.reportName, 58, 74);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Factuurconcept en financieel overzicht', 58, 96);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(invoiceTo, 40, 154);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.text(`Periode: ${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`, 40, 176);
      pdf.text(`BTW: ${invoiceVat} | Land: ${invoiceCountry} | Contact: ${invoiceEmail}`, 40, 194);

      const lines = pdf.splitTextToSize(buildInvoiceText(), 515);
      pdf.text(lines, 40, 232);
      pdf.save(fileName);
    } catch {
      Alert.alert('PDF export mislukt', 'Het factuurconcept kon niet als PDF worden opgebouwd.');
    }
  }

  const paymentReadinessScore = Math.max(
    42,
    Math.min(
      98,
      Math.round(
        (selectedPlan ? 24 : 10) +
          (selectedMethod ? 18 : 8) +
          Math.min(24, businessIntensity) +
          (currentYearFinanciënEntries.length > 0 ? 18 : 8) +
          (billingCycle === 'Jaarlijks' ? 10 : 6)
      )
    )
  );

  const paymentProfile =
    customerType === 'Bedrijven'
      ? businessIntensity >= 30
        ? 'Groeiende organisatie'
        : businessIntensity >= 14
          ? 'Actieve KMO-flow'
          : 'Kleine bedrijfsflow'
      : metrics.totalUnits >= 12
        ? 'Actief huishouden'
        : metrics.totalProducts >= 4
          ? 'Gezinsgebruik'
          : 'Lichte thuisflow';

  const paymentSmartReason =
    selectedPlan?.id === 'enterprise'
      ? 'Enterprise past bij grotere organisaties die maatwerkrollen, API-koppelingen en SLA-support nodig hebben.'
      : selectedPlan?.id === 'multi'
        ? 'Multi is logisch zodra voorraad, bewijs en transport over meerdere zones zichtbaar moeten blijven.'
        : selectedPlan?.id === 'pro'
          ? 'Pro past bij teams die AI-voorstellen, audit trail, exports en managercontrole willen zonder AI als beslisser.'
          : selectedPlan?.id === 'werkvloer'
            ? 'Werkvloer is de operationele basis: iedere scan krijgt een plaats, actie en bewijs.'
            : 'Start houdt de instap laag voor eenvoudige stockcontrole met scan, locatie en basis trace.';

  const smartPaymentSignals = useMemo(
    () => [
      {
        label: 'Betaalscore',
        value: `${paymentReadinessScore}%`,
        detail: 'Hoe compleet je prijsflow nu staat',
      },
      {
        label: 'Profiel',
        value: paymentProfile,
        detail:
          customerType === 'Bedrijven'
            ? `${locations.length} vestiging(en)`
            : `${metrics.totalProducts} producten in gebruik`,
      },
      {
        label: 'Financiën',
        value: currentYearFinanciënEntries.length > 0 ? 'Live cijfers' : 'Nog leeg',
        detail:
          currentYearFinanciënEntries.length > 0
            ? `${currentYearFinanciënEntries.length} registraties dit jaar`
            : 'Omzet en live winst/verlies nog niet gekoppeld',
      },
    ],
    [
      currentYearFinanciënEntries.length,
      customerType,
      locations.length,
      metrics.totalProducts,
      paymentProfile,
      paymentReadinessScore,
    ]
  );

  const smartPaymentActions = [
    {
      title: 'Aanbevolen pakket',
      detail: recommendedPlan
        ? `${recommendedPlan.title} past nu het best bij ${paymentProfile.toLowerCase()}.`
        : 'Kies eerst een pakket om slim advies te krijgen.',
      cta: 'Gebruik advies',
      onPress: () => {
        if (recommendedPlan) {
          setSelectedPlanId(recommendedPlan.id);
          setSelectedMethodId(recommendedMethod.id);
          cancelCheckout();
        }
      },
      tone: '#6d28d9',
      surface: '#f5f3ff',
    },
    {
      title: 'Aanbevolen betaalflow',
      detail: `${recommendedMethod.label} is nu de slimste route op basis van ${
        customerType === 'Bedrijven' ? 'facturatie, schaal en financiën' : 'gebruiksgemak en transactieflow'
      }.`,
      cta: 'Neem methode over',
      onPress: () => {
        setSelectedMethodId(recommendedMethod.id);
        cancelCheckout();
      },
      tone: '#0f766e',
      surface: '#ecfeff',
    },
    {
      title: 'Slimme reden van het systeem',
      detail: paymentSmartReason,
      cta: 'Hou advies aan',
      onPress: () => {
        setSelectedCategory('Alle');
        cancelCheckout();
      },
      tone: '#b45309',
      surface: '#fffbeb',
    },
  ];

  const paymentAiActions = useMemo<RealAiAvailableAction[]>(
    () => [
      {
        kind: 'payments_apply_recommended_setup',
        label: 'Pas aanbevolen setup toe',
        description: 'Neem het aanbevolen pakket en de aanbevolen betaalmethode direct over.',
      },
      {
        kind: 'payments_set_yearly',
        label: 'Zet op jaarlijkse facturatie',
        description: 'Schakel de betaalflow naar jaarlijkse facturatie wanneer dat beter past.',
      },
      {
        kind: 'payments_set_monthly',
        label: 'Zet op maandelijkse facturatie',
        description: 'Schakel de betaalflow naar maandelijkse facturatie wanneer dat veiliger voelt.',
      },
      {
        kind: 'payments_focus_business',
        label: 'Kies werkvloerprofiel',
        description: 'Zet prijszetting en aanbevelingen op scan, bewijs, voorraad en managercontrole.',
      },
    ],
    []
  );

  const paymentAiContext = useMemo(
    () => ({
      screen: 'payments',
      customerType,
      billingCycle,
      selectedPlan: selectedPlan
        ? {
            title: selectedPlan.title,
            monthlyPrice: selectedPlan.monthlyPrice,
            yearlyPrice: selectedPlan.yearlyPrice,
            onboardingFee: selectedPlan.onboardingFee,
          }
        : null,
      selectedMethod: {
        label: selectedMethod.label,
        category: selectedMethod.category,
        fee: selectedMethod.fee,
        speed: selectedMethod.speed,
      },
      paymentReadinessScore,
      paymentProfile,
      paymentSmartReason,
      smartSignals: smartPaymentSignals,
      finance: {
        revenueTotal,
        monthRevenue,
        monthFoodCost,
        monthLoss,
        monthNet,
        monthVatAmount,
        monthInvoiceTotal,
      },
      invoice: {
        to: invoiceTo,
        vat: invoiceVat,
        country: invoiceCountry,
        vatRate: invoiceVatRate,
        email: invoiceEmail,
      },
      transportFocus: buildTransportAiContext({
        preferences: transportPreferences,
        region: 'Europa',
        useCase: customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget',
      }).transport,
      locations: locations.length,
      totalProducts: metrics.totalProducts,
      totalUnits: metrics.totalUnits,
      recommendedPlan: recommendedPlan?.title ?? null,
      recommendedMethod: recommendedMethod.label,
    }),
    [
      billingCycle,
      customerType,
      invoiceCountry,
      invoiceEmail,
      invoiceTo,
      invoiceVat,
      invoiceVatRate,
      locations.length,
      metrics.totalProducts,
      metrics.totalUnits,
      monthFoodCost,
      monthInvoiceTotal,
      monthLoss,
      monthNet,
      monthRevenue,
      monthVatAmount,
      paymentProfile,
      paymentReadinessScore,
      paymentSmartReason,
      recommendedMethod.label,
      recommendedPlan?.title,
      revenueTotal,
      selectedMethod.category,
      selectedMethod.fee,
      selectedMethod.label,
      selectedMethod.speed,
      selectedPlan,
      smartPaymentSignals,
      transportPreferences,
    ]
  );

  useEffect(() => {
    setRealAiState('idle');
    setRealAiAnswer(null);
    setRealAiError('');
  }, [billingCycle, customerType, selectedMethodId, selectedPlanId, invoiceTo, invoiceVat, invoiceEmail]);

  const askPaymentsAi = useCallback(async () => {
    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');

    try {
      const answer = await requestRealAi({
        screen: 'payments',
        question: 'Welke prijs-, factuur- of betaalactie raad je nu aan voor deze klant- en financiële context?',
        context: paymentAiContext,
        availableActions: paymentAiActions,
        serverBaseUrl,
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
    } catch (error) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.');
    }
  }, [paymentAiActions, paymentAiContext, serverBaseUrl]);

  const applyPaymentsAiAction = useCallback((action: NonNullable<RealAiResponse['action']>) => {
    if (!canManageFinanciën) {
      Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
      if (realAiAnswer?.auditId) {
        markAiAuditOutcome(realAiAnswer.auditId, {
          kind: 'failed',
          label: `${action.label} geblokkeerd door rechten`,
        }).catch(() => {});
      }
      return;
    }

    if (realAiAnswer?.auditId) {
      markAiAuditInteraction(realAiAnswer.auditId, {
        kind: 'action_applied',
        label: action.label,
      }).catch(() => {});
    }

    let success = false;

    switch (action.kind) {
      case 'payments_apply_recommended_setup':
        if (recommendedPlan) {
          setSelectedPlanId(recommendedPlan.id);
        }
        setSelectedMethodId(recommendedMethod.id);
        cancelCheckout();
        setAdvicePinned(true);
        success = true;
        break;
      case 'payments_set_yearly':
        setBillingCycle('Jaarlijks');
        cancelCheckout();
        success = true;
        break;
      case 'payments_set_quarterly':
        setBillingCycle('Kwartaal');
        cancelCheckout();
        success = true;
        break;
      case 'payments_set_monthly':
        setBillingCycle('Maandelijks');
        cancelCheckout();
        success = true;
        break;
      case 'payments_focus_business':
        setCustomerType('Bedrijven');
        cancelCheckout();
        success = true;
        break;
      case 'payments_focus_personal':
        setCustomerType('Bedrijven');
        cancelCheckout();
        success = true;
        break;
      default:
        success = false;
        break;
    }

    if (realAiAnswer?.auditId) {
      markAiAuditOutcome(realAiAnswer.auditId, {
        kind: success ? 'success' : 'failed',
        label: success ? `${action.label} voltooid` : `${action.label} niet uitgevoerd`,
      }).catch(() => {});
    }
  }, [canManageFinanciën, cancelCheckout, realAiAnswer?.auditId, recommendedMethod.id, recommendedPlan]);

  const summaryCards = [
    {
      title: 'Platform',
      value: 'Werkvloercontrole',
      detail: selectedPlan
        ? `${selectedPlan.title} pakket geselecteerd.`
        : 'Kies eerst een pakket.',
      tone: '#6d28d9',
      surface: '#f5f3ff',
    },
    {
      title: 'Facturatie',
      value: billingCycle,
      detail:
        billingCycle === 'Jaarlijks'
          ? `Jaarprijs met ${formatCurrency(billingCycleDiscount)} voordeel tegenover maandelijks.`
          : billingCycle === 'Kwartaal'
            ? `Kwartaalprijs met ${formatCurrency(billingCycleDiscount)} voordeel tegenover driemaandelijks maandtarief.`
            : 'Maandelijkse facturatie met lage instap.',
      tone: '#1d4ed8',
      surface: '#eff6ff',
    },
    {
      title: billingCycleLabel,
      value: formatCurrency(basePlanPrice),
      detail:
        billingCycle === 'Jaarlijks'
          ? `Komt neer op ${formatCurrency(monthlyEquivalent)}/maand.`
          : billingCycle === 'Kwartaal'
            ? `Komt neer op ${formatCurrency(monthlyEquivalent)}/maand in dit kwartaal.`
          : 'Vaste prijs voor het gekozen pakket.',
      tone: '#b45309',
      surface: '#fffbeb',
    },
    {
      title: 'Betaalstatus',
      value: checkoutState === 'done' ? 'Laatste betaling gelukt' : 'Prijzen actief',
      detail: `Afrekenen via ${selectedMethod.label}.`,
      tone: '#0f766e',
      surface: '#ecfeff',
    },
  ];

  const checkoutMessage =
    checkoutState === 'done'
      ? `Betaling bevestigd en factuur automatisch op betaald gezet voor ${selectedPlan?.title ?? 'het gekozen pakket'} via ${selectedMethod.label}.`
      : checkoutState === 'processing'
        ? `De betaling voor ${selectedPlan?.title ?? 'je pakket'} via ${selectedMethod.label} wordt voorbereid.`
        : `Kies eerst een Taze-pakket en daarna een betaalmethode.`;

  return (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pagePadding }]}>
      <ThemedView style={[styles.screen, { maxWidth: pageMaxWidth }]}>
        <TazeHero
          title="Bedrijfspakketten"
          description="Taze is een controleerbaar werkvloerplatform: scannen, foto-bewijs vastleggen, voorraad volgen, transport opvolgen en managers laten zien wat echt gebeurt. AI stelt voor, de mens beslist."
          badgeLabel="Prijzen"
          badgeValue={selectedPlan ? formatCurrency(basePlanPrice) : formatCurrency(0)}
          badgeText={selectedPlan ? `${selectedPlan.title} - ${billingCycle}` : 'Kies een pakket'}
        />
        {!canManageFinanciën ? (
          <View style={styles.permissionNote}>
            <ThemedText type="defaultSemiBold">Alleen-lezen</ThemedText>
            <ThemedText style={styles.permissionNoteText}>{getPermissionMessage('manage_finance')}</ThemedText>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <View key={card.title} style={styles.summaryCard}>
              <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
              <ThemedText style={styles.summaryValue}>{card.value}</ThemedText>
              <ThemedText>{card.detail}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.smartPanel}>
          <View style={styles.smartPanelHeader}>
            <View style={styles.smartPanelCopy}>
              <ThemedText type="subtitle">Slimme betaalcockpit</ThemedText>
              <ThemedText>
                Het systeem leest mee met gebruik, voorraad, vestigingen en financiën om prijszetting en betaalroute slim te adviseren.
              </ThemedText>
            </View>
            <View style={styles.smartScoreBadge}>
              <ThemedText type="defaultSemiBold" style={styles.smartScoreValue}>
                {paymentReadinessScore}%
              </ThemedText>
              <ThemedText style={styles.smartScoreLabel}>Betaalfit</ThemedText>
            </View>
          </View>

          <View style={styles.smartSignalRow}>
            {smartPaymentSignals.map((signal) => (
              <View key={signal.label} style={styles.smartSignalCard}>
                <ThemedText style={styles.smartSignalLabel}>{signal.label}</ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.smartSignalValue}>
                  {signal.value}
                </ThemedText>
                <ThemedText style={styles.smartSignalDetail}>{signal.detail}</ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.smartActionRow}>
            {smartPaymentActions.map((action) => (
              <View key={action.title} style={styles.smartActionCard}>
                <ThemedText type="defaultSemiBold">{action.title}</ThemedText>
                <ThemedText>{action.detail}</ThemedText>
                <Pressable
                  style={[styles.smartActionButton, { backgroundColor: action.tone }]}
                  disabled={!canManageFinanciën}
                  onPress={action.onPress}>
                  <ThemedText type="defaultSemiBold" style={styles.smartActionButtonText}>
                    {action.cta}
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </View>

          <RealAiCopilotPanel
            title="Echte AI op prijszetting en facturatie"
            hint="Laat een echt model meekijken naar prijszetting, betaalroute, BTW en factuurcontext."
            buttonLabel="Vraag betaal-AI"
            loading={realAiState === 'loading'}
            onAsk={() => askPaymentsAi().catch(() => {})}
            result={realAiAnswer}
            error={realAiError || null}
            onApplyAction={applyPaymentsAiAction}
            onOpenTransportPartner={() =>
              recommendedTransportPartner
                ? openTransportPartnerAction(
                    recommendedTransportPartner,
                    `Use case ${customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget'}`
                  ).catch(() => {})
                : undefined
            }
            onSaveTransportPreference={(kind) =>
              (kind === 'favorite' ? savePaymentsTransportFavorite() : setPaymentsTransportDefault()).catch(() => {})
            }
            onRemoveTransportPreference={(kind) => removePaymentsTransportPreference(kind).catch(() => {})}
            onOpenRoute={(route) => {
              if (realAiAnswer?.auditId) {
                markAiAuditInteraction(realAiAnswer.auditId, {
                  kind: 'route_opened',
                  label: realAiAnswer.recommendedLabel,
                }).catch(() => {});
              }

              if (route === '/transport') {
                if (realAiAnswer?.auditId) {
                  markAiAuditOutcome(realAiAnswer.auditId, {
                    kind: 'success',
                    label: 'Transporthub geopend via payments-AI',
                  }).catch(() => {});
                }
                router.push(
                  buildTransportHubPath({
                    region: 'Europa',
                    useCase: customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget',
                    partnerId: recommendedTransportPartner?.id ?? null,
                    source: 'payments',
                    auditId: realAiAnswer?.auditId ?? null,
                  }) as Href
                );
                return;
              }

              if (route === '/payments') {
                if (recommendedPlan) {
                  setSelectedPlanId(recommendedPlan.id);
                }
                setSelectedMethodId(recommendedMethod.id);
                cancelCheckout();
                return;
              }

              router.push(route as Href);
            }}
          />
        </View>

        <View style={styles.bankPanel}>
          <TazeSectionHeader
            title="Rekening koppelen (SEPA)"
            subtitle="Gebruik dit voor overschrijvingen en factuurflows. Tip: voor kaartbetalingen configureer je je uitbetalingsrekening in je Stripe/Mollie/Adyen-dashboard in plaats van die in de app te hardcoderen."
            badge="SEPA"
            badgeTone="primary"
            style={styles.sectionHeader}
          />

          <View style={styles.invoiceRow}>
            <TazeInput label="Rekeninghouder" value={payoutHolder} onChangeText={setPayoutHolder} placeholder="Naam / bedrijf" fieldStyle={styles.invoiceCard} />
            <TazeInput
              label="IBAN"
              value={payoutIban}
              onChangeText={setPayoutIban}
              placeholder="BE00 0000 0000 0000"
              autoCapitalize="characters"
              fieldStyle={styles.invoiceCard}
            />
          </View>

          <View style={styles.invoiceRow}>
            <TazeInput
              label="BIC (optioneel)"
              value={payoutBic}
              onChangeText={setPayoutBic}
              placeholder="BIC/SWIFT"
              autoCapitalize="characters"
              fieldStyle={styles.invoiceCard}
            />
            <TazeInput
              label="Bedrag (EUR)"
              value={sepaAmount}
              onChangeText={setSepaAmount}
              placeholder="24.90"
              keyboardType="decimal-pad"
              fieldStyle={styles.invoiceCard}
            />
          </View>

          <TazeInput
            label="Omschrijving (mededeling)"
            value={sepaRemittance}
            onChangeText={setSepaRemittance}
            placeholder="Factuur / abonnement / order"
            multiline
            fieldStyle={styles.invoiceCard}
          />

          <View style={styles.checkoutActions}>
            <Pressable style={styles.secondaryBtn} onPress={savePayoutAccount} disabled={!payoutLoaded || !canManageFinanciën}>
              <ThemedText type="defaultSemiBold" style={styles.secondaryBtnText}>
                Opslaan
              </ThemedText>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={generateSepaRequest} disabled={!payoutLoaded || !canManageFinanciën}>
              <ThemedText type="defaultSemiBold" style={styles.primaryBtnText}>
                SEPA betaalverzoek
              </ThemedText>
            </Pressable>
          </View>

          {sepaPayload ? (
            <View style={styles.payloadBox}>
              <ThemedText style={styles.invoiceLabel}>EPC payload</ThemedText>
              <ThemedText style={styles.payloadText}>{sepaPayload}</ThemedText>
            </View>
          ) : null}
        </View>

        {recommendedPlan ? (
          <View style={styles.recommendationBanner}>
            <View style={styles.recommendationText}>
              <ThemedText type="defaultSemiBold">Slim voorstel van het systeem</ThemedText>
              <ThemedText>
                Voor {customerType.toLowerCase()} past nu `{recommendedPlan.title}` het best, met `{recommendedMethod.label}` als logische betaalflow.
              </ThemedText>
              {advicePinned ? (
                <TazeBadge label="Advies actief" tone="success" />
              ) : null}
            </View>
            <Pressable
              style={styles.recommendationButton}
              disabled={!canManageFinanciën}
              onPress={() => {
                setSelectedPlanId(recommendedPlan.id);
                setSelectedMethodId(recommendedMethod.id);
                cancelCheckout();
                setAdvicePinned(true);
              }}>
              <ThemedText type="defaultSemiBold" style={styles.recommendationButtonText}>
                Gebruik advies
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.checkoutPanel}>
          <View style={styles.liveBanner}>
            <View style={styles.liveBannerIcon}>
              <MaterialIcons name="payments" size={18} color="#0f766e" />
            </View>
            <View style={styles.liveBannerCopy}>
              <ThemedText type="defaultSemiBold">Live betaalroute</ThemedText>
              <ThemedText style={styles.liveBannerText}>
                Open de live betaalpagina met dezelfde serverflow als in productie.
              </ThemedText>
            </View>
            <Pressable
              style={styles.liveBannerButton}
              onPress={() => router.push('/stripe-checkout')}
              accessibilityRole="button"
              accessibilityLabel="Open betaling">
              <ThemedText type="defaultSemiBold" style={styles.liveBannerButtonText}>
                Open betaling
              </ThemedText>
            </Pressable>
          </View>

          <TazeSectionHeader
            title="Werkvloerwaarde eerst"
            subtitle="Geen agressieve betaalmuur: eerst scan, bewijs, locatie, trace en managercontrole. AI is een voorstel-laag."
            badge="Prijzen"
            badgeTone="accent"
            style={styles.sectionHeader}
          />

          <View style={styles.audienceLayout}>
            <View style={styles.audienceToggleGroup}>
              <ThemedText type="defaultSemiBold" style={styles.audienceGroupTitle}>
                Positionering
              </ThemedText>
              <View style={styles.audienceToggleRow}>
                {customerTypes.map((type) => {
                  const active = type === customerType;

                  return (
                    <Pressable
                      key={type}
                      style={[styles.audienceChip, active && styles.audienceChipActive]}
                      disabled={!canManageFinanciën}
                      onPress={() => {
                        setCustomerType(type);
                        cancelCheckout();
                      }}>
                      <ThemedText
                        type="defaultSemiBold"
                        style={active ? styles.audienceChipTextActive : styles.audienceChipText}>
                        {type}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.audienceAppsPanel}>
              <View style={styles.audienceAppsHeader}>
                <ThemedText type="defaultSemiBold" style={styles.audienceAppsTitle}>
                  Vervoer apps
                </ThemedText>
                <TazeBadge label="Top 5 mondiaal" tone="accent" />
              </View>
              <ThemedText style={styles.audienceAppsHint}>
                Uber, Bolt en de sterkste wereldspelers staan nu expliciet in de hub.
              </ThemedText>
              <View style={styles.transportTopGrid}>
                {topTransportApps.map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.transportTopCard,
                      { borderColor: item.tone, backgroundColor: item.surface, opacity: pressed ? 0.94 : 1 },
                    ]}
                    onPress={() => openHubAppLink(item)}>
                    <View style={styles.transportTopHeader}>
                      <View style={styles.transportTopCopy}>
                        <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
                        <ThemedText style={styles.transportTopMeta}>{item.market}</ThemedText>
                      </View>
                      <TazeBadge label={item.rank} tone="info" />
                    </View>
                    <ThemedText style={styles.transportTopNote}>{item.note}</ThemedText>
                    <View style={styles.transportTopOpenButton}>
                      <ThemedText type="defaultSemiBold" style={styles.transportTopOpenButtonText}>
                        Open {item.label}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
              <ThemedText style={styles.audienceAppsHint}>Alle actieve vervoerslinks</ThemedText>
              <View style={styles.audienceAppsList}>
                {transportAppLinks.map((item) => (
                  <Pressable key={item.id} style={styles.audienceAppChip} onPress={() => openHubAppLink(item)}>
                    <ThemedText type="defaultSemiBold" style={styles.audienceAppChipText}>
                      {item.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              {recommendedTransportPartner ? (
                <View
                  style={[
                    styles.transportRecommendationInline,
                    {
                      borderColor: recommendedTransportPartner.tone,
                      backgroundColor: recommendedTransportPartner.surface,
                    },
                  ]}>
                  <View style={styles.transportRecommendationHeader}>
                    <ThemedText type="defaultSemiBold">Aanbevolen partner</ThemedText>
                    <TazeBadge label={recommendedTransportPartner.label} tone="success" />
                  </View>
                  <ThemedText style={styles.audienceAppsHint}>{recommendedTransportPartner.reason}</ThemedText>
                  <View style={styles.transportInlineActions}>
                    {paymentsTransportPreferenceMeta?.isDefault ? <TazeBadge label="Standaard" tone="success" /> : null}
                    {(paymentsTransportPreferenceMeta?.favoriteCount ?? 0) > 0 ? <TazeBadge label="Favoriet" tone="accent" /> : null}
                    {paymentsTransportPreferenceMeta?.syncMeta ? (
                      <TazeBadge
                        label={paymentsTransportPreferenceMeta.syncMeta.label}
                        tone={paymentsTransportPreferenceMeta.syncMeta.tone}
                      />
                    ) : null}
                  </View>
                  <View style={styles.transportInlineActions}>
                    <TazeButton
                      label="Open partner"
                      icon="launch"
                      variant="secondary"
                      onPress={() =>
                        openTransportPartnerAction(
                          recommendedTransportPartner,
                          `Use case ${customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget'}`
                        ).catch(() => {})
                      }
                    />
                    <TazeButton
                      label="Bewaar favoriet"
                      icon="favorite-border"
                      variant="ghost"
                      onPress={() => savePaymentsTransportFavorite().catch(() => {})}
                    />
                    {(paymentsTransportPreferenceMeta?.favoriteCount ?? 0) > 0 ? (
                      <TazeButton
                        label="Verwijder favoriet"
                        icon="heart-broken"
                        variant="ghost"
                        onPress={() => removePaymentsTransportPreference('favorite').catch(() => {})}
                      />
                    ) : null}
                    <TazeButton
                      label="Zet als standaard"
                      icon="check-circle-outline"
                      variant="ghost"
                      onPress={() => setPaymentsTransportDefault().catch(() => {})}
                    />
                    {paymentsTransportPreferenceMeta?.isDefault ? (
                      <TazeButton
                        label="Verwijder standaard"
                        icon="remove-circle-outline"
                        variant="ghost"
                        onPress={() => removePaymentsTransportPreference('default').catch(() => {})}
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
              <View style={styles.transportOverzichtCard}>
                <View style={styles.transportOverzichtHeader}>
                  <View>
                    <ThemedText type="defaultSemiBold">Transport dashboard</ThemedText>
                    <ThemedText style={styles.audienceAppsHint}>Voorkeuren en syncstatus voor payments.</ThemedText>
                  </View>
                  <TazeBadge
                    label={getTransportPreferenceSyncMeta(transportPreferenceStats.queued > 0 ? 'queued' : transportPreferenceStats.synced > 0 ? 'synced' : 'local').label}
                    tone={getTransportPreferenceSyncMeta(transportPreferenceStats.queued > 0 ? 'queued' : transportPreferenceStats.synced > 0 ? 'synced' : 'local').tone}
                  />
                </View>
                <View style={styles.transportOverzichtGrid}>
                  <View style={styles.transportOverzichtMetric}>
                    <ThemedText style={styles.transportOverzichtLabel}>Actieve scope</ThemedText>
                    <ThemedText type="defaultSemiBold">{transportPreferenceStats.activeScope}</ThemedText>
                  </View>
                  <View style={styles.transportOverzichtMetric}>
                    <ThemedText style={styles.transportOverzichtLabel}>Standaard</ThemedText>
                    <ThemedText type="defaultSemiBold">
                      {transportPreferenceStats.activeDefaultApp?.label ?? recommendedTransportPartner?.label ?? 'Nog leeg'}
                    </ThemedText>
                  </View>
                  <View style={styles.transportOverzichtMetric}>
                    <ThemedText style={styles.transportOverzichtLabel}>Favorieten</ThemedText>
                    <ThemedText type="defaultSemiBold">{transportPreferenceStats.favorites}</ThemedText>
                  </View>
                  <View style={styles.transportOverzichtMetric}>
                    <ThemedText style={styles.transportOverzichtLabel}>Queued</ThemedText>
                    <ThemedText type="defaultSemiBold">{transportPreferenceStats.queued}</ThemedText>
                  </View>
                </View>
                <View style={styles.transportInlineActions}>
                  <TazeButton
                    label="Sync voorkeuren"
                    icon="sync"
                    variant="ghost"
                    onPress={() => syncTransportPreferencesNow().catch(() => {})}
                  />
                  <TazeButton
                    label="Open transportpagina"
                    icon="local-shipping"
                    variant="secondary"
                    onPress={() =>
                      router.push(
                        buildTransportHubPath({
                          region: 'Europa',
                          useCase: customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget',
                          partnerId: recommendedTransportPartner?.id ?? null,
                          source: 'payments',
                        }) as never
                      )
                    }
                  />
                </View>
                {transportFollowupNote ? <ThemedText style={styles.transportOverzichtNote}>{transportFollowupNote}</ThemedText> : null}
              </View>
              <TazeButton
                label="Open transportpagina"
                icon="local-shipping"
                onPress={() =>
                  router.push(
                    buildTransportHubPath({
                      region: 'Europa',
                      useCase: customerType === 'Bedrijven' ? 'Zakelijk' : 'Budget',
                      partnerId: recommendedTransportPartner?.id ?? null,
                      source: 'payments',
                    }) as never
                  )
                }
                variant="secondary"
                style={styles.transportPageButton}
              />
            </View>
          </View>

          <TazeSectionHeader
            title="Facturatieperiode"
            subtitle="Maandelijks voor lage instap of jaarlijks voor een scherper tarief."
            badge="Invoice"
            badgeTone="info"
            style={styles.sectionHeader}
          />

          <View style={styles.invoiceRow}>
            <TazeInput label="Bedrijf ontvanger" value={invoiceTo} onChangeText={setInvoiceTo} placeholder="Klantbedrijf BV" fieldStyle={styles.invoiceCard} />
            <TazeInput
              label="BTW / VAT"
              value={invoiceVat}
              onChangeText={setInvoiceVat}
              placeholder="BE0123456789"
              autoCapitalize="characters"
              fieldStyle={styles.invoiceCard}
            />
          </View>

          <View style={styles.invoiceRow}>
            <TazeInput
              label="Landcode"
              value={invoiceCountry}
              onChangeText={setInvoiceCountry}
              placeholder="BE / NL / DE"
              autoCapitalize="characters"
              fieldStyle={styles.invoiceCard}
            />
            <TazeInput
              label="BTW %"
              value={String(invoiceVatRate)}
              onChangeText={(val) => setInvoiceVatRate(Number.parseFloat(val) || invoiceVatRate)}
              placeholder="21"
              keyboardType="numeric"
              fieldStyle={styles.invoiceCard}
            />
            <TazeInput
              label="Facturatie e-mail"
              value={invoiceEmail}
              onChangeText={setInvoiceEmail}
              placeholder="facturatie@klant.be"
              autoCapitalize="none"
              keyboardType="email-address"
              fieldStyle={styles.invoiceCard}
            />
          </View>

          <View style={styles.invoiceActions}>
            <TazeButton
              icon="save"
              label="Bewaar concept"
              onPress={() => {
                persistInvoiceConcept('manual').then((saved) => {
                  if (saved) {
                    Alert.alert('Concept bewaard', 'Het factuurconcept staat nu in je recente historiek.');
                  }
                });
              }}
              disabled={!canManageFinanciën}
              style={styles.invoiceActionButton}
            />
            <TazeButton
              icon="content-copy"
              label="Kopieer factuurtekst"
              onPress={() => {
                copyInvoiceText().catch(() => {});
              }}
              disabled={!canManageFinanciën}
              style={styles.invoiceActionButton}
            />
            <TazeButton icon="send" label="Mail factuurconcept" onPress={mailInvoiceText} disabled={!canManageFinanciën} style={styles.invoiceActionButton} />
            <TazeButton
              icon="picture-as-pdf"
              label="PDF factuur"
              onPress={() => downloadInvoicePdf().catch(() => {})}
              disabled={!canManageFinanciën}
              style={styles.invoiceActionButton}
            />
          </View>

          <View style={styles.invoicePreviewCard}>
            <View style={styles.invoicePreviewHeader}>
              <View style={styles.invoicePreviewBrandRow}>
                <View style={styles.invoicePreviewLogoFrame}>
                  <TazeLogo size={64} framed={false} />
                </View>
                <View style={styles.invoicePreviewCopy}>
                  <ThemedText type="defaultSemiBold">{BrandIdentity.invoiceLabel}</ThemedText>
                  <ThemedText style={styles.invoicePreviewHint}>
                    Deze tekst volgt direct je ingevulde bedrijfs-, btw- en facturatiegegevens.
                  </ThemedText>
                </View>
              </View>
              <TazeBadge label="TXT + PDF" tone="info" />
            </View>

            <View style={styles.invoicePreviewMetaRow}>
              <View style={styles.invoicePreviewMetaCard}>
                <ThemedText style={styles.invoicePreviewMetaLabel}>Factuurnummer</ThemedText>
                <ThemedText type="defaultSemiBold">{activeInvoiceDraft?.invoiceNumber ?? 'Nog niet bewaard'}</ThemedText>
              </View>
              <View style={styles.invoicePreviewMetaCard}>
                <ThemedText style={styles.invoicePreviewMetaLabel}>Klant</ThemedText>
                <ThemedText type="defaultSemiBold">{invoiceTo}</ThemedText>
              </View>
              <View style={styles.invoicePreviewMetaCard}>
                <ThemedText style={styles.invoicePreviewMetaLabel}>Periode</ThemedText>
                <ThemedText type="defaultSemiBold">
                  {currentYear}-{String(currentMonth + 1).padStart(2, '0')}
                </ThemedText>
              </View>
              <View style={styles.invoicePreviewMetaCard}>
                <ThemedText style={styles.invoicePreviewMetaLabel}>Totaal incl. BTW</ThemedText>
                <ThemedText type="defaultSemiBold">{formatCurrency(monthInvoiceTotal)}</ThemedText>
              </View>
            </View>

            {activeInvoiceDraft ? (
              <View style={styles.invoiceDraftStatusRow}>
                <TazeBadge
                  label={getInvoiceStatusMeta(activeInvoiceDraft.status).label}
                  tone={getInvoiceStatusMeta(activeInvoiceDraft.status).tone}
                />
                <TazeBadge
                  label={getInvoiceSyncMeta(activeInvoiceDraft.syncState).label}
                  tone={getInvoiceSyncMeta(activeInvoiceDraft.syncState).tone}
                />
              </View>
            ) : null}

            <View style={styles.invoicePreviewBody}>
              <ThemedText style={styles.invoicePreviewText}>{invoicePreviewText}</ThemedText>
            </View>
          </View>

          <View style={styles.invoiceHistoryPanel}>
            <TazeSectionHeader
              title="Recente concepten"
              subtitle="Herlaad eerder bewaarde factuurconcepten met klant-, plan- en betaalinstellingen."
              badge={`History ${invoiceHistory.length}`}
              badgeTone="accent"
              style={styles.sectionHeader}
            />
            {invoiceHistory.length ? (
              <View style={styles.invoiceHistoryList}>
                {invoiceHistory.slice(0, 4).map((draft) => (
                  <View key={draft.id} style={styles.invoiceHistoryCard}>
                    <View style={styles.invoiceHistoryCopy}>
                      <ThemedText type="defaultSemiBold">{draft.invoiceTo}</ThemedText>
                      <View style={styles.invoiceHistoryBadgeRow}>
                        <TazeBadge
                          label={getInvoiceStatusMeta(draft.status).label}
                          tone={getInvoiceStatusMeta(draft.status).tone}
                        />
                        <TazeBadge
                          label={getInvoiceSyncMeta(draft.syncState).label}
                          tone={getInvoiceSyncMeta(draft.syncState).tone}
                        />
                      </View>
                      <ThemedText style={styles.invoiceHistoryMeta}>
                        {new Date(draft.savedAt).toLocaleString('nl-BE')} · {draft.billingCycle} · {formatCurrency(draft.monthInvoiceTotal)}
                      </ThemedText>
                      <ThemedText style={styles.invoiceHistoryMeta}>
                        {draft.invoiceEmail || 'Geen facturatie e-mail'} · {draft.savedFrom}
                      </ThemedText>
                      <ThemedText style={styles.invoiceHistoryMeta}>{draft.invoiceNumber}</ThemedText>
                      <ThemedText style={styles.invoiceHistoryMeta}>
                        vervaldag {formatInvoiceDate(draft.dueDate)} | {draft.paymentReference}
                      </ThemedText>
                      {draft.syncError ? <ThemedText style={styles.invoiceHistoryError}>{draft.syncError}</ThemedText> : null}
                    </View>
                    <View style={styles.invoiceHistoryActions}>
                      <TazeButton
                        label="Open detail"
                        icon="description"
                        onPress={() => router.push(`/invoice/${draft.id}` as never)}
                        variant="secondary"
                      />
                      <TazeButton
                        label="Laad concept"
                        icon="history"
                        onPress={() => applyInvoiceDraft(draft)}
                        variant="secondary"
                      />
                      {draft.status !== 'sent' && draft.status !== 'paid' ? (
                        <TazeButton
                          label="Markeer verzonden"
                          icon="send"
                          onPress={() => updateInvoiceDraftStatus(draft.id, 'sent').catch(() => {})}
                          disabled={!canManageFinanciën}
                          variant="ghost"
                        />
                      ) : null}
                      {draft.status !== 'paid' ? (
                        <TazeButton
                          label="Markeer betaald"
                          icon="check-circle"
                          onPress={() => updateInvoiceDraftStatus(draft.id, 'paid').catch(() => {})}
                          disabled={!canManageFinanciën}
                          variant="primary"
                        />
                      ) : null}
                      {draft.syncState !== 'synced' ? (
                        <TazeButton
                          label="Sync opnieuw"
                          icon="sync"
                          onPress={() => retryInvoiceDraftSync(draft.id).catch(() => {})}
                          disabled={!canManageFinanciën}
                          variant="secondary"
                        />
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.invoiceHistoryEmpty}>
                <ThemedText type="defaultSemiBold">Nog geen bewaarde concepten</ThemedText>
                <ThemedText>Sla een factuurconcept op, kopieer het of maak een PDF om hier historiek op te bouwen.</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.billingHubRow}>
            <View style={styles.billingCycleCard}>
              <ThemedText type="defaultSemiBold" style={styles.setupPanelTitle}>
                Facturatiecyclus
              </ThemedText>
              <View style={styles.billingCycleRow}>
                {billingCycles.map((cycle) => {
                  const active = cycle === billingCycle;

                  return (
                    <Pressable
                      key={cycle}
                      style={[styles.billingCycleChip, active && styles.billingCycleChipActive]}
                      disabled={!canManageFinanciën}
                      onPress={() => {
                        setBillingCycle(cycle);
                        cancelCheckout();
                      }}>
                      <ThemedText
                        type="defaultSemiBold"
                        style={active ? styles.billingCycleChipTextActive : styles.billingCycleChipText}>
                        {cycle}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.hubLinksPanelInline}>
              <ThemedText type="defaultSemiBold" style={styles.setupPanelTitle}>
                Doorlink apps
              </ThemedText>
              <ThemedText style={styles.setupPanelBody}>Alleen app</ThemedText>
              <View style={styles.hubLinksGrid}>
                {hubAppLinks.map((item) => (
                  <Pressable key={item.id} style={styles.hubLinkChip} onPress={() => openHubAppLink(item)}>
                    <ThemedText type="defaultSemiBold" style={styles.hubLinkChipText}>
                      {item.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <TazeSectionHeader
            title="Pakketten"
            subtitle="Start is beperkt, Werkvloer is operationeel, Pro breidt AI en controle uit, Multi dekt meerdere locaties en Enterprise is maatwerk."
            badge="Plans"
            badgeTone="warning"
            style={styles.sectionHeader}
          />

          <View style={styles.planGrid}>
            {visiblePlans.map((plan) => {
              const active = plan.id === selectedPlan?.id;
              const activePrice = getPlanPriceByBillingCycle(plan, billingCycle);

              return (
                <Pressable
                  key={plan.id}
                  style={[
                    styles.planCard,
                    { borderColor: plan.tone, backgroundColor: plan.surface },
                    active && styles.planCardActive,
                  ]}
                  disabled={!canManageFinanciën}
                  onPress={() => {
                    setSelectedPlanId(plan.id);
                    cancelCheckout();
                  }}>
                  <View style={styles.planHeader}>
                    <View style={styles.planText}>
                      <ThemedText type="defaultSemiBold" style={active ? styles.planTitleActive : undefined}>
                        {plan.title}
                      </ThemedText>
                      <ThemedText style={active ? styles.planTextActive : styles.planBadge}>
                        {plan.badge}
                      </ThemedText>
                    </View>
                    <View style={[styles.planPriceWrap, { backgroundColor: active ? 'rgba(255,255,255,0.16)' : '#ffffff' }]}>
                      <ThemedText type="defaultSemiBold" style={active ? styles.planPriceActive : styles.planPrice}>
                        {plan.id === 'enterprise' ? `Vanaf ${formatCurrency(plan.monthlyPrice)}` : formatCurrency(activePrice)}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={active ? styles.planPriceScopeActive : styles.planPriceScope}>
                    {plan.id === 'enterprise' ? 'Per maand, offerte op maat' : 'Per maand'}
                  </ThemedText>

                  <ThemedText style={active ? styles.planTextActive : styles.planFeatureText}>
                    {plan.target}
                  </ThemedText>

                  <ThemedText style={active ? styles.planTextActive : undefined}>{plan.description}</ThemedText>

                  <View style={styles.planFeatureList}>
                    {plan.features.map((feature) => (
                      <View key={`${plan.id}-${feature}`} style={styles.planFeatureRow}>
                        <View style={[styles.planFeatureDot, active && styles.planFeatureDotActive]} />
                        <ThemedText style={active ? styles.planTextActive : styles.planFeatureText}>
                          {feature}
                        </ThemedText>
                      </View>
                    ))}
                  </View>

                  <ThemedText style={active ? styles.planMetaActive : styles.planMeta}>
                    Jaarlijks: {plan.yearlyPrice > 0 ? formatCurrency(plan.yearlyPrice) : 'Offerte'}
                  </ThemedText>
                  <ThemedText style={active ? styles.planMetaActive : styles.planMeta}>
                    {plan.promise}
                  </ThemedText>
                  <View style={[styles.planCta, active && styles.planCtaActive]}>
                    <ThemedText type="defaultSemiBold" style={active ? styles.planCtaTextActive : styles.planCtaText}>
                      {plan.cta}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.pricingTrustBox}>
            <ThemedText type="defaultSemiBold" style={styles.pricingTrustTitle}>
              2 maanden voordeel bij jaarlijkse betaling
            </ThemedText>
            <ThemedText style={styles.pricingTrustText}>
              AI beslist nooit automatisch over voorraad, locatie of bewijs. Taze gebruikt AI als voorstel- en controlelaag. De menselijke keuze blijft de bron van waarheid.
            </ThemedText>
          </View>

          <TazeSectionHeader
            title="Extra's"
            subtitle="Optionele uitbreidingen voor teams die later groeien."
            badge="Add-ons"
            badgeTone="neutral"
            style={styles.sectionHeader}
          />

          <View style={styles.pricingExtrasGrid}>
            {pricingExtras.map((extra) => (
              <View key={extra} style={styles.pricingExtraCard}>
                <MaterialIcons name="add-circle-outline" size={18} color="#0f766e" />
                <ThemedText style={styles.pricingExtraText}>{extra}</ThemedText>
              </View>
            ))}
          </View>

          <TazeSectionHeader
            title="Categorieën"
            subtitle="Kies welke groep betaalmethodes je wilt tonen in de hub."
            badge="Methods"
            badgeTone="neutral"
            style={styles.sectionHeader}
          />

          <View style={styles.categoryRow}>
            {methodCounts.map(({ category, count }) => {
              const active = category === selectedCategory;

              return (
                <Pressable
                  key={category}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(category)}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={active ? styles.categoryChipTextActive : styles.categoryChipText}>
                    {category}
                  </ThemedText>
                  <ThemedText style={active ? styles.categoryCountActive : styles.categoryCount}>
                    {count}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <TazeSectionHeader
            title="Beschikbare methodes"
            subtitle={`${checkoutMessage} Klik op een blok of op \`Koppel in Stripe\` om direct door te linken.`}
            badge="Betaling"
            badgeTone="primary"
            style={styles.sectionHeader}
          />

          <View style={styles.methodGrid}>
            {visibleMethods.map((method) => {
              const isSelected = method.id === selectedMethod.id;

              return (
                <View
                  key={method.id}
                  style={[
                    styles.methodCard,
                    { borderColor: method.tone, backgroundColor: method.surface },
                    isSelected && styles.methodCardActive,
                  ]}>
                  <Pressable
                    style={styles.methodCardLinkArea}
                    disabled={!canManageFinanciën}
                    onPress={() => {
                      setSelectedMethodId(method.id);
                      cancelCheckout();
                      openMethodConnectLink(method);
                    }}>
                    <View style={styles.methodCardHeader}>
                      <View style={[styles.methodIconWrap, { backgroundColor: method.tone }]}>
                        <MaterialIcons name={method.icon} size={20} color="#fff" />
                      </View>
                      <View style={styles.methodHeaderText}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={isSelected ? styles.methodTitleActive : undefined}>
                          {method.label}
                        </ThemedText>
                        <ThemedText style={isSelected ? styles.methodTextActive : styles.methodMeta}>
                          {method.category}
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText style={isSelected ? styles.methodTextActive : undefined}>
                      {method.detail}
                    </ThemedText>

                    <View style={styles.methodFacts}>
                      <View style={styles.methodFact}>
                        <ThemedText style={isSelected ? styles.methodFactLabelActive : styles.methodFactLabel}>
                          Fee
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={isSelected ? styles.methodTextActive : undefined}>
                          {method.fee}
                        </ThemedText>
                      </View>
                      <View style={styles.methodFact}>
                        <ThemedText style={isSelected ? styles.methodFactLabelActive : styles.methodFactLabel}>
                          Snelheid
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={isSelected ? styles.methodTextActive : undefined}>
                          {method.speed}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.methodHintRow}>
                      <MaterialIcons name="open-in-new" size={14} color={isSelected ? '#ede9fe' : '#1d4ed8'} />
                      <ThemedText style={isSelected ? styles.methodHintTextActive : styles.methodHintText}>
                        Open Stripe-koppeling
                      </ThemedText>
                    </View>
                  </Pressable>

                  <View style={styles.methodCardActionRow}>
                    <Pressable
                      style={[styles.methodSelectButton, isSelected && styles.methodSelectButtonActive]}
                      disabled={!canManageFinanciën}
                      onPress={() => {
                        setSelectedMethodId(method.id);
                        cancelCheckout();
                      }}>
                      <ThemedText
                        type="defaultSemiBold"
                        style={isSelected ? styles.methodSelectButtonTextActive : styles.methodSelectButtonText}>
                        {isSelected ? 'Geselecteerd voor betaling' : 'Gebruik voor betaling'}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      style={[styles.methodLinkButton, isSelected && styles.methodLinkButtonActive]}
                      disabled={!canManageFinanciën}
                      onPress={() => {
                        setSelectedMethodId(method.id);
                        cancelCheckout();
                        openMethodConnectLink(method);
                      }}>
                      <ThemedText
                        type="defaultSemiBold"
                        style={isSelected ? styles.methodLinkButtonTextActive : styles.methodLinkButtonText}>
                        Koppel in Stripe
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.checkoutBox}>
            <View style={styles.checkoutSelected}>
              <View>
                <ThemedText type="defaultSemiBold">Geselecteerd pakket</ThemedText>
                <ThemedText style={styles.selectedMethodName}>
                  {selectedPlan ? `${selectedPlan.title} - ${selectedMethod.label}` : selectedMethod.label}
                </ThemedText>
              </View>
              <View style={[styles.methodIconWrap, { backgroundColor: selectedMethod.tone }]}>
                <MaterialIcons name={selectedMethod.icon} size={22} color="#fff" />
              </View>
            </View>
            <View style={styles.billingCycleBadgeRow}>
              {billingCycles.map((cycle) => {
                const active = cycle === billingCycle;
                return <TazeBadge key={cycle} label={cycle} tone={active ? 'accent' : 'neutral'} />;
              })}
            </View>
            <ThemedText style={styles.billingCycleHint}>{billingCycleHint}</ThemedText>

            <View style={styles.amountRow}>
              <ThemedText>{billingCycleLabel}</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(basePlanPrice)}</ThemedText>
            </View>
            <View style={styles.amountRow}>
              <ThemedText>Onboarding</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(onboardingFee)}</ThemedText>
            </View>
            {billingCycleDiscountLabel ? (
              <View style={styles.amountRow}>
                <ThemedText>{billingCycleDiscountLabel}</ThemedText>
                <ThemedText type="defaultSemiBold">- {formatCurrency(billingCycleDiscount)}</ThemedText>
              </View>
            ) : null}
            <View style={styles.amountRow}>
              <ThemedText>Transactiekost {selectedMethod.label}</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCurrency(transactionEstimate)}</ThemedText>
            </View>
            <View style={[styles.amountRow, styles.totalRow]}>
              <ThemedText type="defaultSemiBold">Te betalen nu</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.totalValue}>
                {formatCurrency(total)}
              </ThemedText>
            </View>

            {stripeWarning ? (
              <View style={styles.checkoutWarning}>
                <ThemedText style={styles.checkoutWarningText}>{stripeWarning}</ThemedText>
              </View>
            ) : null}

            <View style={styles.checkoutActions}>
              <Pressable
                style={[styles.primaryBtn, checkoutBlocked ? styles.primaryBtnDisabled : null]}
                disabled={checkoutBlocked}
                onPress={async () => {
                  if (!canManageFinanciën) {
                    Alert.alert('Alleen-lezen', getPermissionMessage('manage_finance'));
                    return;
                  }
                  const saved = await persistInvoiceConcept('checkout');
                  if (!saved) {
                    return;
                  }
                  setCheckoutState('processing');
                  const checkoutResult = await tryStripeCheckout();
                  if (checkoutResult.ok !== false) {
                    return;
                  }
                  setCheckoutState('idle');
                  setItem(PENDING_CHECKOUT_STORAGE_KEY, '').catch(() => {});
                  const { reason } = checkoutResult;

                  if (reason === 'stripe_not_configured') {
                    Alert.alert(
                      'Stripe niet gekoppeld',
                      'Betalen is geblokkeerd omdat STRIPE_SECRET_KEY ontbreekt op de server. Zet die secret op je productiehost of Cloudflare Worker. Zie docs/STRIPE_SETUP.md.'
                    );
                    return;
                  }
                  if (reason === 'price_not_configured') {
                    Alert.alert(
                      'Prijs-ID ontbreekt',
                      'Voor dit pakket/periode ontbreekt een STRIPE_PRICE_* server-variabele. Zie docs/STRIPE_SETUP.md.'
                    );
                    return;
                  }
                  if (reason === 'bad_return_url') {
                    const expectedOrigin = currentWebOrigin ?? 'http://localhost:3000';
                    Alert.alert(
                      'Return URL geblokkeerd',
                      `RETURN_URL_ORIGINS bevat ${expectedOrigin} nog niet. Voeg deze origin toe op de server.`
                    );
                    return;
                  }
                  if (reason === 'network_error') {
                    Alert.alert('Server niet bereikbaar', 'Controleer of de API-server live bereikbaar is.');
                    return;
                  }
                  if (reason === 'stripe_price_invalid') {
                    Alert.alert(
                      'Stripe prijs ongeldig',
                      'Een STRIPE_PRICE_* ID lijkt ongeldig of hoort bij een andere Stripe omgeving (test/live). Zie docs/STRIPE_SETUP.md.'
                    );
                    return;
                  }
                  if (reason === 'stripe_auth_error') {
                    Alert.alert(
                      'Stripe key ongeldig',
                      'Controleer STRIPE_SECRET_KEY. Deze lijkt ongeldig of verlopen voor deze omgeving. Zie docs/STRIPE_SETUP.md.'
                    );
                    return;
                  }
                  Alert.alert('Betaling mislukt', 'Stripe betaling kon niet worden gestart. Controleer serverlogs en Stripe-config.');
                }}>
                <ThemedText type="defaultSemiBold" style={styles.primaryBtnText}>
                  {checkoutState === 'processing'
                    ? 'Betaling starten...'
                    : checkoutBlocked
                      ? 'Betaling nog niet klaar'
                      : `Activeer ${selectedPlan?.title ?? 'pakket'}`}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.secondaryBtn,
                  refundRequestState === 'processing' || !(latestPaidCheckout?.status === 'paid' || activeInvoiceDraft?.status === 'paid')
                    ? styles.primaryBtnDisabled
                    : null,
                ]}
                disabled={
                  refundRequestState === 'processing' ||
                  !(latestPaidCheckout?.status === 'paid' || activeInvoiceDraft?.status === 'paid') ||
                  !canManageFinanciën
                }
                onPress={() => {
                  void requestRefund();
                }}>
                <ThemedText type="defaultSemiBold" style={styles.secondaryBtnText}>
                  {refundRequestState === 'processing' ? 'Terugbetaling aanvragen...' : 'Terugbetaling aanvragen'}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={cancelCheckout}>
                <ThemedText type="defaultSemiBold" style={styles.secondaryBtnText}>
                  Reset
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.overviewPanel}>
          <TazeSectionHeader
            title="Betaaloverzicht"
            subtitle="Recente transacties en verwachte betalingen op basis van je actuele voorraadflow."
            badge="Overview"
            badgeTone="accent"
            style={styles.sectionHeader}
          />

          <View style={styles.transactionList}>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionHeader}>
                  <View style={styles.transactionText}>
                    <ThemedText type="defaultSemiBold">{transaction.title}</ThemedText>
                    <ThemedText style={styles.transactionMeta}>{transaction.meta}</ThemedText>
                  </View>
                  <View style={styles.transactionAmount}>
                    <ThemedText type="defaultSemiBold">{formatCurrency(transaction.amount)}</ThemedText>
                    <TazeStatusPill label={transaction.status} kind={getTransactionStatusKind(transaction.status)} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
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
  scanAccessBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(236,254,245,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(187,247,208,0.72)',
  },
  scanAccessBannerCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  scanAccessBannerText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 19,
  },
  scanAccessBannerButton: {
    borderRadius: 999,
    backgroundColor: Brand.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  scanAccessBannerButtonText: {
    color: '#ffffff',
  },
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'stretch',
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  heroText: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroBadge: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    justifyContent: 'center',
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.primary,
    gap: 4,
  },
  heroBadgeLabel: {
    color: 'rgba(255,255,255,0.78)',
  },
  heroBadgeValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  heroBadgeSubtext: {
    color: 'rgba(255,255,255,0.78)',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 8,
  },
  permissionNote: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254,215,170,0.72)',
    backgroundColor: 'rgba(255,247,237,0.92)',
    padding: 14,
    gap: 4,
  },
  permissionNoteText: {
    color: '#9a3412',
  },
  smartPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 14,
  },
  smartPanelHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  smartPanelCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  smartScoreBadge: {
    minWidth: 118,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  smartScoreValue: {
    color: '#0f172a',
    fontSize: 28,
  },
  smartScoreLabel: {
    color: '#6b7280',
    fontSize: 11,
  },
  smartSignalRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  smartSignalCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 0,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    gap: 4,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  smartSignalLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  smartSignalValue: {
    color: '#111827',
    fontSize: 17,
  },
  smartSignalDetail: {
    color: '#475569',
    fontSize: 12,
  },
  smartActionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  smartActionCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 16,
    gap: 10,
    justifyContent: 'space-between',
    minHeight: 160,
  },
  smartActionButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  smartActionButtonText: {
    color: '#ffffff',
  },
  recommendationBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 16,
  },
  recommendationText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  recommendationBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(248,250,252,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
  },
  recommendationBadgeText: {
    color: '#334155',
    fontSize: 12,
  },
  recommendationButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: Brand.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  recommendationButtonText: {
    color: '#ffffff',
  },
  bankPanel: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  invoiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  invoiceCard: {
    flexGrow: 1,
    flexBasis: 200,
    gap: 4,
  },
  invoiceLabel: {
    color: '#475569',
    fontSize: 12,
  },
  payloadBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 6,
  },
  payloadText: {
    color: '#0f172a',
    fontSize: 12,
    lineHeight: 18,
  },
  invoiceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  billingHubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  billingCycleCard: {
    flex: 1,
    flexBasis: 0,
    minHeight: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  billingCycleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setupPanelTitle: {
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  setupPanelBody: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
    marginTop: -2,
  },
  billingCycleChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  billingCycleChipActive: {
    borderColor: Brand.primary,
    backgroundColor: Brand.primary,
  },
  billingCycleChipText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  billingCycleChipTextActive: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  hubLinksPanelInline: {
    flex: 1,
    flexBasis: 0,
    minHeight: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 12,
    gap: 6,
  },
  hubLinksInlineHint: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  hubLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -2,
  },
  hubLinkChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubLinkChipText: {
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 18,
  },
  invoiceActionButton: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    alignSelf: 'stretch',
  },
  invoiceHistoryPanel: {
    gap: 10,
    marginBottom: 8,
  },
  invoiceHistoryList: {
    gap: 10,
  },
  invoiceHistoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(233,213,255,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 12,
    gap: 10,
  },
  invoiceHistoryCopy: {
    gap: 3,
  },
  invoiceHistoryBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  invoiceHistoryMeta: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
  },
  invoiceHistoryError: {
    color: '#b45309',
    fontSize: 12,
    lineHeight: 18,
  },
  invoiceHistoryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  invoiceHistoryEmpty: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 4,
  },
  invoicePreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    backgroundColor: '#faf5ff',
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  invoicePreviewHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  invoicePreviewBrandRow: {
    flex: 1,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invoicePreviewLogoFrame: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#020617',
  },
  invoicePreviewLogo: {
    width: '100%',
    height: '100%',
  },
  invoicePreviewCopy: {
    flex: 1,
    minWidth: 180,
    gap: 4,
  },
  invoicePreviewHint: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
  },
  invoicePreviewBadge: {
    borderRadius: 999,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  invoicePreviewBadgeText: {
    color: '#6d28d9',
    fontSize: 12,
    lineHeight: 16,
  },
  invoicePreviewMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  invoicePreviewMetaCard: {
    minWidth: 140,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  invoicePreviewMetaLabel: {
    color: '#6b7280',
    fontSize: 11,
    lineHeight: 16,
  },
  invoiceDraftStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  invoicePreviewBody: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  invoicePreviewText: {
    color: '#0f172a',
    fontSize: 12,
    lineHeight: 20,
  },
  checkoutPanel: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  liveBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 14,
  },
  liveBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6fffb',
  },
  liveBannerCopy: {
    flex: 1,
    minWidth: 220,
    gap: 4,
  },
  liveBannerText: {
    color: '#475569',
  },
  liveBannerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liveBannerButtonText: {
    color: '#ffffff',
  },
  sectionHeader: {
    gap: 4,
    alignItems: 'flex-start',
  },
  sectionHeaderTitle: {
    textAlign: 'left',
  },
  sectionHeaderText: {
    textAlign: 'left',
  },
  audienceLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  audienceToggleGroup: {
    flex: 1,
    flexBasis: 0,
    minWidth: 250,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  audienceGroupTitle: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  audienceToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  audienceChip: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audienceChipActive: {
    backgroundColor: '#6d28d9',
    borderColor: '#6d28d9',
  },
  audienceChipText: {
    color: '#334155',
  },
  audienceChipTextActive: {
    color: '#ffffff',
  },
  audienceAppsPanel: {
    flex: 1,
    flexBasis: 0,
    minWidth: 250,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  audienceAppsHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  audienceAppsTitle: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  audienceAppsHint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: -2,
  },
  audienceAppsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transportRecommendationInline: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  transportRecommendationHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  transportInlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  transportOverzichtCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#f8fafc',
    padding: 12,
    gap: 10,
  },
  transportOverzichtHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  transportOverzichtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  transportOverzichtMetric: {
    minWidth: 120,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  transportOverzichtLabel: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  transportOverzichtNote: {
    color: '#0f766e',
    fontSize: 12,
    lineHeight: 18,
  },
  transportTopGrid: {
    gap: 10,
  },
  transportTopCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  transportTopHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  transportTopCopy: {
    flex: 1,
    minWidth: 160,
    gap: 2,
  },
  transportTopMeta: {
    color: '#475569',
    fontSize: 12,
  },
  transportTopNote: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  transportTopOpenButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  transportTopOpenButtonText: {
    color: '#0f172a',
    fontSize: 12,
  },
  audienceAppChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  audienceAppChipText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  transportPageButton: {
    alignSelf: 'flex-start',
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  planCard: {
    flexGrow: 1,
    flexBasis: 250,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  planCardActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  planText: {
    flex: 1,
    gap: 2,
  },
  planTitleActive: {
    color: '#ffffff',
  },
  planBadge: {
    color: '#64748b',
    fontSize: 13,
  },
  planTextActive: {
    color: '#ede9fe',
  },
  planPriceWrap: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  planPrice: {
    color: '#0f172a',
    fontSize: 18,
  },
  planPriceActive: {
    color: '#ffffff',
    fontSize: 18,
  },
  planPriceScope: {
    color: '#475569',
    fontSize: 12,
  },
  planPriceScopeActive: {
    color: '#ede9fe',
    fontSize: 12,
  },
  planFeatureList: {
    gap: 8,
  },
  planFeatureRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  planFeatureDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: Brand.primary,
    marginTop: 6,
  },
  planFeatureDotActive: {
    backgroundColor: '#ffffff',
  },
  planFeatureText: {
    flex: 1,
    color: '#334155',
  },
  planMeta: {
    color: '#475569',
    fontSize: 13,
  },
  planMetaActive: {
    color: '#ede9fe',
    fontSize: 13,
  },
  planCta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.2)',
  },
  planCtaActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.36)',
  },
  planCtaText: {
    color: '#0f766e',
    fontSize: 13,
  },
  planCtaTextActive: {
    color: '#ffffff',
    fontSize: 13,
  },
  pricingTrustBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.18)',
    backgroundColor: 'rgba(236,254,245,0.86)',
    padding: 16,
    gap: 6,
  },
  pricingTrustTitle: {
    color: '#0f766e',
  },
  pricingTrustText: {
    color: '#334155',
    lineHeight: 21,
  },
  pricingExtrasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pricingExtraCard: {
    flexGrow: 1,
    flexBasis: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    backgroundColor: 'rgba(255,255,255,0.86)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pricingExtraText: {
    flex: 1,
    color: '#334155',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(248,250,252,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
  },
  categoryChipActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  categoryChipText: {
    color: '#334155',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  categoryCount: {
    color: '#64748b',
    fontSize: 13,
  },
  categoryCountActive: {
    color: '#ede9fe',
    fontSize: 13,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  methodCardLinkArea: {
    gap: 10,
  },
  methodCardActive: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  methodCardHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  methodIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodHeaderText: {
    flex: 1,
    gap: 2,
  },
  methodTitleActive: {
    color: '#fff',
  },
  methodTextActive: {
    color: '#ede9fe',
  },
  methodMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  methodFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  methodHintRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  methodHintText: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  methodHintTextActive: {
    color: '#ede9fe',
    fontSize: 12,
  },
  methodFact: {
    gap: 2,
  },
  methodFactLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  methodFactLabelActive: {
    color: '#d8b4fe',
    fontSize: 12,
  },
  methodLinkButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.72)',
    backgroundColor: 'rgba(219,234,254,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  methodLinkButtonActive: {
    borderColor: 'rgba(221,214,254,0.72)',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  methodLinkButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  methodLinkButtonTextActive: {
    color: '#ede9fe',
    fontSize: 12,
  },
  methodCardActionRow: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 8,
  },
  methodSelectButton: {
    flex: 1.2,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  methodSelectButtonActive: {
    borderColor: 'rgba(221,214,254,0.72)',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  methodSelectButtonText: {
    color: '#334155',
    fontSize: 12,
  },
  methodSelectButtonTextActive: {
    color: '#ffffff',
    fontSize: 12,
  },
  checkoutBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 12,
  },
  checkoutSelected: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226,232,240,0.72)',
  },
  billingCycleBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  billingCycleHint: {
    color: '#475569',
    fontSize: 12,
    marginTop: -2,
  },
  selectedMethodName: {
    color: '#6d28d9',
    fontSize: 18,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalRow: {
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226,232,240,0.72)',
  },
  totalValue: {
    color: '#6d28d9',
  },
  checkoutActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: Brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 0,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.72,
  },
  primaryBtnText: {
    color: '#fff',
  },
  checkoutWarning: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  checkoutWarningText: {
    color: '#92400e',
    fontSize: 12,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    minWidth: 0,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#334155',
  },
  overviewPanel: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  transactionList: {
    gap: 10,
  },
  transactionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 16,
  },
  transactionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  transactionText: {
    flex: 1,
    minWidth: 180,
    gap: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
    minWidth: 110,
    gap: 2,
  },
  transactionMeta: {
    color: '#64748b',
  },
});





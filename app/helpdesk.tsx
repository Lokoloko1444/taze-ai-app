import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeChip } from 'components/taze-chip';
import { TazeHero } from 'components/taze-hero';
import { TazeSectionHeader } from 'components/taze-section-header';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import { getCategoryBreakdown, getInventoryMetrics, useInventory } from 'hooks/use-inventory';
import {
  getCachedAiAuditEntries,
  loadAiAuditEntries,
  logAiAuditResponse,
  markAiAuditInteraction,
  markAiAuditOutcome,
  subscribeAiAudit,
  type AiAuditEntry,
} from 'lib/ai-audit';
import { LegalConfig } from 'lib/legal-config';
import { getServerBaseUrl } from 'lib/server-url';
import { buildTransportAiContext, buildTransportHubPath } from 'lib/transport-ai';
import {
  canTalkBack as canTalkBackGlobal,
  loadTalkbackSettings,
  saveTalkbackSettings,
  stopTalkBack,
  talkBack,
} from 'lib/talkback';

type HulpAnswer = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  cta: string;
  href:
    | '/scan'
    | '/explore'
    | '/alerts'
    | '/trace'
    | '/payments'
    | '/partners'
    | '/account'
    | '/security'
    | '/privacy'
    | '/support'
    | '/contact'
    | '/translate'
    | '/transport';
  tone: string;
  surface: string;
};

type DetectedHulpAnswer = {
  answer: HulpAnswer;
  score: number;
  confidenceLabel: string;
  matchedKeywords: string[];
};

type RealAiAnswer = {
  auditId: string;
  title: string;
  answer: string;
  recommendedRoute: HulpAnswer['href'];
  recommendedLabel: string;
  model: string;
};

const riaLanguages = [
  'Nederlands',
  'Francais',
  'English',
  'Deutsch',
  'Espanol',
  'Italiano',
  'Portugues',
  'Arabic',
  'Turkce',
  'Polski',
  'Russkiy',
  'Zhongwen',
] as const;

type RiaLanguage = (typeof riaLanguages)[number];

type RiaCopy = {
  panelTitle: string;
  panelHint: string;
  autoAnswerLabel: string;
  languageLabel: string;
  voiceOnLabel: string;
  voiceOffLabel: string;
  nutritionLabel: string;
  topCategoryLabel: string;
  financeLabel: string;
  revenueLabel: string;
  foodCostLabel: string;
  lossLabel: string;
  profitLabel: string;
  wasteLabel: string;
  actionLabel: string;
  noDataLabel: string;
  openScanner: string;
  openInsights: string;
  openAlerts: string;
  openPayments: string;
  openAccount: string;
  openBeveiliging: string;
  openTranslate: string;
  confidenceLabel: string;
  autoConfidenceLabel: string;
};

const riaLanguageCodeMap: Record<RiaLanguage, string> = {
  Nederlands: 'nl-BE',
  Francais: 'fr-FR',
  English: 'en-US',
  Deutsch: 'de-DE',
  Espanol: 'es-ES',
  Italiano: 'it-IT',
  Portugues: 'pt-PT',
  Arabic: 'ar-SA',
  Turkce: 'tr-TR',
  Polski: 'pl-PL',
  Russkiy: 'ru-RU',
  Zhongwen: 'zh-CN',
};

const riaCopyByLanguage: Record<RiaLanguage, RiaCopy> = {
  Nederlands: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Automatische concrete antwoorden over voeding, winst, verlies en afboekingen.',
    autoAnswerLabel: 'Automatisch antwoord',
    languageLabel: 'Taal',
    voiceOnLabel: 'Talkback aan',
    voiceOffLabel: 'Talkback uit',
    nutritionLabel: 'Voeding',
    topCategoryLabel: 'Topcategorie',
    financeLabel: 'Financiën',
    revenueLabel: 'Omzet',
    foodCostLabel: 'Food cost',
    lossLabel: 'Verlies',
    profitLabel: 'Winst',
    wasteLabel: 'Afboeking',
    actionLabel: 'Volgende stap',
    noDataLabel: 'Nog geen data',
    openScanner: 'Open scanner',
    openInsights: 'Open inzichten',
    openAlerts: 'Open meldingen',
    openPayments: 'Open betalingen',
    openAccount: 'Open account',
    openBeveiliging: 'Open beveiliging',
    openTranslate: 'Open vertalen',
    confidenceLabel: 'Zekerheid',
    autoConfidenceLabel: 'Automatisch',
  },
  Francais: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Reponses automatiques concretes sur nutrition, profit, perte et dechets.',
    autoAnswerLabel: 'Reponse automatique',
    languageLabel: 'Langue',
    voiceOnLabel: 'Talkback actif',
    voiceOffLabel: 'Talkback stop',
    nutritionLabel: 'Nutrition',
    topCategoryLabel: 'Categorie principale',
    financeLabel: 'Financiën',
    revenueLabel: 'Revenu',
    foodCostLabel: 'Cout food',
    lossLabel: 'Perte',
    profitLabel: 'Profit',
    wasteLabel: 'Dechets',
    actionLabel: 'Prochaine etape',
    noDataLabel: 'Pas de donnees',
    openScanner: 'Ouvrir scanner',
    openInsights: 'Ouvrir insights',
    openAlerts: 'Ouvrir alerts',
    openPayments: 'Ouvrir paiements',
    openAccount: 'Ouvrir account',
    openBeveiliging: 'Ouvrir security',
    openTranslate: 'Ouvrir translate',
    confidenceLabel: 'Confiance',
    autoConfidenceLabel: 'Auto',
  },
  English: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Automatic concrete answers for nutrition, profit, loss and waste.',
    autoAnswerLabel: 'Automatic answer',
    languageLabel: 'Language',
    voiceOnLabel: 'Talkback on',
    voiceOffLabel: 'Talkback off',
    nutritionLabel: 'Nutrition',
    topCategoryLabel: 'Top category',
    financeLabel: 'Financiën',
    revenueLabel: 'Revenue',
    foodCostLabel: 'Food cost',
    lossLabel: 'Loss',
    profitLabel: 'Profit',
    wasteLabel: 'Waste',
    actionLabel: 'Next step',
    noDataLabel: 'No data yet',
    openScanner: 'Open scanner',
    openInsights: 'Open inzichten',
    openAlerts: 'Open meldingen',
    openPayments: 'Open betalingen',
    openAccount: 'Open account',
    openBeveiliging: 'Open beveiliging',
    openTranslate: 'Open vertalen',
    confidenceLabel: 'Confidence',
    autoConfidenceLabel: 'Automatic',
  },
  Deutsch: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Automatische konkrete Antworten zu Nahrung, Gewinn, Verlust und Abfall.',
    autoAnswerLabel: 'Automatische Antwort',
    languageLabel: 'Sprache',
    voiceOnLabel: 'Talkback an',
    voiceOffLabel: 'Talkback aus',
    nutritionLabel: 'Ernahrung',
    topCategoryLabel: 'Top Kategorie',
    financeLabel: 'Finanzen',
    revenueLabel: 'Umsatz',
    foodCostLabel: 'Food cost',
    lossLabel: 'Verlust',
    profitLabel: 'Gewinn',
    wasteLabel: 'Abfall',
    actionLabel: 'Nachster Schritt',
    noDataLabel: 'Keine Daten',
    openScanner: 'Scanner openen',
    openInsights: 'Insights offnen',
    openAlerts: 'Alerts offnen',
    openPayments: 'Zahlungen offnen',
    openAccount: 'Account offnen',
    openBeveiliging: 'Beveiliging offnen',
    openTranslate: 'Translate offnen',
    confidenceLabel: 'Sicherheit',
    autoConfidenceLabel: 'Automatisch',
  },
  Espanol: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Respuestas automaticas concretas sobre nutricion, ganancia, perdida y residuos.',
    autoAnswerLabel: 'Respuesta automatica',
    languageLabel: 'Idioma',
    voiceOnLabel: 'Talkback activo',
    voiceOffLabel: 'Talkback apagado',
    nutritionLabel: 'Nutricion',
    topCategoryLabel: 'Categoria principal',
    financeLabel: 'Finanzas',
    revenueLabel: 'Ingresos',
    foodCostLabel: 'Food cost',
    lossLabel: 'Perdida',
    profitLabel: 'Ganancia',
    wasteLabel: 'Residuos',
    actionLabel: 'Siguiente paso',
    noDataLabel: 'Sin datos',
    openScanner: 'Abrir scanner',
    openInsights: 'Abrir insights',
    openAlerts: 'Abrir alerts',
    openPayments: 'Abrir pagos',
    openAccount: 'Abrir account',
    openBeveiliging: 'Abrir security',
    openTranslate: 'Abrir translate',
    confidenceLabel: 'Confianza',
    autoConfidenceLabel: 'Automatico',
  },
  Italiano: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Risposte automatiche concrete su nutrizione, profitto, perdita e spreco.',
    autoAnswerLabel: 'Risposta automatica',
    languageLabel: 'Lingua',
    voiceOnLabel: 'Talkback acceso',
    voiceOffLabel: 'Talkback spento',
    nutritionLabel: 'Nutrizione',
    topCategoryLabel: 'Categoria top',
    financeLabel: 'Finanza',
    revenueLabel: 'Ricavi',
    foodCostLabel: 'Food cost',
    lossLabel: 'Perdita',
    profitLabel: 'Profitto',
    wasteLabel: 'Spreco',
    actionLabel: 'Prossimo passo',
    noDataLabel: 'Nessun dato',
    openScanner: 'Apri scanner',
    openInsights: 'Apri insights',
    openAlerts: 'Apri alerts',
    openPayments: 'Apri pagamenti',
    openAccount: 'Apri account',
    openBeveiliging: 'Apri security',
    openTranslate: 'Apri translate',
    confidenceLabel: 'Fiducia',
    autoConfidenceLabel: 'Auto',
  },
  Portugues: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Respostas automaticas concretas sobre nutricao, lucro, perda e desperdicio.',
    autoAnswerLabel: 'Resposta automatica',
    languageLabel: 'Idioma',
    voiceOnLabel: 'Talkback ligado',
    voiceOffLabel: 'Talkback desligado',
    nutritionLabel: 'Nutricao',
    topCategoryLabel: 'Categoria principal',
    financeLabel: 'Financas',
    revenueLabel: 'Receita',
    foodCostLabel: 'Food cost',
    lossLabel: 'Perda',
    profitLabel: 'Lucro',
    wasteLabel: 'Desperdicio',
    actionLabel: 'Proximo passo',
    noDataLabel: 'Sem dados',
    openScanner: 'Abrir scanner',
    openInsights: 'Abrir insights',
    openAlerts: 'Abrir alerts',
    openPayments: 'Abrir pagamentos',
    openAccount: 'Abrir account',
    openBeveiliging: 'Abrir security',
    openTranslate: 'Abrir translate',
    confidenceLabel: 'Confianca',
    autoConfidenceLabel: 'Automatico',
  },
  Arabic: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Auto answers for nutrition, profit, loss and waste.',
    autoAnswerLabel: 'Auto answer',
    languageLabel: 'Language',
    voiceOnLabel: 'Talkback on',
    voiceOffLabel: 'Talkback off',
    nutritionLabel: 'Nutrition',
    topCategoryLabel: 'Top category',
    financeLabel: 'Financiën',
    revenueLabel: 'Revenue',
    foodCostLabel: 'Food cost',
    lossLabel: 'Loss',
    profitLabel: 'Profit',
    wasteLabel: 'Waste',
    actionLabel: 'Next step',
    noDataLabel: 'No data',
    openScanner: 'Open scanner',
    openInsights: 'Open inzichten',
    openAlerts: 'Open meldingen',
    openPayments: 'Open betalingen',
    openAccount: 'Open account',
    openBeveiliging: 'Open beveiliging',
    openTranslate: 'Open vertalen',
    confidenceLabel: 'Confidence',
    autoConfidenceLabel: 'Automatic',
  },
  Turkce: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Beslenme, kar, zarar ve atik icin otomatik somut cevaplar.',
    autoAnswerLabel: 'Otomatik cevap',
    languageLabel: 'Dil',
    voiceOnLabel: 'Talkback acik',
    voiceOffLabel: 'Talkback kapali',
    nutritionLabel: 'Beslenme',
    topCategoryLabel: 'En iyi kategori',
    financeLabel: 'Finans',
    revenueLabel: 'Gelir',
    foodCostLabel: 'Food cost',
    lossLabel: 'Zarar',
    profitLabel: 'Kar',
    wasteLabel: 'Atik',
    actionLabel: 'Sonraki adim',
    noDataLabel: 'Veri yok',
    openScanner: 'Scanner ac',
    openInsights: 'Insights ac',
    openAlerts: 'Alerts ac',
    openPayments: 'Payments ac',
    openAccount: 'Account ac',
    openBeveiliging: 'Beveiliging ac',
    openTranslate: 'Translate ac',
    confidenceLabel: 'Guven',
    autoConfidenceLabel: 'Otomatik',
  },
  Polski: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Automatyczne konkretne odpowiedzi o zywnosci, zysku, stracie i odpadach.',
    autoAnswerLabel: 'Automatyczna odpowiedz',
    languageLabel: 'Jezyk',
    voiceOnLabel: 'Talkback wlaczony',
    voiceOffLabel: 'Talkback wylaczony',
    nutritionLabel: 'Zywnosc',
    topCategoryLabel: 'Top kategoria',
    financeLabel: 'Finanse',
    revenueLabel: 'Przychod',
    foodCostLabel: 'Food cost',
    lossLabel: 'Strata',
    profitLabel: 'Zysk',
    wasteLabel: 'Odpady',
    actionLabel: 'Nastepny krok',
    noDataLabel: 'Brak danych',
    openScanner: 'Otworz scanner',
    openInsights: 'Otworz insights',
    openAlerts: 'Otworz alerts',
    openPayments: 'Otworz payments',
    openAccount: 'Otworz account',
    openBeveiliging: 'Otworz security',
    openTranslate: 'Otworz translate',
    confidenceLabel: 'Pewnosc',
    autoConfidenceLabel: 'Auto',
  },
  Russkiy: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Avto konkretnye otvety po pitaniyu, pribyli, ubytku i othodam.',
    autoAnswerLabel: 'Avto otvet',
    languageLabel: 'Yazyk',
    voiceOnLabel: 'Talkback on',
    voiceOffLabel: 'Talkback off',
    nutritionLabel: 'Pitanie',
    topCategoryLabel: 'Top kategoriya',
    financeLabel: 'Finansy',
    revenueLabel: 'Vyruchka',
    foodCostLabel: 'Food cost',
    lossLabel: 'Ubytok',
    profitLabel: 'Pribyl',
    wasteLabel: 'Othody',
    actionLabel: 'Sleduyushchiy shag',
    noDataLabel: 'Net dannyh',
    openScanner: 'Open scanner',
    openInsights: 'Open inzichten',
    openAlerts: 'Open meldingen',
    openPayments: 'Open betalingen',
    openAccount: 'Open account',
    openBeveiliging: 'Open beveiliging',
    openTranslate: 'Open vertalen',
    confidenceLabel: 'Uverennost',
    autoConfidenceLabel: 'Avto',
  },
  Zhongwen: {
    panelTitle: 'Ria Talkback',
    panelHint: 'Auto concrete answers for nutrition, profit, loss and waste.',
    autoAnswerLabel: 'Auto answer',
    languageLabel: 'Language',
    voiceOnLabel: 'Talkback on',
    voiceOffLabel: 'Talkback off',
    nutritionLabel: 'Nutrition',
    topCategoryLabel: 'Top category',
    financeLabel: 'Financiën',
    revenueLabel: 'Revenue',
    foodCostLabel: 'Food cost',
    lossLabel: 'Loss',
    profitLabel: 'Profit',
    wasteLabel: 'Waste',
    actionLabel: 'Next step',
    noDataLabel: 'No data',
    openScanner: 'Open scanner',
    openInsights: 'Open inzichten',
    openAlerts: 'Open meldingen',
    openPayments: 'Open betalingen',
    openAccount: 'Open account',
    openBeveiliging: 'Open beveiliging',
    openTranslate: 'Open vertalen',
    confidenceLabel: 'Confidence',
    autoConfidenceLabel: 'Automatic',
  },
};

function getRiaLanguageCode(language: RiaLanguage) {
  return riaLanguageCodeMap[language] ?? 'en-US';
}

function formatCurrencyByLanguage(amount: number, language: RiaLanguage) {
  try {
    return new Intl.NumberFormat(getRiaLanguageCode(language), {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} EUR`;
  }
}

function getRouteActionLabel(href: HulpAnswer['href'], copy: RiaCopy) {
  if (href === '/scan') return copy.openScanner;
  if (href === '/explore') return copy.openInsights;
  if (href === '/alerts') return copy.openAlerts;
  if (href === '/trace') return 'Open trace';
  if (href === '/payments') return copy.openPayments;
  if (href === '/partners') return 'Open partners';
  if (href === '/account') return copy.openAccount;
  if (href === '/security') return copy.openBeveiliging;
  if (href === '/privacy') return 'Open privacy';
  if (href === '/support') return 'Open support';
  if (href === '/contact') return 'Open contact';
  if (href === '/transport') return 'Open transporthub';
  return copy.openTranslate;
}

function getLocalizedHulpAnswer(answer: HulpAnswer, copy: RiaCopy) {
  const action = getRouteActionLabel(answer.href, copy);

  switch (answer.id) {
    case 'scanner':
      return {
        title: 'Scanner',
        text: `${action}.`,
        cta: action,
      };
    case 'stock':
      return {
        title: 'Stock',
        text: `${action}.`,
        cta: action,
      };
    case 'waste':
      return {
        title: copy.wasteLabel,
        text: `${action}.`,
        cta: action,
      };
    case 'finance':
      return {
        title: copy.financeLabel,
        text: `${copy.revenueLabel}, ${copy.foodCostLabel}, ${copy.lossLabel}. ${action}.`,
        cta: action,
      };
    case 'payments':
      return {
        title: 'Payments',
        text: `${action}.`,
        cta: action,
      };
    case 'account':
      return {
        title: 'Account',
        text: `${action}.`,
        cta: action,
      };
    case 'security':
      return {
        title: 'Beveiliging',
        text: `${action}.`,
        cta: action,
      };
    case 'privacy':
      return {
        title: 'Privacy',
        text: `${action}.`,
        cta: action,
      };
    case 'support':
      return {
        title: 'Hulp',
        text: `${action}.`,
        cta: action,
      };
    case 'contact':
      return {
        title: 'Contact',
        text: `${action}.`,
        cta: action,
      };
    case 'translate':
      return {
        title: 'Translate',
        text: `${action}.`,
        cta: action,
      };
    case 'food-safety':
      return {
        title: 'Food safety',
        text: `${action}.`,
        cta: action,
      };
    default:
      return {
        title: answer.title,
        text: answer.answer,
        cta: action,
      };
  }
}

const supportAnswers: HulpAnswer[] = [
  {
    id: 'scanner',
    title: 'Scanner en camera',
    keywords: [
      'scan',
      'scanner',
      'camera',
      'barcode',
      'qr',
      'foto',
      'photo',
      'scan not working',
      'scanner werkt niet',
    ],
    answer:
      'Open direct de scanner. Controleer daar meteen camera, barcode en foto-opname in dezelfde flow.',
    cta: 'Open scanner',
    href: '/scan',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'stock',
    title: 'Stock en vestigingen',
    keywords: [
      'stock',
      'voorraad',
      'inventory',
      'inventaire',
      'vestiging',
      'locatie',
      'producten',
      'inzicht',
      'inzichten',
    ],
    answer:
      'Open inzichten om voorraad, vestigingen, bestellijsten en aantallen direct te bekijken of aan te passen.',
    cta: 'Open inzichten',
    href: '/explore',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'waste',
    title: 'Waste en verval',
    keywords: ['waste', 'verval', 'over datum', 'verlies', 'alerts', 'alert', 'expiry', 'expiration', 'perime'],
    answer:
      'Open alerts voor vervaldruk en waste-risico. Daar zie je meteen welke producten eerst aandacht nodig hebben.',
    cta: 'Open alerts',
    href: '/alerts',
    tone: '#c2410c',
    surface: '#fff7ed',
  },
  {
    id: 'food-safety',
    title: 'Food safety en traceerbaarheid',
    keywords: ['food safety', 'veiligheid', 'traceer', 'traceability', 'haccp', 'compliance'],
    answer: 'Open inzichten om korte houdbaarheid, traceerbaarheid en operationele voorraad sneller op te volgen.',
    cta: 'Open inzichten',
    href: '/explore',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'refund',
    title: 'Terugbetaling en geld terug',
    keywords: ['refund', 'refunds', 'terugbetaling', 'terugbetalingen', 'geld terug', 'niet tevreden', 'money back'],
    answer:
      'Open betalingen om je terugbetalingsaanvraag te starten. Support keurt de Stripe-refund daarna direct goed en de klant krijgt automatisch bevestiging.',
    cta: 'Open betalingen',
    href: '/payments',
    tone: '#b91c1c',
    surface: '#fef2f2',
  },
  {
    id: 'payments',
    title: 'Pakketten en betalingen',
    keywords: [
      'betaling',
      'betalen',
      'payment',
      'paiement',
      'prijs',
      'prijzen',
      'pricing',
      'pakket',
      'abonnement',
      'subscription',
      'factuur',
      'invoice',
      'bedrijf',
      'particulier',
    ],
    answer:
      'Open betalingen om prijzen, pakketten, facturatie en betaalmethodes direct na te kijken.',
    cta: 'Open betalingen',
    href: '/payments',
    tone: '#7c3aed',
    surface: '#f5f3ff',
  },
  {
    id: 'finance',
    title: 'Omzet, food cost en live winst/verlies',
    keywords: [
      'omzet',
      'revenue',
      'turnover',
      'foodcost',
      'food cost',
      'verlies',
      'marge',
      'margin',
      'grafiek',
      'historiek',
      'financieel',
      'rapport',
      'report',
    ],
    answer:
      'Open inzichten voor echte omzet, food cost, live winst/verliesregistratie en je jaaroverzicht in grafiekvorm.',
    cta: 'Open inzichten',
    href: '/explore',
    tone: '#0369a1',
    surface: '#f0f9ff',
  },
  {
    id: 'account',
    title: 'Account en login',
    keywords: [
      'account',
      'login',
      'aanmelden',
      'inloggen',
      'wachtwoord',
      'password',
      'profiel',
      'email wijzigen',
    ],
    answer: 'Open account om login, profielgegevens en sessieproblemen snel op te lossen.',
    cta: 'Open account',
    href: '/account',
    tone: '#4338ca',
    surface: '#eef2ff',
  },
  {
    id: 'security',
    title: 'Beveiliging en privacy',
    keywords: [
      'security',
      'beveiliging',
      'privacy',
      'toegang',
      'auth',
      '2fa',
      'veilig',
      'audit',
    ],
    answer: 'Open beveiliging om toegang, privacy-instellingen en veilige defaults direct te controleren.',
    cta: 'Open beveiliging',
    href: '/security',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'privacy',
    title: 'Privacybeleid',
    keywords: ['privacy policy', 'privacy', 'gegevens', 'data', 'gdpr', 'avg', 'beleid', 'policy'],
    answer: 'Open privacy om het Taze privacybeleid, datagebruik en publieke legal route direct te bekijken.',
    cta: 'Open privacy',
    href: '/privacy',
    tone: '#1d4ed8',
    surface: '#eff6ff',
  },
  {
    id: 'support',
    title: 'Hulp en support',
    keywords: ['support', 'help', 'hulp', 'service', 'klantendienst', 'customer support', 'assistance'],
    answer: 'Open support voor Taze helpdesk, betalingen, publieke support en directe contactkanalen.',
    cta: 'Open support',
    href: '/support',
    tone: '#b45309',
    surface: '#fffbeb',
  },
  {
    id: 'contact',
    title: 'Contact',
    keywords: ['contact', 'email', 'mail', 'contacteer', 'bereiken', 'reach us', 'supportmail'],
    answer: 'Open contact voor supportmail, refund-opvolging en snelle doorgang naar privacy of support.',
    cta: 'Open contact',
    href: '/contact',
    tone: '#0f766e',
    surface: '#ecfeff',
  },
  {
    id: 'translate',
    title: 'Talen en vertalingen',
    keywords: [
      'taal',
      'talen',
      'translate',
      'translation',
      'vertalen',
      'frans',
      'engels',
      'duits',
      'spanish',
    ],
    answer: 'Open Translate om snel tussen talen te werken en meertalige klantcommunicatie te verbeteren.',
    cta: 'Open vertalen',
    href: '/translate',
    tone: '#7c2d12',
    surface: '#fff7ed',
  },
];

const starterQuestions = [
  'Scanner werkt niet',
  'Ik zie mijn stock niet',
  'Waar zie ik waste?',
  'Wat kost het voor bedrijven?',
  'Hoe vraag ik geld terug?',
  'Waar staat de privacy policy?',
  'Hoe neem ik contact op?',
  'How do I fix login?',
  'Comment traduire vers le francais?',
];

const STOP_WORDS = new Set([
  'de',
  'het',
  'een',
  'en',
  'of',
  'ik',
  'je',
  'jij',
  'wij',
  'we',
  'to',
  'the',
  'a',
  'an',
  'i',
  'you',
  'and',
  'or',
  'le',
  'la',
  'les',
  'un',
  'une',
  'et',
  'ou',
]);

const ALIAS_GROUPS: Record<string, string[]> = {
  scan: ['scan', 'scanner', 'camera', 'barcode', 'qr', 'foto', 'photo'],
  stock: ['stock', 'voorraad', 'inventory', 'inventaire', 'producten', 'produits'],
  waste: ['waste', 'verval', 'expiry', 'expiration', 'perime', 'verlies'],
  payment: ['betaling', 'payment', 'paiement', 'prijs', 'pricing', 'abonnement', 'subscription'],
  refund: ['refund', 'refunds', 'terugbetaling', 'terugbetalingen', 'geld terug', 'money back'],
  finance: ['omzet', 'revenue', 'turnover', 'foodcost', 'marge', 'margin', 'report', 'rapport'],
  account: ['account', 'login', 'inloggen', 'aanmelden', 'password', 'wachtwoord', 'profiel'],
  security: ['security', 'beveiliging', 'privacy', 'auth', '2fa'],
  translate: ['taal', 'talen', 'vertalen', 'translate', 'translation', 'langue', 'language'],
};

const ALIAS_LOOKUP = Object.entries(ALIAS_GROUPS).reduce((lookup, [canonical, aliases]) => {
  lookup.set(canonical, canonical);
  for (const alias of aliases) {
    lookup.set(alias, canonical);
  }
  return lookup;
}, new Map<string, string>());

function normalizeSearchText(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearchText(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return [];

  return normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandTokens(tokens: string[]) {
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    const canonical = ALIAS_LOOKUP.get(token);
    if (canonical) {
      expanded.add(canonical);
    }
  }

  return expanded;
}

function isTokenMatch(keywordToken: string, expandedTokens: Set<string>) {
  if (expandedTokens.has(keywordToken)) return true;
  for (const token of expandedTokens) {
    if (token.includes(keywordToken) || keywordToken.includes(token)) return true;
  }
  return false;
}

function findHulpAnswer(question: string) {
  const normalized = normalizeSearchText(question);
  if (!normalized) {
    return null;
  }

  const tokens = tokenizeSearchText(question);
  const expandedTokens = expandTokens(tokens);

  const scored = supportAnswers
    .map((item) => {
      const matchedKeywords: string[] = [];
      let score = 0;

      for (const keyword of item.keywords) {
        const normalizedKeyword = normalizeSearchText(keyword);
        if (!normalizedKeyword) continue;

        const keywordTokens = tokenizeSearchText(normalizedKeyword);
        const phraseMatch = normalized.includes(normalizedKeyword);
        const tokenHits = keywordTokens.filter((token) => isTokenMatch(token, expandedTokens)).length;

        if (!phraseMatch && tokenHits === 0) continue;

        matchedKeywords.push(keyword);
        if (phraseMatch) {
          score += 5 + Math.max(1, keywordTokens.length);
          continue;
        }

        score += Math.max(2, tokenHits * 2);
      }

      return { answer: item, score, matchedKeywords };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best || best.score < 3) {
    return null;
  }

  const confidenceLabel =
    best.score >= 14 ? 'Heel zeker' : best.score >= 9 ? 'Sterke match' : best.score >= 5 ? 'Waarschijnlijk juist' : 'Beste match';

  return {
    answer: best.answer,
    score: best.score,
    confidenceLabel,
    matchedKeywords: Array.from(new Set(best.matchedKeywords)),
  } satisfies DetectedHulpAnswer;
}

export default function HelpdeskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefill?: string }>();
  const [aiAuditEntries, setAiAuditEntries] = useState<AiAuditEntry[]>(() => getCachedAiAuditEntries());
  const [question, setQuestion] = useState('');
  const [inputMode, setInputMode] = useState<'type' | 'mic'>('type');
  const [listening, setListening] = useState(false);
  const [riaLanguage, setRiaLanguage] = useState<RiaLanguage>('Nederlands');
  const [talkBackEnabled, setTalkBackEnabled] = useState(() => loadTalkbackSettings().enabled);
  const [talkBackStatus, setTalkBackStatus] = useState('');
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiAnswer | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const { items, financeEntries } = useInventory();
  const metrics = getInventoryMetrics(items);
  const canUseTalkBack = canTalkBackGlobal();
  const serverBaseUrl = useMemo(() => getServerBaseUrl(), []);
  const riaCopy = useMemo(() => riaCopyByLanguage[riaLanguage] ?? riaCopyByLanguage.English, [riaLanguage]);
  const speakNowLabel = useMemo(() => {
    if (riaLanguage === 'Nederlands') return 'Praat nu';
    if (riaLanguage === 'Francais') return 'Parler maintenant';
    if (riaLanguage === 'Deutsch') return 'Jetzt sprechen';
    if (riaLanguage === 'Espanol') return 'Hablar ahora';
    if (riaLanguage === 'Italiano') return 'Parla ora';
    if (riaLanguage === 'Portugues') return 'Falar agora';
    return 'Speak now';
  }, [riaLanguage]);

  const SpeechRecognitionCtor = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    const anyGlobal = globalThis as any;
    return anyGlobal.webkitSpeechRecognition ?? anyGlobal.SpeechRecognition ?? null;
  }, []);
  const canUseSpeech = typeof SpeechRecognitionCtor === 'function';

  useEffect(() => {
    const prefill = typeof params.prefill === 'string' ? params.prefill.trim() : '';
    if (!prefill) return;
    setQuestion(prefill);
  }, [params.prefill]);

  const detectedAnswer = useMemo(() => findHulpAnswer(question), [question]);
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(items), [items]);
  const topCategory = categoryBreakdown[0] ?? null;
  const financeSnapshot = useMemo(() => {
    const revenue = financeEntries.reduce((sum, entry) => (entry.kind === 'revenue' ? sum + entry.amount : sum), 0);
    const foodCost = financeEntries.reduce((sum, entry) => (entry.kind === 'food_cost' ? sum + entry.amount : sum), 0);
    const loss = financeEntries.reduce((sum, entry) => (entry.kind === 'loss' ? sum + entry.amount : sum), 0);
    const profit = revenue - foodCost - loss;
    const wasteRate = revenue > 0 ? Math.round((loss / revenue) * 100) : 0;
    return { revenue, foodCost, loss, profit, wasteRate };
  }, [financeEntries]);
  const proactiveAnswer = useMemo(() => {
    if (metrics.expiringSoon > 0) {
      return supportAnswers.find((item) => item.id === 'waste') ?? null;
    }

    if (items.length === 0) {
      return supportAnswers.find((item) => item.id === 'scanner') ?? null;
    }

    if (financeEntries.length === 0) {
      return supportAnswers.find((item) => item.id === 'payments') ?? null;
    }

    return supportAnswers.find((item) => item.id === 'stock') ?? null;
  }, [financeEntries.length, items.length, metrics.expiringSoon]);

  const activeSignals = useMemo(
    () => [
      {
        label: 'Voorraadstatus',
        value: items.length > 0 ? `${metrics.totalProducts} producten` : 'Nog leeg',
        detail: items.length > 0 ? `${metrics.totalUnits} stuks in stock` : 'Start met je eerste scan',
        href: (items.length > 0 ? '/explore' : '/scan') as HulpAnswer['href'],
      },
      {
        label: 'Waste-druk',
        value: metrics.expiringSoon > 0 ? `${metrics.expiringSoon} acties` : 'Rustig',
        detail: metrics.expiringSoon > 0 ? 'Producten vragen opvolging' : 'Geen directe vervaldruk',
        href: '/alerts' as const,
      },
      {
        label: 'Financiën',
        value: financeEntries.length > 0 ? 'Actief' : 'Nog niet gekoppeld',
        detail: financeEntries.length > 0 ? 'Historiek aanwezig' : 'Omzet en live winst/verlies ontbreken nog',
        href: (financeEntries.length > 0 ? '/explore' : '/payments') as HulpAnswer['href'],
      },
    ],
    [financeEntries.length, items.length, metrics.expiringSoon, metrics.totalProducts, metrics.totalUnits]
  );

  const riaSuggestions = useMemo(
    () => [
      metrics.expiringSoon > 0
        ? {
            title: 'Ria raadt alerts aan',
            detail: 'Er is vervaldruk. Werk eerst producten met korte houdbaarheid weg.',
            cta: 'Ga naar alerts',
            href: '/alerts' as const,
            tone: '#c2410c',
            surface: '#fff7ed',
          }
        : {
            title: 'Ria raadt nieuwe scan aan',
            detail: 'Een extra scan houdt de voorraad actueel en leert de herkenning bij.',
            cta: 'Open scanner',
            href: '/scan' as const,
            tone: '#0f766e',
            surface: '#ecfeff',
          },
      metrics.averageConfidence < 0.85
        ? {
            title: 'Ria wil betere herkenning',
            detail: 'Gebruik barcode en foto samen voor nauwkeurigere productdata.',
            cta: 'Verbeter herkenning',
            href: '/scan' as const,
            tone: '#1d4ed8',
            surface: '#eff6ff',
          }
        : {
            title: 'Ria ziet goede herkenning',
            detail: 'De AI werkt al sterk. Gebruik inzichten om voorraad slimmer te sturen.',
            cta: 'Open inzichten',
            href: '/explore' as const,
            tone: '#1d4ed8',
            surface: '#eff6ff',
          },
      financeEntries.length === 0
        ? {
            title: 'Ria mist financieel inzicht',
            detail: 'Voeg omzet of live winst/verlies toe zodat Ria ook financieel kan meedenken.',
            cta: 'Open betalingen',
            href: '/payments' as const,
            tone: '#7c3aed',
            surface: '#f5f3ff',
          }
        : {
            title: 'Ria ziet de flow compleet',
            detail: 'Voorraad en financien zijn gekoppeld. Kijk nu naar trends en historiek.',
            cta: 'Bekijk inzichten',
            href: '/explore' as const,
            tone: '#7c3aed',
            surface: '#f5f3ff',
          },
    ],
    [financeEntries.length, metrics.averageConfidence, metrics.expiringSoon]
  );
  const riaQuickActions = useMemo(() => {
    const actions = [];

    if (metrics.expiringSoon > 0) {
      actions.push({ label: 'Volg verval op', href: '/alerts' as const });
    }

    if (items.length > 0) {
      actions.push({ label: 'Bekijk stock per vestiging', href: '/explore' as const });
    }

    if (financeEntries.length === 0) {
      actions.push({ label: 'Koppel finance', href: '/payments' as const });
    }

    if (actions.length === 0) {
      actions.push({ label: 'Start scanner', href: '/scan' as const });
    }

    return actions.slice(0, 3);
  }, [financeEntries.length, items.length, metrics.expiringSoon]);
  const legalAiStats = useMemo(() => {
    const entries = aiAuditEntries.filter(
      (entry) => entry.screen === 'privacy' || entry.screen === 'support' || entry.screen === 'contact'
    );
    const byScreen = new Map<string, number>();
    entries.forEach((entry) => {
      byScreen.set(entry.screen, (byScreen.get(entry.screen) ?? 0) + 1);
    });
    const topScreen = [...byScreen.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
    return {
      total: entries.length,
      opened: entries.filter((entry) => entry.interactionKind === 'route_opened').length,
      applied: entries.filter((entry) => entry.interactionKind === 'action_applied').length,
      topScreen,
    };
  }, [aiAuditEntries]);

  const riaTalkbackCard = useMemo(() => {
    const answer = detectedAnswer?.answer ?? proactiveAnswer ?? supportAnswers.find((item) => item.id === 'stock') ?? supportAnswers[0];
    const actionLabel = getRouteActionLabel(answer.href, riaCopy);
    const revenueLabel = formatCurrencyByLanguage(financeSnapshot.revenue, riaLanguage);
    const foodCostLabel = formatCurrencyByLanguage(financeSnapshot.foodCost, riaLanguage);
    const lossLabel = formatCurrencyByLanguage(financeSnapshot.loss, riaLanguage);
    const profitLabel = formatCurrencyByLanguage(financeSnapshot.profit, riaLanguage);
    const wasteSummary = `${metrics.expiringSoon} / ${metrics.totalProducts || 0}`;
    const nutritionSummary = topCategory
      ? `${metrics.totalUnits} - ${riaCopy.topCategoryLabel}: ${topCategory.category} (${topCategory.quantity})`
      : `${metrics.totalUnits} - ${riaCopy.noDataLabel}`;
    const financeSummary = `${riaCopy.revenueLabel} ${revenueLabel} | ${riaCopy.foodCostLabel} ${foodCostLabel}`;
    const wasteDetail = `${riaCopy.lossLabel} ${lossLabel} | rate ${financeSnapshot.wasteRate}%`;
    const lines = [
      `${riaCopy.nutritionLabel}: ${nutritionSummary}`,
      `${riaCopy.financeLabel}: ${financeSummary}`,
      `${riaCopy.profitLabel}: ${profitLabel}`,
      `${riaCopy.wasteLabel}: ${wasteSummary} | ${wasteDetail}`,
      `${riaCopy.actionLabel}: ${actionLabel}`,
    ];

    if (detectedAnswer) {
      lines.push(`${riaCopy.confidenceLabel}: ${detectedAnswer.confidenceLabel}`);
    } else {
      lines.push(`${riaCopy.confidenceLabel}: ${riaCopy.autoConfidenceLabel}`);
    }

    return {
      title: riaCopy.autoAnswerLabel,
      lines,
      href: answer.href,
      cta: actionLabel,
      tone: answer.tone,
      surface: answer.surface,
      speechText: lines.join('. '),
    };
  }, [
    detectedAnswer,
    financeSnapshot.foodCost,
    financeSnapshot.loss,
    financeSnapshot.profit,
    financeSnapshot.revenue,
    financeSnapshot.wasteRate,
    metrics.expiringSoon,
    metrics.totalProducts,
    metrics.totalUnits,
    proactiveAnswer,
    riaCopy,
    riaLanguage,
    topCategory,
  ]);

  const localizedDetectedAnswer = useMemo(() => {
    if (!detectedAnswer) return null;
    return {
      ...detectedAnswer,
      localized: getLocalizedHulpAnswer(detectedAnswer.answer, riaCopy),
    };
  }, [detectedAnswer, riaCopy]);

  const localizedProactiveAnswer = useMemo(() => {
    if (!proactiveAnswer) return null;
    return {
      ...proactiveAnswer,
      localized: getLocalizedHulpAnswer(proactiveAnswer, riaCopy),
    };
  }, [proactiveAnswer, riaCopy]);

  const realAiContext = useMemo(
    () => ({
      metrics: {
        totalProducts: metrics.totalProducts,
        totalUnits: metrics.totalUnits,
        expiringSoon: metrics.expiringSoon,
        averageConfidence: Math.round(metrics.averageConfidence * 100),
      },
      finance: financeSnapshot,
      topCategory: topCategory
        ? {
            category: topCategory.category,
            quantity: topCategory.quantity,
          }
        : null,
      inventoryPreview: items.slice(0, 6).map((item) => ({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        expiryDays: item.expiryDays,
        confidence: item.confidence === null ? null : Math.round(item.confidence * 100),
        location: item.location,
      })),
      activeSignals: activeSignals.map((signal) => ({
        label: signal.label,
        value: signal.value,
        detail: signal.detail,
      })),
      transportGlobal: buildTransportAiContext(),
      quickActions: riaQuickActions.map((action) => action.label),
      detectedTopic: detectedAnswer?.answer.title ?? null,
    }),
    [activeSignals, detectedAnswer?.answer.title, financeSnapshot, items, metrics, riaQuickActions, topCategory]
  );

  const riaTopicCards = useMemo(() => {
    const revenueLabel = formatCurrencyByLanguage(financeSnapshot.revenue, riaLanguage);
    const foodCostLabel = formatCurrencyByLanguage(financeSnapshot.foodCost, riaLanguage);
    const lossLabel = formatCurrencyByLanguage(financeSnapshot.loss, riaLanguage);
    const profitLabel = formatCurrencyByLanguage(financeSnapshot.profit, riaLanguage);
    const wastePressure =
      metrics.totalProducts > 0 ? Math.round((metrics.expiringSoon / metrics.totalProducts) * 100) : 0;

    return [
      {
        id: 'nutrition',
        title: riaCopy.nutritionLabel,
        value: `${metrics.totalUnits}`,
        detail: topCategory
          ? `${riaCopy.topCategoryLabel}: ${topCategory.category} (${topCategory.quantity})`
          : riaCopy.noDataLabel,
        href: '/explore' as HulpAnswer['href'],
        tone: '#0f766e',
        surface: '#ecfeff',
      },
      {
        id: 'profit',
        title: riaCopy.profitLabel,
        value: profitLabel,
        detail: `${riaCopy.revenueLabel}: ${revenueLabel} | ${riaCopy.foodCostLabel}: ${foodCostLabel}`,
        href: '/payments' as HulpAnswer['href'],
        tone: financeSnapshot.profit >= 0 ? '#0f766e' : '#dc2626',
        surface: financeSnapshot.profit >= 0 ? '#ecfeff' : '#fef2f2',
      },
      {
        id: 'loss',
        title: riaCopy.lossLabel,
        value: lossLabel,
        detail: `${riaCopy.wasteLabel} rate: ${financeSnapshot.wasteRate}%`,
        href: '/payments' as HulpAnswer['href'],
        tone: '#b45309',
        surface: '#fffbeb',
      },
      {
        id: 'waste',
        title: riaCopy.wasteLabel,
        value: `${metrics.expiringSoon} / ${metrics.totalProducts || 0}`,
        detail: `Rate ${wastePressure}%`,
        href: '/alerts' as HulpAnswer['href'],
        tone: metrics.expiringSoon > 0 ? '#dc2626' : '#0f766e',
        surface: metrics.expiringSoon > 0 ? '#fef2f2' : '#ecfeff',
      },
    ];
  }, [
    financeSnapshot.foodCost,
    financeSnapshot.loss,
    financeSnapshot.profit,
    financeSnapshot.revenue,
    financeSnapshot.wasteRate,
    metrics.expiringSoon,
    metrics.totalProducts,
    metrics.totalUnits,
    riaCopy,
    riaLanguage,
    topCategory,
  ]);

  useEffect(() => {
    if (!canUseSpeech || !SpeechRecognitionCtor) return;

    const recognizer = new SpeechRecognitionCtor();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = getRiaLanguageCode(riaLanguage);
    recognizer.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript ?? '';
      setQuestion(String(text));
      setInputMode('type');
      setListening(false);
    };
    recognizer.onerror = () => setListening(false);
    recognizer.onend = () => {
      setInputMode('type');
      setListening(false);
    };
    recognitionRef.current = recognizer;

    return () => {
      try {
        recognizer.abort?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [SpeechRecognitionCtor, canUseSpeech, riaLanguage]);

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
    const current = loadTalkbackSettings();
    saveTalkbackSettings({
      ...current,
      enabled: talkBackEnabled,
      lang: getRiaLanguageCode(riaLanguage),
    });
    if (!talkBackEnabled) {
      stopTalkBack().catch(() => {});
    }
  }, [riaLanguage, talkBackEnabled]);

  useEffect(() => {
    if (!canUseTalkBack || !talkBackEnabled) return;
    if (!riaTalkbackCard.speechText.trim()) return;
    setTalkBackStatus('Automatische talkback actief.');
    talkBack(riaTalkbackCard.speechText, {
      enabled: true,
      lang: getRiaLanguageCode(riaLanguage),
    }).catch(() => {});
  }, [canUseTalkBack, riaLanguage, riaTalkbackCard.speechText, talkBackEnabled]);

  useEffect(() => {
    setRealAiState('idle');
    setRealAiAnswer(null);
    setRealAiError('');
  }, [question, riaLanguage]);

  const handleListen = useCallback(() => {
    if (!canUseSpeech || !recognitionRef.current) return;
    try {
      setInputMode('mic');
      setListening(true);
      recognitionRef.current.start();
    } catch {
      setInputMode('type');
      setListening(false);
    }
  }, [canUseSpeech]);

  const handleTypingMode = useCallback(() => {
    setInputMode('type');
    setListening(false);
    try {
      recognitionRef.current?.abort?.();
    } catch {
      // ignore
    }
    inputRef.current?.focus?.();
  }, []);

  const handleMicToggle = useCallback(() => {
    if (!canUseSpeech || !recognitionRef.current) return;

    if (listening) {
      try {
        recognitionRef.current.stop?.();
      } catch {
        // ignore
      }
      setListening(false);
      setInputMode('type');
      return;
    }

    handleListen();
  }, [canUseSpeech, handleListen, listening]);

  const handleTalkBackToggle = useCallback(() => {
    if (!canUseTalkBack) return;
    setTalkBackEnabled((prev) => {
      const next = !prev;
      setTalkBackStatus(next ? 'Talkback geactiveerd.' : 'Talkback uitgeschakeld.');
      return next;
    });
  }, [canUseTalkBack]);

  const handleSpeakNow = useCallback(() => {
    if (!canUseTalkBack) {
      setTalkBackStatus('Talkback werkt niet in deze browser.');
      return;
    }

    setTalkBackEnabled(true);
    setTalkBackStatus('Ria probeert nu te spreken...');
    const lang = getRiaLanguageCode(riaLanguage);
    const current = loadTalkbackSettings();
    saveTalkbackSettings({ ...current, enabled: true, lang });

    if (Platform.OS === 'web') {
      try {
        (globalThis as any).speechSynthesis?.resume?.();
      } catch {
        // ignore
      }
    }

    talkBack(riaTalkbackCard.speechText, {
      enabled: true,
      lang,
    }).catch(() => {});

    if (Platform.OS === 'web') {
      setTimeout(() => {
        const speaking = Boolean((globalThis as any).speechSynthesis?.speaking);
        setTalkBackStatus(
          speaking
            ? 'Ria praat nu.'
            : 'Geen audio gedetecteerd. Klik nog eens op "Praat nu" en controleer browser-geluid.'
        );
      }, 350);
    } else {
      setTalkBackStatus('Ria praat nu.');
    }
  }, [canUseTalkBack, riaLanguage, riaTalkbackCard.speechText]);

  const askRealAi = useCallback(async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError('Typ eerst een vraag voor de echte AI.');
      return;
    }

    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');

    try {
      const response = await fetch(`${serverBaseUrl}/api/ai/helpdesk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmedQuestion,
          language: riaLanguage,
          context: {
            ...realAiContext,
            transportGlobal: buildTransportAiContext(),
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const errorCode = String(payload?.error ?? '');
        if (errorCode === 'openai_not_configured') {
          throw new Error('De live AI is momenteel niet beschikbaar op deze verbinding.');
        }
        if (errorCode === 'openai_auth_error') {
          throw new Error('De OpenAI sleutel lijkt ongeldig of heeft geen toegang voor deze aanvraag.');
        }
        if (errorCode === 'openai_rate_limited') {
          throw new Error('De echte AI zit even aan zijn limiet. Probeer het zo opnieuw.');
        }
        if (errorCode === 'question_too_short') {
          throw new Error('Je vraag is nog te kort voor een echte AI-respons.');
        }
        throw new Error('De echte AI kon nu geen antwoord teruggeven.');
      }

      const audit = await logAiAuditResponse({
        screen: 'helpdesk',
        question: trimmedQuestion,
        title: String(payload.title ?? 'Ria AI').trim() || 'Ria AI',
        answer: String(payload.answer ?? '').trim(),
        recommendedRoute:
          payload.recommendedRoute === '/scan' ||
          payload.recommendedRoute === '/explore' ||
          payload.recommendedRoute === '/alerts' ||
          payload.recommendedRoute === '/trace' ||
          payload.recommendedRoute === '/payments' ||
          payload.recommendedRoute === '/partners' ||
          payload.recommendedRoute === '/account' ||
          payload.recommendedRoute === '/security' ||
          payload.recommendedRoute === '/translate' ||
          payload.recommendedRoute === '/transport'
            ? payload.recommendedRoute
            : '/explore',
        recommendedLabel: String(payload.recommendedLabel ?? 'Open aanbevolen scherm').trim() || 'Open aanbevolen scherm',
        model: String(payload.model ?? 'OpenAI').trim() || 'OpenAI',
      });

      const nextAnswer: RealAiAnswer = {
        auditId: audit.id,
        title: String(payload.title ?? 'Ria AI').trim() || 'Ria AI',
        answer: String(payload.answer ?? '').trim(),
        recommendedRoute:
          payload.recommendedRoute === '/scan' ||
          payload.recommendedRoute === '/explore' ||
          payload.recommendedRoute === '/alerts' ||
          payload.recommendedRoute === '/trace' ||
          payload.recommendedRoute === '/payments' ||
          payload.recommendedRoute === '/partners' ||
          payload.recommendedRoute === '/account' ||
          payload.recommendedRoute === '/security' ||
          payload.recommendedRoute === '/translate' ||
          payload.recommendedRoute === '/transport'
            ? payload.recommendedRoute
            : '/explore',
        recommendedLabel: String(payload.recommendedLabel ?? 'Open aanbevolen scherm').trim() || 'Open aanbevolen scherm',
        model: String(payload.model ?? 'OpenAI').trim() || 'OpenAI',
      };

      setRealAiAnswer(nextAnswer);
      setRealAiState('done');
      if (talkBackEnabled) {
        talkBack(nextAnswer.answer, {
          enabled: true,
          lang: getRiaLanguageCode(riaLanguage),
        }).catch(() => {});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.';
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(message);
    }
  }, [question, realAiContext, riaLanguage, serverBaseUrl, talkBackEnabled]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Ria"
          subtitle="Taze live hulp"
          description="Stel je vraag en Ria geeft meteen een duidelijk antwoord met de juiste knop om verder te gaan. Ze kijkt mee naar voorraad, waste, food safety en finance."
          badgeLabel="Slimme hulp met Ria"
          badgeText="Directe hulp op basis van de actuele appstatus."
        />

        <View style={styles.signalRow}>
          {activeSignals.map((signal) => (
            <Pressable key={signal.label} style={styles.signalCard} onPress={() => router.push(signal.href as Href)}>
              <ThemedText style={styles.signalLabel}>{signal.label}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.signalValue}>
                {signal.value}
              </ThemedText>
              <ThemedText style={styles.signalDetail}>{signal.detail}</ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.askPanel}>
          <TazeSectionHeader
            title="Stel je vraag aan Ria"
            subtitle="Typ wat je zoekt. Ria stuurt je direct naar de juiste plek of het juiste antwoord."
            badge="Live hulp"
            badgeTone="warning"
          />

          <View style={styles.inputRow}>
            <Pressable style={styles.inputModeButton} onPress={handleTypingMode}>
              <MaterialIcons
                name="keyboard"
                size={20}
                color={inputMode === 'type' ? '#0f766e' : '#64748b'}
              />
            </Pressable>

            <TextInput
              ref={inputRef}
              value={question}
              onChangeText={(text) => {
                setQuestion(text);
                setInputMode('type');
              }}
              placeholder={canUseSpeech ? 'Typ of spreek je vraag voor Ria' : 'Typ je vraag voor Ria'}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              autoFocus={Platform.OS === 'web'}
              returnKeyType="send"
              onSubmitEditing={() => askRealAi().catch(() => {})}
            />

            <Pressable
              style={[styles.inputModeButton, !canUseSpeech ? styles.inputModeButtonDisabled : null]}
              disabled={!canUseSpeech}
              onPress={handleMicToggle}>
              <MaterialIcons
                name={listening ? 'stop' : 'mic'}
                size={20}
                color={!canUseSpeech ? '#94a3b8' : listening ? '#dc2626' : '#0f766e'}
              />
            </Pressable>
          </View>

          <View style={styles.quickQuestionRow}>
            {starterQuestions.map((item) => (
              <TazeChip key={item} label={item} onPress={() => setQuestion(item)} />
            ))}
          </View>

          <View style={styles.realAiActionRow}>
            <Pressable
              style={[styles.realAiButton, realAiState === 'loading' ? styles.realAiButtonBusy : null]}
              onPress={() => askRealAi().catch(() => {})}>
              <MaterialIcons name={realAiState === 'loading' ? 'hourglass-top' : 'smart-toy'} size={18} color="#ffffff" />
              <ThemedText type="defaultSemiBold" style={styles.realAiButtonText}>
                {realAiState === 'loading' ? 'Echte AI denkt...' : 'Vraag echte AI'}
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.realAiHint}>AI verschijnt zodra de serverkoppeling actief is.</ThemedText>
          </View>
        </View>

        {realAiState === 'done' && realAiAnswer ? (
          <View style={styles.realAiCard}>
            <View style={styles.answerHeader}>
              <ThemedText type="defaultSemiBold">{realAiAnswer.title}</ThemedText>
              <TazeBadge label={realAiAnswer.model} tone="info" icon="smart-toy" />
            </View>
            <ThemedText>{realAiAnswer.answer}</ThemedText>
            <Pressable
              style={[styles.answerButton, { backgroundColor: '#7c3aed' }]}
              onPress={() => {
                markAiAuditInteraction(realAiAnswer.auditId, {
                  kind: 'route_opened',
                  label: realAiAnswer.recommendedLabel,
                }).catch(() => {});
                if (realAiAnswer.recommendedRoute === '/transport') {
                  markAiAuditOutcome(realAiAnswer.auditId, {
                    kind: 'success',
                    label: 'Transporthub geopend via Ria AI',
                  }).catch(() => {});
                  router.push(buildTransportHubPath({ source: 'helpdesk' }) as Href);
                  return;
                }
                router.push(realAiAnswer.recommendedRoute as Href);
              }}>
              <ThemedText type="defaultSemiBold" style={styles.answerButtonText}>
                {realAiAnswer.recommendedLabel}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}

        {realAiState === 'error' && realAiError ? (
          <View style={styles.realAiErrorCard}>
            <ThemedText type="defaultSemiBold">Live AI-antwoord nog niet beschikbaar</ThemedText>
            <ThemedText>{realAiError}</ThemedText>
          </View>
        ) : null}

        <TazeSectionHeader title={riaCopy.panelTitle} subtitle={riaCopy.panelHint} badge="Voice coach" badgeTone="primary" />

        <View style={styles.talkbackControlCard}>
          <View style={styles.talkbackControlHeader}>
            <ThemedText type="defaultSemiBold">{riaCopy.languageLabel}</ThemedText>
            <Pressable
              style={[styles.talkbackToggleButton, !canUseTalkBack ? styles.talkbackToggleButtonDisabled : null]}
              disabled={!canUseTalkBack}
              onPress={handleTalkBackToggle}>
              <MaterialIcons
                name={talkBackEnabled ? 'volume-up' : 'volume-off'}
                size={18}
                color={!canUseTalkBack ? '#94a3b8' : talkBackEnabled ? '#0f766e' : '#64748b'}
              />
              <ThemedText type="defaultSemiBold" style={styles.talkbackToggleText}>
                {talkBackEnabled ? riaCopy.voiceOnLabel : riaCopy.voiceOffLabel}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.languageChipRow}>
            {riaLanguages.map((language) => (
              <TazeChip
                key={language}
                label={language}
                active={language === riaLanguage}
                onPress={() => setRiaLanguage(language)}
              />
            ))}
          </View>

          <ThemedText style={styles.activeLanguageText}>
            {riaCopy.languageLabel}: {riaLanguage}
          </ThemedText>

          <View style={styles.talkbackActionRow}>
            <Pressable style={styles.speakNowButton} onPress={handleSpeakNow}>
              <MaterialIcons name="record-voice-over" size={18} color="#ffffff" />
              <ThemedText type="defaultSemiBold" style={styles.speakNowButtonText}>
                {speakNowLabel}
              </ThemedText>
            </Pressable>
            {talkBackStatus ? <ThemedText style={styles.talkbackStatusText}>{talkBackStatus}</ThemedText> : null}
          </View>
        </View>

        <View
          style={[
            styles.talkbackAnswerCard,
            { borderColor: riaTalkbackCard.tone, backgroundColor: riaTalkbackCard.surface },
          ]}>
          <View style={styles.answerHeader}>
            <ThemedText type="defaultSemiBold">{riaTalkbackCard.title}</ThemedText>
            <TazeBadge label={riaCopy.autoConfidenceLabel} tone="success" />
          </View>
          {riaTalkbackCard.lines.map((line) => (
            <ThemedText key={line}>{line}</ThemedText>
          ))}
          <Pressable
            style={[styles.answerButton, { backgroundColor: riaTalkbackCard.tone }]}
            onPress={() => router.push(riaTalkbackCard.href as Href)}>
            <ThemedText type="defaultSemiBold" style={styles.answerButtonText}>
              {riaTalkbackCard.cta}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.riaTopicGrid}>
          {riaTopicCards.map((card) => (
            <Pressable
              key={card.id}
              style={[styles.riaTopicCard, { borderColor: card.tone, backgroundColor: card.surface }]}
              onPress={() => router.push(card.href as Href)}>
              <ThemedText type="defaultSemiBold">{card.title}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.riaTopicValue}>
                {card.value}
              </ThemedText>
              <ThemedText style={styles.riaTopicDetail}>{card.detail}</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.riaTopicCta}>
                {getRouteActionLabel(card.href, riaCopy)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <TazeSectionHeader
          title="Direct antwoord"
          subtitle={
            question.trim()
              ? 'Ria heeft je vraag gelezen en geeft hieronder meteen de beste hulp.'
              : 'Typ hierboven een vraag of laat Ria zelf de slimste volgende stap voorstellen.'
          }
          badge="AI response"
          badgeTone="accent"
        />

        {localizedDetectedAnswer ? (
          <View
            style={[
              styles.answerCard,
              { borderColor: localizedDetectedAnswer.answer.tone, backgroundColor: localizedDetectedAnswer.answer.surface },
            ]}>
            <View style={styles.answerHeader}>
              <ThemedText type="defaultSemiBold">{localizedDetectedAnswer.localized.title}</ThemedText>
              <TazeBadge label={localizedDetectedAnswer.confidenceLabel} tone="success" />
            </View>
            <ThemedText>{localizedDetectedAnswer.localized.text}</ThemedText>
            <ThemedText style={styles.answerMeta}>
              Ria herkende: {localizedDetectedAnswer.matchedKeywords.join(', ')}
            </ThemedText>
            <Pressable
              style={[styles.answerButton, { backgroundColor: localizedDetectedAnswer.answer.tone }]}
              onPress={() => router.push(localizedDetectedAnswer.answer.href as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.answerButtonText}>
                {localizedDetectedAnswer.localized.cta}
              </ThemedText>
            </Pressable>
          </View>
        ) : question.trim() ? (
          <View style={styles.fallbackCard}>
            <ThemedText type="defaultSemiBold">Ria helpt je verder</ThemedText>
            <ThemedText>
              Ik herken je vraag nog niet precies, maar open hieronder meteen de plek waar de meeste vragen worden opgelost.
            </ThemedText>
            <View style={styles.fallbackActions}>
              {supportAnswers.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.fallbackButton, { borderColor: item.tone }]}
                  onPress={() => router.push(item.href as Href)}>
                  <ThemedText type="defaultSemiBold" style={[styles.fallbackButtonText, { color: item.tone }]}>
                    {getRouteActionLabel(item.href, riaCopy)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : localizedProactiveAnswer ? (
          <>
            <View
              style={[
                styles.answerCard,
                { borderColor: localizedProactiveAnswer.tone, backgroundColor: localizedProactiveAnswer.surface },
              ]}>
              <ThemedText type="defaultSemiBold">Ria ziet dit nu als slimste stap</ThemedText>
              <ThemedText>{localizedProactiveAnswer.localized.text}</ThemedText>
              <Pressable
                style={[styles.answerButton, { backgroundColor: localizedProactiveAnswer.tone }]}
                onPress={() => router.push(localizedProactiveAnswer.href as Href)}>
                <ThemedText type="defaultSemiBold" style={styles.answerButtonText}>
                  {localizedProactiveAnswer.localized.cta}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.suggestionGrid}>
              {riaSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion.title}
                  style={[
                    styles.suggestionCard,
                    { borderColor: suggestion.tone, backgroundColor: suggestion.surface },
                  ]}
                  onPress={() => router.push(suggestion.href as Href)}>
                  <ThemedText type="defaultSemiBold">{suggestion.title}</ThemedText>
                  <ThemedText>{suggestion.detail}</ThemedText>
                  <View style={[styles.suggestionButton, { backgroundColor: suggestion.tone }]}>
                    <ThemedText type="defaultSemiBold" style={styles.answerButtonText}>
                      {suggestion.cta}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.quickActionRow}>
              {riaQuickActions.map((action) => (
                <Pressable
                  key={action.label}
                  style={styles.quickActionChip}
                  onPress={() => router.push(action.href as Href)}>
                  <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                    {action.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.fallbackCard}>
          <ThemedText type="defaultSemiBold">Privacy, hulp en contact</ThemedText>
          <ThemedText>
            Ria ziet {legalAiStats.total} legal-AI items, {legalAiStats.opened} geopende routes en {legalAiStats.applied} toegepaste acties.
          </ThemedText>
          <View style={styles.quickActionRow}>
            <Pressable style={styles.quickActionChip} onPress={() => router.push('/audit?screen=support' as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                Audit legal
              </ThemedText>
            </Pressable>
            <Pressable style={styles.quickActionChip} onPress={() => router.push((legalAiStats.topScreen ? `/${legalAiStats.topScreen}` : LegalConfig.supportRoute) as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                Topscherm {legalAiStats.topScreen ? legalAiStats.topScreen.toUpperCase() : 'SUPPORT'}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.fallbackCard}>
          <ThemedText type="defaultSemiBold">Hulp & legal</ThemedText>
          <ThemedText>
            Open meteen betalingen, privacy, support of contact als je naast operationele hulp ook een formele Taze-route nodig hebt.
          </ThemedText>
          <View style={styles.quickActionRow}>
            <Pressable style={styles.quickActionChip} onPress={() => router.push('/payments' as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                Betalingen
              </ThemedText>
            </Pressable>
            <Pressable style={styles.quickActionChip} onPress={() => router.push(LegalConfig.supportRoute as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                Hulp
              </ThemedText>
            </Pressable>
            <Pressable style={styles.quickActionChip} onPress={() => router.push(LegalConfig.privacyRoute as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                Privacy
              </ThemedText>
            </Pressable>
            <Pressable style={styles.quickActionChip} onPress={() => router.push(LegalConfig.contactRoute as Href)}>
              <ThemedText type="defaultSemiBold" style={styles.quickActionText}>
                Contact
              </ThemedText>
            </Pressable>
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
  hero: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
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
    minWidth: 260,
    gap: 6,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBrandCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroLogoFrame: {
    width: 76,
    height: 76,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(253,186,116,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    minWidth: 180,
    borderRadius: 20,
    padding: 16,
    backgroundColor: Brand.primary,
    gap: 4,
    justifyContent: 'center',
  },
  heroBadgeTitle: {
    color: 'rgba(255,255,255,0.78)',
  },
  heroBadgeText: {
    color: '#ffffff',
    fontSize: 15,
  },
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  signalCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 200,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0px 12px 28px rgba(15, 23, 42, 0.06)',
    gap: 4,
  },
  signalLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  signalValue: {
    color: '#0f172a',
  },
  signalDetail: {
    color: '#475569',
    fontSize: 12,
  },
  askPanel: {
    gap: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0px 16px 34px rgba(15, 23, 42, 0.07)',
  },
  sectionHeader: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(248,250,252,0.9)',
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    color: '#0f172a',
  },
  inputModeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.82)',
  },
  inputModeButtonDisabled: {
    backgroundColor: '#f1f5f9',
  },
  quickQuestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickQuestionChip: {
    borderRadius: 999,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickQuestionText: {
    color: '#9a3412',
    fontSize: 13,
  },
  realAiActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  realAiButton: {
    borderRadius: 12,
    backgroundColor: Brand.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  realAiButtonBusy: {
    opacity: 0.85,
  },
  realAiButtonText: {
    color: '#ffffff',
    fontSize: 13,
  },
  realAiHint: {
    color: '#64748b',
    fontSize: 12,
  },
  realAiCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(221,214,254,0.72)',
    backgroundColor: 'rgba(250,245,255,0.9)',
    padding: 18,
    gap: 12,
  },
  realAiBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(237,233,254,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  realAiBadgeText: {
    color: '#6d28d9',
    fontSize: 11,
  },
  realAiErrorCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.72)',
    backgroundColor: 'rgba(254,242,242,0.92)',
    padding: 18,
    gap: 8,
  },
  talkbackControlCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 14,
    gap: 12,
  },
  talkbackControlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  talkbackToggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  talkbackToggleButtonDisabled: {
    backgroundColor: '#f1f5f9',
  },
  talkbackToggleText: {
    color: '#0f172a',
    fontSize: 13,
  },
  languageChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  languageChipActive: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,255,0.92)',
  },
  languageChipText: {
    color: '#334155',
    fontSize: 12,
  },
  languageChipTextActive: {
    color: '#0f172a',
    fontSize: 12,
  },
  activeLanguageText: {
    color: '#334155',
    fontSize: 12,
  },
  talkbackActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  speakNowButton: {
    borderRadius: 12,
    backgroundColor: Brand.accent,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speakNowButtonText: {
    color: '#ffffff',
    fontSize: 13,
  },
  talkbackStatusText: {
    color: '#475569',
    fontSize: 12,
  },
  talkbackAnswerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    boxShadow: '0px 16px 34px rgba(15, 23, 42, 0.07)',
    padding: 18,
    gap: 10,
  },
  riaTopicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  riaTopicCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  riaTopicValue: {
    color: '#0f172a',
    fontSize: 20,
  },
  riaTopicDetail: {
    color: '#334155',
    fontSize: 12,
  },
  riaTopicCta: {
    color: '#1d4ed8',
    fontSize: 12,
    marginTop: 2,
  },
  answerCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 12,
  },
  answerHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  answerConfidenceBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  answerConfidenceText: {
    color: '#0f172a',
    fontSize: 11,
  },
  answerMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  answerButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  answerButtonText: {
    color: '#ffffff',
  },
  fallbackCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 18,
    gap: 12,
  },
  fallbackActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fallbackButton: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  fallbackButtonText: {
    fontSize: 14,
  },
  suggestionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  suggestionCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 220,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  suggestionButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(236,254,255,0.92)',
    borderWidth: 1,
    borderColor: Brand.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickActionText: {
    color: '#0f172a',
  },
});



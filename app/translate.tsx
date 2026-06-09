import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeCard } from 'components/taze-card';
import { TazeChip } from 'components/taze-chip';
import { TazeHero } from 'components/taze-hero';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import {
  canTalkBack as canTalkBackGlobal,
  loadTalkbackSettings,
  saveTalkbackSettings,
  stopTalkBack,
  talkBack,
} from 'lib/talkback';

const languages = [
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

type LanguageLabel = (typeof languages)[number];

type PackItem = {
  id: string;
  tags: string[];
  aliases: string[];
  translations: Partial<Record<LanguageLabel, string>>;
};

type TranslationResult = {
  text: string;
  qualityLabel: string;
  matchedTags: string[];
};

const languageCodeMap: Record<LanguageLabel, string> = {
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

const phrasePack: PackItem[] = [
  {
    id: 'open-scanner',
    tags: ['support', 'operations'],
    aliases: ['open scanner', 'open de scanner', 'start scanner', 'ouvre le scanner'],
    translations: {
      Nederlands: 'Open scanner',
      Francais: 'Ouvre le scanner',
      English: 'Open the scanner',
      Deutsch: 'Scanner openen',
      Espanol: 'Abrir escaner',
      Italiano: 'Apri scanner',
      Portugues: 'Abrir scanner',
      Arabic: 'Open scanner',
      Turkce: 'Tarayiciyi ac',
      Polski: 'Otworz skaner',
      Russkiy: 'Otkroy skaner',
      Zhongwen: 'Open scanner',
    },
  },
  {
    id: 'stock-low',
    tags: ['stock', 'alerts'],
    aliases: ['stock bijna op', 'voorraad laag', 'inventory low', 'stock bas'],
    translations: {
      Nederlands: 'Voorraad is bijna op',
      Francais: 'Le stock est presque vide',
      English: 'Stock is running low',
      Deutsch: 'Bestand ist fast leer',
      Espanol: 'El stock esta casi agotado',
      Italiano: 'Lo stock sta per finire',
      Portugues: 'O stock esta a acabar',
      Arabic: 'Stock is running low',
      Turkce: 'Stok azaliyor',
      Polski: 'Stan magazynu jest niski',
      Russkiy: 'Nizkiy uroven zapasa',
      Zhongwen: 'Stock running low',
    },
  },
  {
    id: 'waste-alert',
    tags: ['waste', 'alerts'],
    aliases: ['waste alert', 'verval alert', 'expiry alert', 'alerte gaspillage'],
    translations: {
      Nederlands: 'Afboekingsalert actief',
      Francais: 'Alerte de gaspillage active',
      English: 'Waste alert is active',
      Deutsch: 'Waste-Warnung ist aktiv',
      Espanol: 'Alerta de merma activa',
      Italiano: 'Allerta spreco attiva',
      Portugues: 'Alerta de desperdicio ativa',
      Arabic: 'Waste alert active',
      Turkce: 'Israf uyarisi aktif',
      Polski: 'Alert strat jest aktywny',
      Russkiy: 'Predurezhdenie o poteriah aktivno',
      Zhongwen: 'Waste alert active',
    },
  },
  {
    id: 'payment-failed',
    tags: ['payments', 'support'],
    aliases: ['payment failed', 'betaling mislukt', 'paiement echoue'],
    translations: {
      Nederlands: 'Betaling is mislukt',
      Francais: 'Le paiement a echoue',
      English: 'Payment failed',
      Deutsch: 'Zahlung fehlgeschlagen',
      Espanol: 'Pago fallido',
      Italiano: 'Pagamento non riuscito',
      Portugues: 'Pagamento falhou',
      Arabic: 'Payment failed',
      Turkce: 'Odeme basarisiz',
      Polski: 'Platnosc nieudana',
      Russkiy: 'Platezh ne udalsya',
      Zhongwen: 'Payment failed',
    },
  },
  {
    id: 'invoice-ready',
    tags: ['finance', 'payments'],
    aliases: ['invoice ready', 'factuur klaar', 'facture prete'],
    translations: {
      Nederlands: 'Factuur staat klaar',
      Francais: 'La facture est prete',
      English: 'Invoice is ready',
      Deutsch: 'Rechnung ist bereit',
      Espanol: 'La factura esta lista',
      Italiano: 'Fattura pronta',
      Portugues: 'Fatura pronta',
      Arabic: 'Invoice is ready',
      Turkce: 'Fatura hazir',
      Polski: 'Faktura gotowa',
      Russkiy: 'Schet gotov',
      Zhongwen: 'Invoice ready',
    },
  },
  {
    id: 'food-safety',
    tags: ['safety', 'operations'],
    aliases: ['food safety check', 'controleer veiligheid', 'controle securite alimentaire'],
    translations: {
      Nederlands: 'Controleer voedselveiligheid',
      Francais: 'Controle de securite alimentaire',
      English: 'Run a food safety check',
      Deutsch: 'Food-Safety-Prufung starten',
      Espanol: 'Iniciar control de seguridad alimentaria',
      Italiano: 'Avvia controllo sicurezza alimentare',
      Portugues: 'Iniciar verificacao de seguranca alimentar',
      Arabic: 'Run food safety check',
      Turkce: 'Gida guvenligi kontrolu yap',
      Polski: 'Uruchom kontrole bezpieczenstwa zywnosci',
      Russkiy: 'Zapusti proverku bezopasnosti pishchi',
      Zhongwen: 'Run food safety check',
    },
  },
];

const wordPack: PackItem[] = [
  {
    id: 'stock',
    tags: ['stock'],
    aliases: ['stock', 'voorraad', 'inventory', 'inventaire', 'bestand'],
    translations: {
      Nederlands: 'voorraad',
      Francais: 'stock',
      English: 'stock',
      Deutsch: 'bestand',
      Espanol: 'stock',
      Italiano: 'scorte',
      Portugues: 'stock',
      Arabic: 'stock',
      Turkce: 'stok',
      Polski: 'zapas',
      Russkiy: 'zapas',
      Zhongwen: 'stock',
    },
  },
  {
    id: 'waste',
    tags: ['waste'],
    aliases: ['waste', 'verlies', 'loss', 'gaspillage'],
    translations: {
      Nederlands: 'afboeking',
      Francais: 'gaspillage',
      English: 'waste',
      Deutsch: 'verlust',
      Espanol: 'merma',
      Italiano: 'spreco',
      Portugues: 'desperdicio',
      Arabic: 'waste',
      Turkce: 'israf',
      Polski: 'strata',
      Russkiy: 'poterya',
      Zhongwen: 'waste',
    },
  },
  {
    id: 'payment',
    tags: ['payments'],
    aliases: ['betaling', 'payment', 'paiement', 'zahlung', 'pago', 'pagamento'],
    translations: {
      Nederlands: 'betaling',
      Francais: 'paiement',
      English: 'payment',
      Deutsch: 'zahlung',
      Espanol: 'pago',
      Italiano: 'pagamento',
      Portugues: 'pagamento',
      Arabic: 'payment',
      Turkce: 'odeme',
      Polski: 'platnosc',
      Russkiy: 'platezh',
      Zhongwen: 'payment',
    },
  },
  {
    id: 'invoice',
    tags: ['finance'],
    aliases: ['factuur', 'invoice', 'facture', 'rechnung', 'factura'],
    translations: {
      Nederlands: 'factuur',
      Francais: 'facture',
      English: 'invoice',
      Deutsch: 'rechnung',
      Espanol: 'factura',
      Italiano: 'fattura',
      Portugues: 'fatura',
      Arabic: 'invoice',
      Turkce: 'fatura',
      Polski: 'faktura',
      Russkiy: 'schet',
      Zhongwen: 'invoice',
    },
  },
  {
    id: 'scanner',
    tags: ['support'],
    aliases: ['scanner', 'scan', 'camera', 'barcode'],
    translations: {
      Nederlands: 'scanner',
      Francais: 'scanner',
      English: 'scanner',
      Deutsch: 'scanner',
      Espanol: 'escaner',
      Italiano: 'scanner',
      Portugues: 'scanner',
      Arabic: 'scanner',
      Turkce: 'tarayici',
      Polski: 'skaner',
      Russkiy: 'skaner',
      Zhongwen: 'scanner',
    },
  },
  {
    id: 'alert',
    tags: ['alerts'],
    aliases: ['alert', 'alerts', 'waarschuwing', 'alerte', 'warning'],
    translations: {
      Nederlands: 'alert',
      Francais: 'alerte',
      English: 'alert',
      Deutsch: 'warnung',
      Espanol: 'alerta',
      Italiano: 'allerta',
      Portugues: 'alerta',
      Arabic: 'alert',
      Turkce: 'uyari',
      Polski: 'alert',
      Russkiy: 'alert',
      Zhongwen: 'alert',
    },
  },
];

const quickPhraseIds = [
  'open-scanner',
  'stock-low',
  'waste-alert',
  'payment-failed',
  'invoice-ready',
  'food-safety',
] as const;

type QuickPhraseId = (typeof quickPhraseIds)[number];

type QuickPhraseTarget = {
  buildHref: (phraseText: string) => Href;
  accessibilityHint: string;
};

const quickPhraseTargets: Record<QuickPhraseId, QuickPhraseTarget> = {
  'open-scanner': {
    buildHref: () => '/scan',
    accessibilityHint: 'Open scanner',
  },
  'stock-low': {
    buildHref: () => '/alerts',
    accessibilityHint: 'Open alerts',
  },
  'waste-alert': {
    buildHref: () => '/alerts',
    accessibilityHint: 'Open alerts',
  },
  'payment-failed': {
    buildHref: (phraseText) => `/helpdesk?prefill=${encodeURIComponent(phraseText)}` as Href,
    accessibilityHint: 'Open hulp en support',
  },
  'invoice-ready': {
    buildHref: () => '/payments',
    accessibilityHint: 'Open betalingen',
  },
  'food-safety': {
    buildHref: (phraseText) => `/helpdesk?prefill=${encodeURIComponent(phraseText)}` as Href,
    accessibilityHint: 'Open food safety hulp',
  },
};

const indexedPhrasePack = phrasePack.map((item) => ({
  ...item,
  normalizedAliases: item.aliases.map((alias) => normalizePackText(alias)),
}));

const indexedWordPack = wordPack.reduce((index, item) => {
  for (const alias of item.aliases) {
    index.set(normalizePackText(alias), item);
  }
  return index;
}, new Map<string, PackItem>());

function getLanguageCode(language: LanguageLabel) {
  return languageCodeMap[language] ?? 'en-US';
}

function normalizePackText(value: string) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(value: string) {
  if (!value) return value;
  return `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;
}

function matchWordCase(inputWord: string, translatedWord: string) {
  if (!translatedWord) return translatedWord;
  if (inputWord.toUpperCase() === inputWord) return translatedWord.toUpperCase();
  if (inputWord[0]?.toUpperCase() === inputWord[0]) return capitalize(translatedWord);
  return translatedWord;
}

function resolvePackText(item: PackItem, targetLang: LanguageLabel, fallbackText: string) {
  return item.translations[targetLang] ?? item.translations.English ?? fallbackText;
}

function translateWithPack(text: string, sourceLang: LanguageLabel, targetLang: LanguageLabel): TranslationResult {
  const source = String(text ?? '');
  const trimmed = source.trim();
  if (!trimmed) {
    return { text: '', qualityLabel: '', matchedTags: [] };
  }

  if (sourceLang === targetLang) {
    return { text: source, qualityLabel: 'Zelfde taal', matchedTags: ['direct'] };
  }

  const normalizedInput = normalizePackText(trimmed);
  const exactPhrase = indexedPhrasePack.find((item) => item.normalizedAliases.includes(normalizedInput));
    if (exactPhrase) {
    return {
      text: resolvePackText(exactPhrase, targetLang, source),
      qualityLabel: 'Pakket exact',
      matchedTags: exactPhrase.tags,
    };
  }

  const matchedTags = new Set<string>();
  let replacedWords = 0;

  const translated = source.replace(/\p{L}[\p{L}\p{N}'-]*/gu, (word) => {
    const key = normalizePackText(word);
    const item = indexedWordPack.get(key);
    if (!item) return word;

    const replacement = resolvePackText(item, targetLang, word);
    if (!replacement) return word;

    replacedWords += 1;
    for (const tag of item.tags) matchedTags.add(tag);
    return matchWordCase(word, replacement);
  });

  if (replacedWords === 0) {
    return {
      text: source,
      qualityLabel: 'Live context',
      matchedTags: ['context'],
    };
  }

  const qualityLabel =
    replacedWords >= 5 ? 'Sterk taalpakket' : replacedWords >= 3 ? 'Slim domein' : 'Basisvertaling';

  return {
    text: translated,
    qualityLabel,
    matchedTags: Array.from(matchedTags),
  };
}

export default function TranslateScreen() {
  const router = useRouter();
  const [sourceLang, setSourceLang] = useState<LanguageLabel>('Nederlands');
  const [targetLang, setTargetLang] = useState<LanguageLabel>('English');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [translationMeta, setTranslationMeta] = useState<{ qualityLabel: string; matchedTags: string[] }>({
    qualityLabel: '',
    matchedTags: [],
  });
  const [inputMode, setInputMode] = useState<'type' | 'mic'>('type');
  const [listening, setListening] = useState(false);
  const [talkBackEnabled, setTalkBackEnabled] = useState(() => loadTalkbackSettings().enabled);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);

  const SpeechRecognitionCtor = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    const anyGlobal = globalThis as any;
    return anyGlobal.webkitSpeechRecognition ?? anyGlobal.SpeechRecognition ?? null;
  }, []);
  const canUseSpeech = typeof SpeechRecognitionCtor === 'function';
  const canTalkBack = canTalkBackGlobal();

  const languageOptions = useMemo(
    () => languages.filter((lang) => lang !== sourceLang),
    [sourceLang]
  );

  const quickPhrases = useMemo(
    () =>
      quickPhraseIds
        .map((id) => phrasePack.find((item) => item.id === id))
        .filter((item): item is PackItem => Boolean(item))
        .map((item) => {
          const route = quickPhraseTargets[item.id as QuickPhraseId];
          const text = resolvePackText(item, sourceLang, item.translations.English ?? item.id);
          return {
            id: item.id,
            text,
            accessibilityHint: route.accessibilityHint,
            href: route.buildHref(text),
          };
        }),
    [sourceLang]
  );

  const runTranslation = useCallback(
    (text: string) => {
      const result = translateWithPack(text, sourceLang, targetLang);
      setOutputText(result.text);
      setTranslationMeta({ qualityLabel: result.qualityLabel, matchedTags: result.matchedTags });
    },
    [sourceLang, targetLang]
  );

  const speak = useCallback(
    (text: string) => {
      if (!canTalkBack) return;
      talkBack(text, { lang: getLanguageCode(targetLang) }).catch(() => {});
    },
    [canTalkBack, targetLang]
  );

  useEffect(() => {
    if (!canUseSpeech || !SpeechRecognitionCtor) return;

    const recognizer = new SpeechRecognitionCtor();
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = getLanguageCode(sourceLang);
    recognizer.onresult = (event: any) => {
      const text = String(event.results?.[0]?.[0]?.transcript ?? '');
      setInputMode('type');
      setInputText(text);
      runTranslation(text);
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
  }, [SpeechRecognitionCtor, canUseSpeech, runTranslation, sourceLang]);

  useEffect(() => {
    if (!inputText.trim()) {
      setOutputText('');
      setTranslationMeta({ qualityLabel: '', matchedTags: [] });
      return;
    }
    runTranslation(inputText);
  }, [inputText, runTranslation, sourceLang, targetLang]);

  useEffect(() => {
    if (!talkBackEnabled) return;
    if (!outputText.trim()) return;
    speak(outputText);
  }, [outputText, speak, talkBackEnabled]);

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

    try {
      setInputMode('mic');
      setListening(true);
      recognitionRef.current.start();
    } catch {
      setInputMode('type');
      setListening(false);
    }
  }, [canUseSpeech, listening]);

  const handleTalkBackToggle = useCallback(() => {
    if (!canTalkBack) return;
    setTalkBackEnabled((prev) => {
      const next = !prev;
      const current = loadTalkbackSettings();
      saveTalkbackSettings({
        ...current,
        enabled: next,
        lang: getLanguageCode(targetLang),
      });
      if (!next) {
        stopTalkBack().catch(() => {});
      }
      if (next && outputText.trim()) {
        speak(outputText);
      }
      return next;
    });
  }, [canTalkBack, outputText, speak, targetLang]);

  const handleSelectTarget = useCallback(
    (language: LanguageLabel) => {
      if (language === sourceLang) {
        setSourceLang(targetLang);
        setTargetLang(language);
      } else {
        setTargetLang(language);
      }
      if (inputText.trim()) {
        runTranslation(inputText);
      }
    },
    [inputText, runTranslation, sourceLang, targetLang]
  );

  const handleSelectSource = useCallback(
    (language: LanguageLabel) => {
      if (language === targetLang) {
        setTargetLang(sourceLang);
        setSourceLang(language);
      } else {
        setSourceLang(language);
      }
      if (inputText.trim()) {
        runTranslation(inputText);
      }
    },
    [inputText, runTranslation, sourceLang, targetLang]
  );

  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    if (inputText.trim()) {
      runTranslation(inputText);
    }
  }, [inputText, runTranslation, sourceLang, targetLang]);

  const handleQuickPhrasePress = useCallback(
    (phrase: (typeof quickPhrases)[number]) => {
      router.push(phrase.href);
    },
    [router]
  );

  const handleQuickPhraseLongPress = useCallback(
    (phrase: (typeof quickPhrases)[number]) => {
      setInputMode('type');
      setInputText(phrase.text);
      runTranslation(phrase.text);
      inputRef.current?.focus?.();
    },
    [runTranslation]
  );

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.screen}>
        <TazeHero
          title="Vertalen"
          subtitle="Taze meertalig taalpakket"
          description="Deze module gebruikt een domeingericht taalpakket voor support, voorraad, afboekingen en betalingen."
        />

        <TazeCard style={styles.translateCard}>
          <View style={styles.langRow}>
            <TazeChip
              label={sourceLang}
              active
              onPress={() => setSourceLang(sourceLang === 'Nederlands' ? 'English' : 'Nederlands')}
              style={styles.langChip}
            />
            <Pressable style={styles.swapButton} onPress={handleSwapLanguages}>
              <MaterialIcons name="swap-horiz" size={20} color="#0f172a" />
            </Pressable>
            <TazeChip
              label={targetLang}
              active
              onPress={() => setTargetLang(languageOptions[0] ?? 'English')}
              style={styles.langChip}
            />
          </View>

          <View style={styles.inputRow}>
            <Pressable style={styles.inputModeButton} onPress={handleTypingMode}>
              <MaterialIcons name="keyboard" size={20} color={inputMode === 'type' ? '#0f766e' : '#64748b'} />
            </Pressable>

            <TextInput
              ref={inputRef}
              value={inputText}
              onChangeText={(text) => {
                setInputMode('type');
                setInputText(text);
                runTranslation(text);
              }}
              placeholder={canUseSpeech ? 'Typ of spreek om te vertalen' : 'Typ om te vertalen'}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              multiline
            />

            <Pressable
              style={[styles.inputModeButton, !canTalkBack ? styles.inputModeButtonDisabled : null]}
              disabled={!canTalkBack}
              onPress={handleTalkBackToggle}>
              <MaterialIcons
                name={talkBackEnabled ? 'volume-up' : 'volume-off'}
                size={20}
                color={!canTalkBack ? '#94a3b8' : talkBackEnabled ? '#0f766e' : '#64748b'}
              />
            </Pressable>

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

          <View style={styles.quickPhraseRow}>
            {quickPhrases.map((phrase) => (
              <TazeChip
                key={phrase.id}
                label={phrase.text}
                onPress={() => handleQuickPhrasePress(phrase)}
                onLongPress={() => handleQuickPhraseLongPress(phrase)}
                accessibilityHint={phrase.accessibilityHint}
              />
            ))}
          </View>

          <View style={styles.outputBox}>
            <ThemedText style={styles.outputLabel}>Vertaling</ThemedText>
            <ThemedText>{outputText || 'Resultaat verschijnt hier.'}</ThemedText>
            {translationMeta.qualityLabel ? (
              <ThemedText style={styles.outputMeta}>Niveau: {translationMeta.qualityLabel}</ThemedText>
            ) : null}
            {translationMeta.matchedTags.length > 0 ? (
              <View style={styles.tagRow}>
                {translationMeta.matchedTags.map((tag) => (
                  <TazeBadge key={tag} label={tag} tone="neutral" />
                ))}
              </View>
            ) : null}
          </View>
        </TazeCard>

        <View style={styles.sectionHint}>
          <ThemedText type="defaultSemiBold">Alle talen</ThemedText>
          <ThemedText style={styles.sectionHintText}>
            Tik om je doeltaal te kiezen. Lang indrukken zet je bron direct om.
          </ThemedText>
        </View>

        <View style={styles.languageGrid}>
          {languages.map((language) => (
            <Pressable
              key={language}
              style={[
                styles.languageCard,
                language === targetLang ? styles.languageCardActiveTarget : null,
                language === sourceLang ? styles.languageCardActiveSource : null,
              ]}
              onPress={() => handleSelectTarget(language)}
              onLongPress={() => handleSelectSource(language)}>
              <ThemedText type="defaultSemiBold">{language}</ThemedText>
              <ThemedText style={styles.languageMeta}>
                {language === sourceLang ? 'Bron' : language === targetLang ? 'Doeltaal' : 'Beschikbaar'}
              </ThemedText>
            </Pressable>
          ))}
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
    gap: 6,
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
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  heroLogoFrame: {
    width: 72,
    height: 72,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.32)',
    backgroundColor: Brand.dark,
  },
  heroLogo: {
    width: '100%',
    height: '100%',
  },
  translateCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 16,
    gap: 12,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 10,
  },
  langChip: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 130,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15,118,110,0.72)',
    backgroundColor: 'rgba(236,254,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  swapButton: {
    width: 34,
    height: 34,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    minHeight: 44,
    maxHeight: 140,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    color: '#0f172a',
    textAlignVertical: 'top',
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
  quickPhraseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPhraseChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(203,213,225,0.78)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickPhraseText: {
    color: '#334155',
    fontSize: 12,
  },
  outputBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(248,250,252,0.9)',
    padding: 12,
    gap: 6,
  },
  outputLabel: {
    color: '#475569',
  },
  outputMeta: {
    color: '#0f766e',
    fontSize: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(226,232,240,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: '#334155',
    fontSize: 11,
  },
  sectionHint: {
    gap: 4,
  },
  sectionHintText: {
    color: '#475569',
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  languageCard: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.72)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    padding: 16,
    gap: 4,
  },
  languageCardActiveTarget: {
    borderColor: Brand.accent,
    backgroundColor: 'rgba(236,254,255,0.92)',
  },
  languageCardActiveSource: {
    borderColor: Brand.primary,
    backgroundColor: 'rgba(239,246,255,0.92)',
  },
  languageMeta: {
    color: '#64748b',
    fontSize: 13,
  },
});




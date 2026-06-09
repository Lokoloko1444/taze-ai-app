import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Brand } from 'constants/theme';
import { getInventoryMetrics, useInventory } from 'hooks/use-inventory';
import { LegalConfig } from 'lib/legal-config';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';

export type ScreenAiContext =
  | 'security'
  | 'account'
  | 'services'
  | 'newsletter'
  | 'updates'
  | 'trace'
  | 'privacy'
  | 'support'
  | 'contact';

type ScreenAiStatus = {
  appLockEnabled?: boolean;
  preventScreenCapture?: boolean;
  biometricsOk?: boolean | null;
  configured?: boolean;
  sessionEmail?: string | null;
  role?: string | null;
  userEmail?: string;
  barcodeLearningCount?: number;
  readiness?: number;
  selectedItemName?: string | null;
  selectedLocation?: string | null;
  filteredCount?: number;
};

type AiSignal = {
  label: string;
  value: string;
  detail: string;
};

type AiAction = {
  id: string;
  title: string;
  detail: string;
  cta: string;
  tone: string;
  surface: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href?: Href;
};

type PanelContent = {
  badge: string;
  title: string;
  detail: string;
  signals: AiSignal[];
  actions: AiAction[];
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function ScreenAiPanel({ screen, status = {} }: { screen: ScreenAiContext; status?: ScreenAiStatus }) {
  return <ScreenAiPanelContent screen={screen} status={status} />;
}

function ScreenAiPanelContent({ screen, status = {} }: { screen: ScreenAiContext; status?: ScreenAiStatus }) {

  const router = useRouter();
  const { items, financeEntries, movements, locations, liveAlerts } = useInventory();

  const metrics = useMemo(() => getInventoryMetrics(items), [items]);
  const expiringItems = useMemo(
    () => items.filter((item) => item.expiryDays !== null && item.expiryDays <= 2),
    [items]
  );
  const lowConfidenceItems = useMemo(
    () => items.filter((item) => item.confidence !== null && item.confidence < 0.8),
    [items]
  );

  const content = useMemo<PanelContent>(() => {
    const baseSignals: AiSignal[] = [
      {
        label: 'AI bereik',
        value: `${metrics.totalProducts} producten`,
        detail:
          metrics.totalProducts > 0
            ? `${metrics.totalUnits} stuks in live monitoring`
            : 'Nog geen voorraaddata beschikbaar',
      },
      {
        label: 'Urgentie',
        value: expiringItems.length > 0 ? `${expiringItems.length} vervallen bijna` : 'Stabiel',
        detail:
          expiringItems.length > 0
            ? 'AI ziet directe vervaldruk in je voorraad'
            : 'Geen acute afboekingsdruk gedetecteerd',
      },
      {
        label: 'Kwaliteit',
        value: metrics.totalProducts > 0 ? formatPercent(metrics.averageConfidence * 100) : 'Geen score',
        detail:
          lowConfidenceItems.length > 0
            ? `${lowConfidenceItems.length} item(s) vragen extra controle`
            : 'Herkenning draait momenteel stabiel',
      },
    ];

    if (screen === 'security') {
      const securityLayers = Number(Boolean(status.appLockEnabled)) + Number(Boolean(status.preventScreenCapture));
      return {
        badge: securityLayers === 2 ? 'Beveiligingscoach' : 'Beveiligingssignaal',
        title:
          securityLayers === 2
            ? 'Beveiliging staat sterk, maar AI blijft meekijken op datastromen.'
            : 'AI ziet nog beveiligingsruimte rond gevoelige voorraad- en betalingsdata.',
        detail:
          securityLayers === 2
            ? 'Je toestelbescherming is actief. Koppel dat nu slim aan alerts en accountrechten.'
            : 'Deze app verwerkt voorraad, prijs- en accountinformatie. Extra toestelbeveiliging verlaagt operationeel risico.',
        signals: [
          {
            label: 'Posture',
            value: `${securityLayers}/2 lagen`,
            detail: status.biometricsOk === false ? 'Biometrie ontbreekt op dit toestel' : 'App-lock en capture-block zijn de basis',
          },
          {
            label: 'Live risico',
            value: liveAlerts.length > 0 ? `${liveAlerts.length} recente events` : 'Rustig',
            detail: liveAlerts.length > 0 ? 'Realtime events maken bescherming relevanter' : 'Geen piek in live meldingen',
          },
          baseSignals[1],
        ],
        actions: [
          {
            id: 'security-lock',
            title: status.appLockEnabled ? 'App-lock is actief' : 'Zet app-lock aan',
            detail: status.appLockEnabled
              ? 'Goed voor gedeelde toestellen en snelle terugkeer in service.'
              : 'Bescherm scan-, stock- en betaalflows zodra iemand de app opent.',
            cta: status.appLockEnabled ? 'Sterke basis' : 'Activeer hieronder',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: status.appLockEnabled ? 'verified-user' : 'lock',
          },
          {
            id: 'security-capture',
            title: status.preventScreenCapture ? 'Screenshots zijn geblokkeerd' : 'Blokkeer screenshots',
            detail: status.preventScreenCapture
              ? 'Goed voor prijsafspraken, rapporten en klantgevoelige schermen.'
              : 'Voorkom dat voorraad- of betalingsschermen makkelijk gedeeld worden.',
            cta: status.preventScreenCapture ? 'Privacy sterker' : 'Schakel hieronder in',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: status.preventScreenCapture ? 'visibility-off' : 'shield',
          },
          {
            id: 'security-follow-up',
            title: expiringItems.length > 0 ? 'Combineer security met alerts' : 'Leg rechten vast in account',
            detail:
              expiringItems.length > 0
                ? `${expiringItems.length} kritieke items vragen opvolging. Goede beveiliging voorkomt foute handelingen in piekmomenten.`
                : 'Zorg dat teamleden met de juiste rol werken zodra cloud sync actief is.',
            cta: expiringItems.length > 0 ? 'Open alerts' : 'Open account',
            tone: '#7c3aed',
            surface: '#f5f3ff',
            icon: expiringItems.length > 0 ? 'notifications-active' : 'manage-accounts',
            href: expiringItems.length > 0 ? '/alerts' : '/account',
          },
        ],
      };
    }

    if (screen === 'account') {
      const cloudLabel = !status.configured ? 'Niet ingesteld' : status.sessionEmail ? 'Verbonden' : 'Klaar';
      return {
        badge: status.sessionEmail ? 'Zorgregie actief' : 'Zorgregie instellen',
        title: status.sessionEmail
          ? 'AI ziet deze sessie als de actieve toegang.'
          : 'AI ziet de tweede bladzijde als de plek voor login en rollen.',
        detail: status.sessionEmail
          ? 'Gebruik rollen en security samen zodat inzichten, alerts en toegang ook op meerdere toestellen betrouwbaar blijven.'
          : 'Zonder eigen toegang blijft AI lokaal sterk, maar teamdata, rollen en sync missen dan samenhang.',
        signals: [
          {
            label: 'Cloud',
            value: cloudLabel,
            detail: status.sessionEmail ?? 'Nog geen actieve sessie',
          },
          {
            label: 'Sessie',
            value: status.sessionEmail ? 'Actief' : 'Open',
            detail: status.sessionEmail ? 'Deze login is nu gekoppeld aan de cloud' : 'Log in om cloud sync te activeren',
          },
          {
            label: 'Rol',
            value: status.role ? status.role : 'Nog open',
            detail: status.role ? 'Rolverdeling is opgeslagen' : 'Kies een rol om rechten later scherp te zetten',
          },
          baseSignals[0],
        ],
        actions: [
          {
            id: 'account-legal',
            title: 'Wetten eerst',
            detail: 'Privacy, support en contact horen altijd mee te lopen naast account en security.',
            cta: 'Open privacy',
            tone: '#7c3aed',
            surface: '#f5f3ff',
            icon: 'gavel',
            href: '/privacy' as Href,
          },
          {
            id: 'account-security',
            title: 'Veiligheid eerst',
            detail: 'Zet account, schermbeveiliging en duidelijke rolverdeling vast voordat je teams of sync uitbreidt.',
            cta: 'Open beveiliging',
            tone: '#7c2d12',
            surface: '#fff7ed',
            icon: 'shield',
            href: '/security',
          },
          {
            id: 'account-child-safety',
            title: 'Veiligheid voor kinderen',
            detail: 'Zorg dat AI, content en toegang direct stoppen bij risico en de kindveiligheid apart bewaakt wordt.',
            cta: 'Open kindveiligheid',
            tone: '#15803d',
            surface: '#f0fdf4',
            icon: 'verified-user',
            href: '/security',
          },
          {
            id: 'account-load-speed',
            title: 'Snelheid in het laden',
            detail: 'Houd de app licht en snel, zodat de tweede bladzijde en de rest van de flow direct reageren zonder extra wachttijd.',
            cta: 'Open readiness',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: 'speed',
            href: '/readiness',
          },
          {
            id: 'account-cancer-fund',
            title: 'Kankerfonds UZ Gent',
            detail: 'Steun de officiele UZ Gent-route en houd de bijdrage klein en transparant, bijvoorbeeld met 1 euro als vaste start.',
            cta: 'Open steunroute',
            tone: '#be123c',
            surface: '#fff1f2',
            icon: 'volunteer-activism',
            href: LegalConfig.cancerFundRoute as Href,
          },
          {
            id: 'account-creative-artists',
            title: 'Creatieve kunstenaars',
            detail: 'Geef makers een eigen route voor support, updates en publieke push zodat hun werk sneller zichtbaar wordt.',
            cta: 'Open creatieve route',
            tone: '#0f766e',
            surface: '#f0fdfa',
            icon: 'palette',
            href: LegalConfig.creativeArtistsRoute as Href,
          },
          {
            id: 'account-growth',
            title: 'Groei kansen zeer duidelijk',
            detail: 'Laat AI meteen zien waar extra omzet, diensten en partners te pakken zijn.',
            cta: 'Open diensten',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: 'trending-up',
            href: '/services' as Href,
          },
          {
            id: 'account-finance',
            title: 'Winst en verlies naar de manager',
            detail: 'Zet omzet, verlies en marge direct bovenaan zodat management meteen ziet waar het geld lekt of groeit.',
            cta: 'Open betalingen',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: 'payments',
            href: '/payments',
          },
          {
            id: 'account-auth',
            title: status.configured ? (status.sessionEmail ? 'Sessie is actief' : 'Log je teamaccount in') : 'Supabase ontbreekt nog',
            detail: status.configured
              ? status.sessionEmail
                ? 'De powerlaag kan nu voorraad- en financecontext meedragen.'
                : 'Een eigen login maakt AI-data bruikbaar over meerdere toestellen heen.'
              : 'Zet eerst je Supabase URL en anon key zodat de powerlaag en syncflows werken.',
            cta: status.sessionEmail ? 'Cloud klaar' : 'Werk hieronder af',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: status.sessionEmail ? 'cloud-done' : 'login',
          },
          {
            id: 'account-role',
            title: status.role ? 'Rol is gekozen' : 'Kies nu een rol',
            detail: status.role
              ? 'Goed voor onderscheid tussen eigenaar, team en operationele gebruikers.'
              : 'AI-advies rond finance en voorraad wordt bruikbaarder zodra rechten duidelijk zijn.',
            cta: status.role ? 'Rolverdeling actief' : 'Bewaar rol hieronder',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: status.role ? 'badge' : 'admin-panel-settings',
          },
        ],
      };
    }    if (screen === 'privacy') {
      return {
        badge: 'Privacygids',
        title: 'AI ziet privacy als vaste Taze-route, niet alleen als store-verplichting.',
        detail:
          'Gebruik privacy samen met support en account zodat vragen over data, login en operationele verwerking op dezelfde plek landen.',
        signals: [
          {
            label: 'Policy',
            value: 'Actief',
            detail: 'Publieke privacyroute staat klaar voor release en support',
          },
          {
            label: 'Account-impact',
            value: status.configured ? 'Cloud context' : 'Lokaal eerst',
            detail: status.configured
              ? 'Privacyvragen raken ook login, sync en rollen'
              : 'Zonder cloud blijft privacy vooral toestel- en appgericht',
          },
          baseSignals[1],
        ],
        actions: [
          {
            id: 'privacy-support',
            title: 'Koppel privacy aan support',
            detail: 'Zo stuur je vragen over data en beleid meteen naar het juiste kanaal.',
            cta: 'Open support',
            tone: '#b45309',
            surface: '#fffbeb',
            icon: 'support-agent',
            href: '/support' as Href,
          },
          {
            id: 'privacy-contact',
            title: 'Houd contact publiek duidelijk',
            detail: 'Een zichtbare contactroute maakt privacy- en verwijdervragen minder versnipperd.',
            cta: 'Open contact',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: 'mail',
            href: '/contact' as Href,
          },
          {
            id: 'privacy-security',
            title: 'Verbind beleid met security',
            detail: 'App-lock, screen capture en accounttoegang maken privacy concreet in gebruik.',
            cta: 'Open beveiliging',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: 'shield',
            href: '/security',
          },
        ],
      };
    }

    if (screen === 'support') {
      return {
        badge: 'Hulpcoach',
        title: 'AI ziet support als schakel tussen hulp, communicatie en formele opvolging.',
        detail:
          'Gebruik support niet alleen voor vragen, maar ook om updates, Ria en contact logisch met elkaar te verbinden.',
        signals: [
          {
            label: 'Kanaal',
            value: 'Centraal',
            detail: 'Hulp bundelt helpdesk, nieuwsbrief en publieke hulp',
          },
          {
            label: 'Urgentie',
            value: liveAlerts.length > 0 ? `${liveAlerts.length} live events` : 'Stabiel',
            detail: liveAlerts.length > 0 ? 'Operationele druk verhoogt ook supportdruk' : 'Geen piek in live opvolging',
          },
          baseSignals[0],
        ],
        actions: [
          {
            id: 'support-helpdesk',
            title: 'Ria blijft je snelste supportpad',
            detail: 'Goed voor operationele hulp en directe schermroutes.',
            cta: 'Open Ria',
            tone: '#b45309',
            surface: '#fffbeb',
            icon: 'smart-toy',
            href: '/helpdesk',
          },
          {
            id: 'support-newsletter',
            title: 'Gebruik updates als supportlaag',
            detail: 'Nieuwsbrief en updates verlagen losse vragen en versnipperde communicatie.',
            cta: 'Open nieuwsbrief',
            tone: '#6d28d9',
            surface: '#f5f3ff',
            icon: 'mail',
            href: '/newsletter' as Href,
          },
          {
            id: 'support-contact',
            title: 'Maak direct contact zichtbaar',
            detail: 'Zo kan support ook snel doorlopen naar een formeel contactpunt.',
            cta: 'Open contact',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: 'call',
            href: '/contact' as Href,
          },
        ],
      };
    }

    if (screen === 'contact') {
      return {
        badge: 'Contactroute',
        title: 'AI ziet contact als vaste eindlaag voor support, privacy en commerciële opvolging.',
        detail:
          'Een duidelijke contactroute helpt bij support, legal vragen en vertrouwen rond account- en financeflows.',
        signals: [
          {
            label: 'Bereikbaarheid',
            value: 'Direct',
            detail: 'Hulpmail en publieke routes staan samen op één scherm',
          },
          {
            label: 'Vertrouwen',
            value: status.sessionEmail ? 'Met accountcontext' : 'Publiek zichtbaar',
            detail: status.sessionEmail
              ? 'Goed voor support en accountvragen vanuit actieve gebruikers'
              : 'Ook zonder login blijft contact direct toegankelijk',
          },
          baseSignals[2],
        ],
        actions: [
          {
            id: 'contact-support',
            title: 'Koppel contact aan support',
            detail: 'Laat algemene vragen eerst via support of Ria landen voor snellere triage.',
            cta: 'Open support',
            tone: '#b45309',
            surface: '#fffbeb',
            icon: 'support-agent',
            href: '/support' as Href,
          },
          {
            id: 'contact-privacy',
            title: 'Verbind contact met privacy',
            detail: 'Handig voor gegevensvragen, beleid en verwijderverzoeken.',
            cta: 'Open privacy',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: 'shield',
            href: '/privacy' as Href,
          },
          {
            id: 'contact-account',
            title: 'Accountvragen? Stuur door naar login',
            detail: 'Zo scheid je formeel contact van sessie-, sync- en rolvragen.',
            cta: 'Open account',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: 'person',
            href: '/account',
          },
        ],
      };
    }

    if (screen === 'services') {
      const readiness = typeof status.readiness === 'number' ? status.readiness : 58;
      const lowStockCount = items.filter((item) => item.quantity <= 1).length;
      return {
        badge: 'Service-match',
        title: 'AI matcht je operationele data nu aan de beste service-uitbreiding.',
        detail:
          expiringItems.length > 0 || lowStockCount > 0
            ? 'De slimste service hangt af van vervaldruk, lage stock en hoeveel grip je al hebt op finance.'
            : 'Je basis is stabiel. AI kijkt nu vooral naar groei, bezorging en automatisering.',
        signals: [
          {
            label: 'Service-fit',
            value: `${readiness}%`,
            detail: 'Gebaseerd op locaties, voorraad en druk in de flow',
          },
          {
            label: 'Vestigingen',
            value: `${locations.length}`,
            detail: 'Meer locaties maken delivery- en logistiekoppelingen waardevoller',
          },
          baseSignals[1],
        ],
        actions: [
          {
            id: 'services-expiry',
            title: expiringItems.length > 0 ? 'Prioriteit: afboekingen en levering slim sturen' : 'Geen acute afboekingsdruk',
            detail: expiringItems.length > 0
              ? `${expiringItems.length} item(s) zitten op korte houdbaarheid. Start met alerts en partnerkeuze.`
              : 'Je vervaldruk is laag. Focus eerder op groei- of bezorgservices.',
            cta: 'Open alerts',
            tone: '#c2410c',
            surface: '#fff7ed',
            icon: 'warning-amber',
            href: '/alerts',
          },
          {
            id: 'services-stock',
            title: lowStockCount > 0 ? 'Leverflow kan winst geven' : 'Voorraad is stabiel genoeg voor scaling',
            detail: lowStockCount > 0
              ? `${lowStockCount} producten zitten laag. Een serviceflow rond replenishment heeft nu direct effect.`
              : 'Gebruik inzichten om te bepalen welke service het snelst nieuwe omzet opent.',
            cta: 'Open inzichten',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: 'insights',
            href: '/explore',
          },
          {
            id: 'services-payments',
            title: financeEntries.length > 0 ? 'Betalingen sluiten mooi aan' : 'Voeg eerst betalingen toe',
            detail: financeEntries.length > 0
              ? 'Met actieve financegegevens kan AI veel beter servicewaarde en marge inschatten.'
              : 'Zonder omzet- en kostdata blijft servicekeuze minder scherp.',
            cta: 'Open betalingen',
            tone: '#7c3aed',
            surface: '#f5f3ff',
            icon: 'payments',
            href: '/payments',
          },
        ],
      };
    }

    if (screen === 'newsletter') {
      const hasEmail = Boolean(status.userEmail?.trim());
      const learningCount = typeof status.barcodeLearningCount === 'number' ? status.barcodeLearningCount : 0;
      return {
        badge: hasEmail ? 'Communicatie actief' : 'Communicatie instellen',
        title: hasEmail
          ? 'AI ziet dat je kanaal klaarstaat om updates, releases en support slim te centraliseren.'
          : 'AI ziet nog geen contactpunt voor productupdates en klantcommunicatie.',
        detail:
          learningCount > 0
            ? 'Je app leert al van correcties. Een nieuwsbrief helpt om nieuwe mogelijkheden of verbeterde flows sneller te delen.'
            : 'Gebruik dit contactpunt om releases, support en productverbeteringen minder ad hoc te maken.',
        signals: [
          {
            label: 'Contact',
            value: hasEmail ? 'Klaar' : 'Ontbreekt',
            detail: hasEmail ? status.userEmail!.trim() : 'Nog geen e-mailadres ingevuld',
          },
          {
            label: 'Leermomenten',
            value: learningCount > 0 ? `${learningCount} correcties` : 'Nog leeg',
            detail: learningCount > 0 ? 'AI heeft al lokale barcodekennis opgebouwd' : 'Nog geen lokale leerdata gevonden',
          },
          baseSignals[0],
        ],
        actions: [
          {
            id: 'newsletter-email',
            title: hasEmail ? 'Contactmail is ingevuld' : 'Voeg eerst je contactmail toe',
            detail: hasEmail
              ? 'Goed voor release-notes, support en operationele updates.'
              : 'Zo maak je van losse support een vaste communicatieflow.',
            cta: hasEmail ? 'Kanaal actief' : 'Vul hieronder aan',
            tone: '#6d28d9',
            surface: '#f5f3ff',
            icon: hasEmail ? 'mark-email-read' : 'mail',
          },
          {
            id: 'newsletter-updates',
            title: learningCount > 0 ? 'Deel wat AI geleerd heeft' : 'Bouw eerst nieuwe leerdata op',
            detail: learningCount > 0
              ? 'Gebruik geleerde barcodecorrecties als inhoud voor productupdates of changelogs.'
              : 'Meer scans en correcties maken toekomstige updates waardevoller.',
            cta: learningCount > 0 ? 'Open updates' : 'Open scanner',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: learningCount > 0 ? 'auto-awesome' : 'qr-code-scanner',
            href: learningCount > 0 ? '/updates' : '/scan',
          },
          {
            id: 'newsletter-insights',
            title: expiringItems.length > 0 ? 'Communiceer ook operationele urgentie' : 'Gebruik insights als inhoudsbron',
            detail: expiringItems.length > 0
              ? `${expiringItems.length} kritieke items tonen dat tijdige communicatie belangrijk blijft.`
              : 'Inzichten geven je de beste bron voor relevante productupdates en rapportage.',
            cta: expiringItems.length > 0 ? 'Open alerts' : 'Open inzichten',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: expiringItems.length > 0 ? 'campaign' : 'insights',
            href: expiringItems.length > 0 ? '/alerts' : '/explore',
          },
        ],
      };
    }

    if (screen === 'updates') {
      const learningCount = typeof status.barcodeLearningCount === 'number' ? status.barcodeLearningCount : 0;
      return {
        badge: learningCount > 0 ? 'Leerdata actief' : 'Leerdata leeg',
        title:
          learningCount > 0
            ? 'AI ziet lokale leerdata die klaarstaat om te exporteren of verder te verfijnen.'
            : 'AI ziet nog geen opgeslagen correcties om als verbeterlaag te gebruiken.',
        detail:
          learningCount > 0
            ? 'Deze correcties maken volgende herkenningen consistenter op hetzelfde toestel of in je exportflow.'
            : 'Meer scans en handmatige correcties versterken je herkenningslaag zichtbaar.',
        signals: [
          {
            label: 'Correcties',
            value: learningCount > 0 ? `${learningCount}` : '0',
            detail: learningCount > 0 ? 'Lokale barcodeverbeteringen aanwezig' : 'Nog niets geleerd',
          },
          baseSignals[2],
          {
            label: 'Realtime',
            value: movements.length > 0 ? `${Math.min(12, movements.length)} recente events` : 'Geen events',
            detail: 'Meer operationele activiteit levert betere feedbacklussen op',
          },
        ],
        actions: [
          {
            id: 'updates-scan',
            title: learningCount > 0 ? 'Blijf AI voeden met nieuwe scans' : 'Start met scannen en corrigeren',
            detail: learningCount > 0
              ? 'Nieuwe beelden, barcodes en correcties houden je lokale model fris.'
              : 'De snelste weg naar betere AI is scannen, controleren en leren.',
            cta: 'Open scanner',
            tone: '#0f766e',
            surface: '#ecfeff',
            icon: 'qr-code-scanner',
            href: '/scan',
          },
          {
            id: 'updates-export',
            title: learningCount > 0 ? 'Export verdient prioriteit' : 'Export wordt relevant zodra er leerdata is',
            detail: learningCount > 0
              ? 'Je kunt correcties nu meenemen naar support, tests of een volgende omgeving.'
              : 'Zodra je correcties hebt, loont het om ze mee te nemen in je updateflow.',
            cta: learningCount > 0 ? 'Exporteer hieronder' : 'Nog even bouwen',
            tone: '#1d4ed8',
            surface: '#eff6ff',
            icon: learningCount > 0 ? 'ios-share' : 'inventory-2',
          },
          {
            id: 'updates-insights',
            title: lowConfidenceItems.length > 0 ? 'Pak lage zekerheid eerst aan' : 'Zet inzichten naast updates',
            detail: lowConfidenceItems.length > 0
              ? `${lowConfidenceItems.length} item(s) hebben nog twijfel. Daar valt nu de meeste AI-winst te halen.`
              : 'Gebruik insights om te zien of updates ook echt operationeel effect hebben.',
            cta: lowConfidenceItems.length > 0 ? 'Open scanner' : 'Open inzichten',
            tone: '#7c3aed',
            surface: '#f5f3ff',
            icon: lowConfidenceItems.length > 0 ? 'tune' : 'trending-up',
            href: lowConfidenceItems.length > 0 ? '/scan' : '/explore',
          },
        ],
      };
    }

    const activeLocation = status.selectedLocation?.trim() ? status.selectedLocation!.trim() : 'Alle vestigingen';
    const filteredCount = typeof status.filteredCount === 'number' ? status.filteredCount : metrics.totalProducts;
    return {
      badge: status.selectedItemName ? 'Trace-focus' : 'Trace-assistent',
      title: status.selectedItemName
        ? `AI volgt nu ${status.selectedItemName} door de flow heen.`
        : 'AI ziet track & trace als operationele cockpit voor bewegingen en verlies.',
      detail: status.selectedItemName
        ? 'Gebruik bewegingen, verbruik en afboekingen samen om betere alerts en finance-data te voeden.'
        : 'Zodra je een item kiest, wordt historiek direct bruikbaar voor voorraadsturing en accountability.',
      signals: [
        {
          label: 'Scope',
          value: `${filteredCount} items`,
          detail: `${activeLocation} staat nu in focus`,
        },
        {
          label: 'Bewegingen',
          value: movements.length > 0 ? `${movements.length}` : '0',
          detail: movements.length > 0 ? 'Track & trace historiek is beschikbaar' : 'Nog geen bewegingen gelogd',
        },
        baseSignals[1],
      ],
      actions: [
        {
          id: 'trace-select',
          title: status.selectedItemName ? 'Item is geselecteerd' : 'Kies eerst een product',
          detail: status.selectedItemName
            ? 'Mooi, nu kun je transfers, verbruik en afboekingen op dezelfde lijn registreren.'
            : 'AI kan pas scherpe trace-inzichten geven als een item of event in focus staat.',
          cta: status.selectedItemName ? 'Trace is live' : 'Selecteer links',
          tone: '#0f766e',
          surface: '#ecfeff',
          icon: status.selectedItemName ? 'track-changes' : 'playlist-add-check',
        },
        {
          id: 'trace-alerts',
          title: expiringItems.length > 0 ? 'Volg verval samen met trace' : 'Alerts blijven de beste volgende laag',
          detail: expiringItems.length > 0
            ? `${expiringItems.length} kritieke items kunnen direct gekoppeld worden aan historiek en verantwoordelijkheid.`
            : 'Ook zonder acute vervaldruk helpt alerts om afwijkingen sneller zichtbaar te maken.',
          cta: 'Open alerts',
          tone: '#c2410c',
          surface: '#fff7ed',
          icon: 'warning',
          href: '/alerts',
        },
        {
          id: 'trace-finance',
          title: financeEntries.length > 0 ? 'Financiën en trace raken elkaar nu' : 'Maak verlies financieel zichtbaar',
          detail: financeEntries.length > 0
            ? 'Goed moment om afboekingen, verbruik en marge naast elkaar te sturen.'
            : 'Boek afboekingen en kosten mee in zodat trace niet alleen logistiek blijft.',
          cta: financeEntries.length > 0 ? 'Open inzichten' : 'Open betalingen',
          tone: '#1d4ed8',
          surface: '#eff6ff',
          icon: financeEntries.length > 0 ? 'analytics' : 'payments',
          href: financeEntries.length > 0 ? '/explore' : '/payments',
        },
      ],
    };
  }, [
    expiringItems.length,
    financeEntries.length,
    items,
    liveAlerts.length,
    locations.length,
    lowConfidenceItems.length,
    metrics.averageConfidence,
    metrics.totalProducts,
    metrics.totalUnits,
    movements.length,
    screen,
    status.appLockEnabled,
    status.biometricsOk,
    status.configured,
    status.filteredCount,
    status.preventScreenCapture,
    status.readiness,
    status.role,
    status.selectedItemName,
    status.selectedLocation,
    status.sessionEmail,
    status.userEmail,
    status.barcodeLearningCount,
  ]);

  return (
    <ThemedView style={styles.panel}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <View style={styles.badge}>
            <MaterialIcons name="auto-awesome" size={16} color={Brand.primary} />
            <ThemedText type="defaultSemiBold" style={styles.badgeText}>
              {content.badge}
            </ThemedText>
          </View>
          <ThemedText type="subtitle">{content.title}</ThemedText>
          <ThemedText>{content.detail}</ThemedText>
        </View>
      </View>

      <View style={styles.signalRow}>
        {content.signals.map((signal) => (
          <View key={signal.label} style={styles.signalCard}>
            <ThemedText style={styles.signalLabel}>{signal.label}</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.signalValue}>
              {signal.value}
            </ThemedText>
            <ThemedText style={styles.signalDetail}>{signal.detail}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.actionGrid}>
        {content.actions.map((action) => {
          const body = (
            <>
              <View style={styles.actionHeader}>
                <View style={[styles.iconBadge, { backgroundColor: action.tone }]}>
                  <MaterialIcons name={action.icon} size={18} color="#ffffff" />
                </View>
                <View style={styles.actionHeaderCopy}>
                  <ThemedText type="defaultSemiBold">{action.title}</ThemedText>
                  <ThemedText style={styles.actionDetail}>{action.detail}</ThemedText>
                </View>
              </View>

              <View style={[styles.actionFooter, { backgroundColor: action.tone }]}>
                <ThemedText type="defaultSemiBold" style={styles.actionFooterText}>
                  {action.cta}
                </ThemedText>
                {action.href ? <MaterialIcons name="arrow-forward" size={16} color="#ffffff" /> : null}
              </View>
            </>
          );

          if (!action.href) {
            return (
              <View
                key={action.id}
                style={[styles.actionCard, { borderColor: action.tone, backgroundColor: action.surface }]}>
                {body}
              </View>
            );
          }

          return (
            <Pressable
              key={action.id}
              style={({ pressed }) => [
                styles.actionCard,
                { borderColor: action.tone, backgroundColor: action.surface, opacity: pressed ? 0.94 : 1 },
              ]}
              onPress={() => router.push(action.href!)}>
              {body}
            </Pressable>
          );
        })}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Brand.panelBorder,
    backgroundColor: Brand.panel,
    padding: 18,
    gap: 16,
  },
  hero: {
    gap: 10,
  },
  heroCopy: {
    gap: 8,
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
  signalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  signalCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Brand.panelBorder,
    backgroundColor: Brand.white,
    padding: 14,
    gap: 4,
  },
  signalLabel: {
    color: Brand.primary,
    fontSize: 12,
  },
  signalValue: {
    color: Brand.ink,
    fontSize: 18,
  },
  signalDetail: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    flexGrow: 1,
    flexBasis: 260,
    minWidth: 220,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  actionDetail: {
    color: '#475569',
    fontSize: 13,
  },
  actionFooter: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionFooterText: {
    color: '#ffffff',
    fontSize: 13,
  },
});






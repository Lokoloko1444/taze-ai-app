import type { AppLanguage } from 'lib/i18n';

export type ProofStep = {
  stepLabel: string;
  title: string;
  subtitle: string;
  keyLine: string;
  details: readonly string[];
};

export type ProofPackageCard = {
  title: string;
  subtitle: string;
  detail: string;
};

const DEMO_SEO_BY_LANGUAGE: Record<AppLanguage, { title: string; description: string }> = {
  nl: {
    title: 'Taze | Proof Pakket',
    description:
      'Ontdek het Taze Proof Pakket met 15 producten, volledige ketenwaarde en read-only AI/RIA advies binnen bevoegdheid.',
  },
  en: {
    title: 'Taze | Proof Package',
    description:
      'Explore the Taze Proof Package with 15 products, full chain value and read-only AI/RIA advice within permissions.',
  },
  fr: {
    title: 'Taze | Pack Proof',
    description:
      'Decouvrez le Pack Proof Taze avec 15 produits, une valeur de chaine complete et un conseil AI/RIA en lecture seule selon les droits.',
  },
  de: {
    title: 'Taze | Proof Paket',
    description:
      'Entdecke das Taze Proof Paket mit 15 Produkten, vollstaendigem Kettenwert und read-only AI/RIA Beratung innerhalb der Berechtigungen.',
  },
  es: {
    title: 'Taze | Paquete Proof',
    description:
      'Explora el Paquete Proof de Taze con 15 productos, valor completo de cadena y asesoramiento AI/RIA de solo lectura dentro de permisos.',
  },
  it: {
    title: 'Taze | Pacchetto Proof',
    description:
      'Esplora il Pacchetto Proof di Taze con 15 prodotti, valore completo della catena e consulenza AI/RIA in sola lettura entro i permessi.',
  },
  bg: {
    title: 'Taze | Пакет Proof',
    description:
      'Открийте Taze Proof пакет с 15 продукта, пълна стойност на веригата и четим AI/RIA съвет в рамките на разрешенията.',
  },
  hi: {
    title: 'Taze | प्रूफ पैकेज',
    description:
      'Taze प्रूफ पैकेज के साथ 15 उत्पाद, पूर्ण चेन मूल्य और अनुमतियों के भीतर रीड-ओनली AI/RIA सलाह की खोज करें।',
  },
  ja: {
    title: 'Taze | プルーフパッケージ',
    description:
      '15製品、フルチェーン価値、権限内の読み取り専用AI/RIAアドバイスを備えたTazeプルーフパッケージを体験してください。',
  },
  pl: {
    title: 'Taze | Pakiet Proof',
    description:
      'Odkryj pakiet Proof Taze z 15 produktami, pełną wartością łańcucha i tylko do odczytu poradami AI/RIA w ramach uprawnień.',
  },
  id: {
    title: 'Taze | Paket Proof',
    description:
      'Jelajahi Paket Proof Taze dengan 15 produk, nilai rantai penuh, dan saran AI/RIA hanya-baca dalam batas izin.',
  },
  ar: {
    title: 'Taze | حزمة Proof',
    description:
      'اكتشف حزمة Taze Proof مع 15 منتجًا، وقيمة سلسلة كاملة، ونصائح AI/RIA للقراءة فقط ضمن الأذونات.',
  },
};

const DEMO_HERO_BY_LANGUAGE: Record<
  AppLanguage,
  {
    badge: string;
    title: string;
    subtitle: string;
    keyLine: string;
    primaryCta: string;
    secondaryCta: string;
  }
> = {
  nl: {
    badge: 'Proof pakket',
    title: 'Taze Proof Pakket',
    subtitle: '15 producten, een volledige bedrijfsflow.',
    keyLine: 'Van scan tot rapport, binnen bevoegdheid en zonder echte impact.',
    primaryCta: 'Bekijk het proof-pakket',
    secondaryCta: 'Ontdek de 15-producten flow',
  },
  en: {
    badge: 'Proof package',
    title: 'Taze Proof Package',
    subtitle: '15 products, one complete business flow.',
    keyLine: 'From scan to report, within permissions and without real impact.',
    primaryCta: 'View the proof package',
    secondaryCta: 'Explore the 15-product flow',
  },
  fr: {
    badge: 'Pack Proof',
    title: 'Pack Proof Taze',
    subtitle: '15 produits, un flux metier complet.',
    keyLine: 'Du scan au rapport, selon les droits et sans impact reel.',
    primaryCta: 'Voir le pack proof',
    secondaryCta: 'Explorer le flux 15 produits',
  },
  de: {
    badge: 'Proof Paket',
    title: 'Taze Proof Paket',
    subtitle: '15 Produkte, ein vollstaendiger Geschaeftsflow.',
    keyLine: 'Vom Scan bis zum Bericht, innerhalb der Berechtigungen und ohne echte Auswirkung.',
    primaryCta: 'Proof Paket ansehen',
    secondaryCta: '15-Produkte-Flow entdecken',
  },
  es: {
    badge: 'Paquete Proof',
    title: 'Paquete Proof Taze',
    subtitle: '15 productos, un flujo empresarial completo.',
    keyLine: 'Del scan al informe, dentro de permisos y sin impacto real.',
    primaryCta: 'Ver paquete proof',
    secondaryCta: 'Explorar flujo de 15 productos',
  },
  it: {
    badge: 'Pacchetto Proof',
    title: 'Pacchetto Proof Taze',
    subtitle: '15 prodotti, un flusso aziendale completo.',
    keyLine: 'Dalla scansione al report, entro i permessi e senza impatto reale.',
    primaryCta: 'Vedi il pacchetto proof',
    secondaryCta: 'Esplora il flusso di 15 prodotti',
  },
  bg: {
    badge: 'Пакет Proof',
    title: 'Taze Proof пакет',
    subtitle: '15 продукта, един пълен бизнес поток.',
    keyLine: 'От сканиране до отчет, в рамките на разрешенията и без реално въздействие.',
    primaryCta: 'Прегледайте proof пакета',
    secondaryCta: 'Открийте потока с 15 продукта',
  },
  hi: {
    badge: 'प्रूफ पैकेज',
    title: 'Taze Proof पैकेज',
    subtitle: '15 उत्पाद, एक पूर्ण व्यापार प्रवाह।',
    keyLine: 'स्कैन से रिपोर्ट तक, अनुमतियों के भीतर और बिना असली प्रभाव के।',
    primaryCta: 'प्रूफ पैकेज देखें',
    secondaryCta: '15-उत्पाद प्रवाह एक्सप्लोर करें',
  },
  ja: {
    badge: 'プルーフパッケージ',
    title: 'Taze Proof パッケージ',
    subtitle: '15製品、1つの完全なビジネスフロー。',
    keyLine: 'スキャンからレポートまで、権限内で実際の影響なしに。',
    primaryCta: 'プルーフパッケージを見る',
    secondaryCta: '15製品フローを確認する',
  },
  pl: {
    badge: 'Pakiet Proof',
    title: 'Pakiet Proof Taze',
    subtitle: '15 produktów, jeden kompletny przepływ biznesowy.',
    keyLine: 'Od skanu do raportu, w ramach uprawnień i bez rzeczywistego wpływu.',
    primaryCta: 'Zobacz pakiet proof',
    secondaryCta: 'Odkryj przepływ 15 produktów',
  },
  id: {
    badge: 'Paket Proof',
    title: 'Taze Paket Proof',
    subtitle: '15 produk, satu alur bisnis lengkap.',
    keyLine: 'Dari pemindaian hingga laporan, dalam izin dan tanpa dampak nyata.',
    primaryCta: 'Lihat paket proof',
    secondaryCta: 'Jelajahi alur 15 produk',
  },
  ar: {
    badge: 'حزمة Proof',
    title: 'Taze حزمة Proof',
    subtitle: '15 منتجًا، مسار عمل كامل واحد.',
    keyLine: 'من المسح إلى التقرير، ضمن الأذونات وبدون تأثير حقيقي.',
    primaryCta: 'عرض حزمة proof',
    secondaryCta: 'استكشاف مسار 15 منتجًا',
  },
};

export const DEMO_CONTENT = {
  seo: {
    ...DEMO_SEO_BY_LANGUAGE.nl,
  },
  hero: {
    ...DEMO_HERO_BY_LANGUAGE.nl,
  },
  visual: {
    title: '15 proof-producten die de volledige keten laten zien',
    caption: 'Eén begrensd proof-pakket met 15 producten en dezelfde duidelijke flow voor elk bedrijf.',
    alt: 'Proof-pakket met 15 producten over scan, transport, invoice, rollen, bewijs, rapport en AI/RIA advies.',
    flow: [
      'Scanwaarde',
      'Transportwaarde',
      'Invoicewaarde',
      'Rollenwaarde',
      'Bewijswaarde',
      'Rapportwaarde',
      'AI/RIA advieswaarde',
    ],
  },
  products: [
    'Frisdrank krat',
    'Bierbak',
    'Fles wijn',
    'Koffiebonen',
    'Zuivelproduct',
    'Koelproduct',
    'Groenten',
    'Droge voeding',
    'Schoonmaakmiddel',
    'Verbruiksartikel',
    'Breekbaar glaswerk',
    'Promo-artikel',
    'Retourartikel',
    'Product met vervaldatum',
    'Product met schadegevoeligheid',
  ] as const,
  stepper: {
    title: '15 producten in 7 stappen',
    subtitle: 'Ontdek hoe het proof-pakket scan, transport, facturatievoorbereiding, rollen, bewijs, rapport en AI/RIA samen laat werken.',
    previousCta: 'Vorige stap',
    primaryCta: 'Volgende stap',
    resetCta: 'Opnieuw',
    steps: [
      {
        stepLabel: 'Stap 1 van 7',
        title: 'Scanwaarde',
        subtitle: 'Productherkenning, barcode of camera als voorstel.',
        keyLine: 'Scan laat direct zien wat er binnenkomt.',
        details: ['Productherkenning als voorstel', 'Schade, verval en verbruik signaleren', 'Interne locatie: bar, keuken of stock'],
      },
      {
        stepLabel: 'Stap 2 van 7',
        title: 'Transportwaarde',
        subtitle: 'Levering, chauffeur en route zichtbaar binnen dezelfde lijn.',
        keyLine: 'Transport toont onderweg en aankomst zonder echte impact.',
        details: ['Klaar voor vertrek', 'Chauffeur en statusmelding', 'Aankomst en rapport naar bedrijf'],
      },
      {
        stepLabel: 'Stap 3 van 7',
        title: 'Invoicewaarde',
        subtitle: 'Facturatievoorbereiding blijft herkenbaar maar nog begrensd.',
        keyLine: 'Factuurconcept, controle en voorbereiding komen netjes samen.',
        details: ['Factuurconcept', 'Bevoegde controle', 'Factuurnummer, betaalstatus en mailstatus'],
      },
      {
        stepLabel: 'Stap 4 van 7',
        title: 'Rollenwaarde',
        subtitle: 'Werkvloer, chauffeur, manager en owner krijgen duidelijke bevoegdheid.',
        keyLine: 'Iedere rol ziet alleen wat binnen zijn bevoegdheid past.',
        details: ['Werkvloer krijgt scanadvies', 'Chauffeur krijgt transportadvies', 'Manager en owner krijgen bedrijfsadvies'],
      },
      {
        stepLabel: 'Stap 5 van 7',
        title: 'Bewijswaarde',
        subtitle: 'Wie deed wat, wanneer en in welke lijn wordt zichtbaar vastgelegd.',
        keyLine: 'Bewijs maakt elke stap controleerbaar.',
        details: ['Wie deed wat', 'Wanneer en in welke lijn', 'Welke status en welk risico'],
      },
      {
        stepLabel: 'Stap 6 van 7',
        title: 'Rapportwaarde',
        subtitle: 'Rapportage bundelt de lijn, status en volgende stap.',
        keyLine: 'Rapport laat bevoegde mensen snel opvolgen.',
        details: ['Status per lijn', 'Volgende stap voor bevoegde rol', 'Risico en context samengevat'],
      },
      {
        stepLabel: 'Stap 7 van 7',
        title: 'AI/RIA advieswaarde',
        subtitle: 'AI/RIA adviseert alleen binnen bevoegdheid en voert niets uit.',
        keyLine: 'Read-only advies, menselijke bevestiging en geen automatische acties.',
        details: ['Advies binnen bevoegdheid', 'Waarschuwing en signalering', 'Geen datawijzigingen of uitvoering'],
      },
    ] as const satisfies readonly ProofStep[],
  },
  packageChoice: {
    title: 'Na het proof-pakket kies je het juiste Taze-pakket.',
    subtitle: 'Startpakket, Groeipakket en Bedrijfspakket tonen de volgende stap zonder echte checkout.',
    ctaLine: 'Kies later je Taze-pakket',
    primaryCta: 'Vraag bedrijfsactivatie aan',
    packages: [
      {
        title: 'Startpakket',
        subtitle: 'Voor teams die eerst willen verkennen.',
        detail: 'Begrensde proof-ervaring met scan, transport, invoice, rollen, bewijs, rapport en AI/RIA advies.',
      },
      {
        title: 'Groeipakket',
        subtitle: 'Voor teams die live willen opschalen.',
        detail: 'Meer vestigingen, meer controle en een duidelijk pad van proof naar echte activatie.',
      },
      {
        title: 'Bedrijfspakket',
        subtitle: 'Voor organisaties met meerdere lijnen.',
        detail: 'Volledige bedrijfsstructuur met rolbevoegdheden, rapportage en verdere uitrol.',
      },
    ] as const satisfies readonly ProofPackageCard[],
  },
  footer: {
    proof: 'Van scan tot rapport, binnen bevoegdheid en zonder echte data.',
    safety: 'Geen echte data. Geen echte impact. Klaar om pakket te kiezen.',
  },
} as const;

export function getDemoContent(language: AppLanguage = 'nl') {
  return {
    ...DEMO_CONTENT,
    seo: DEMO_SEO_BY_LANGUAGE[language] ?? DEMO_SEO_BY_LANGUAGE.nl,
    hero: DEMO_HERO_BY_LANGUAGE[language] ?? DEMO_HERO_BY_LANGUAGE.nl,
  };
}

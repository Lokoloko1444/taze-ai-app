import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BarcodeType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { RealAiCopilotPanel } from 'components/real-ai-copilot-panel';
import { TazeLogo } from 'components/taze-logo';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';
import { Brand } from 'constants/theme';
import {
    addLiveAlertEvent,
    addDispatchPhotoProof,
    addOrMergeInventoryItem,
    closeDispatchDossier,
    confirmDispatchDeparture,
    confirmDispatchCustomerReceipt,
    confirmDispatchDriver,
    confirmDispatchManager,
    confirmDispatchWorkfloor,
    offbookDispatchGoods,
    prepareDispatchInvoice,
    persistInventoryStateToCloudNow,
    consumeStock,
    recordWaste,
    releaseDispatchInvoice,
    formatExpiryDateLabel,
    formatExpiryStatusLabel,
    getInventoryUnitLabel,
    getLowStockAlertsByLocation,
    getLocationBreakdown,
    getMovementValueBreakdown,
    registerBatchReceiptPurchases,
    registerInventoryIntakeFollowUps,
    transferStock,
    updateInventoryItemCorrection,
    useInventory,
    type ExpiryStatus,
    type DispatchRecord,
    type InventoryItem,
} from 'hooks/use-inventory';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { markAiAuditInteraction, markAiAuditOutcome } from 'lib/ai-audit';
import { useAuth } from 'lib/auth-context';
import { setBarcodeOverride } from 'lib/barcode-overrides';
import { type Product } from 'lib/products';
import { requestRealAi, type RealAiAvailableAction, type RealAiResponse } from 'lib/real-ai';
import { ocrReceipt } from 'lib/receipt-ocr';
import { classifyReceiptLineCost, parseReceiptText, type ReceiptCostBucket } from 'lib/receipt-parser';
import { recognizeProduct, type RecognitionResult } from 'lib/recognition';
import { FREE_SCAN_LIMIT, getScanAccessSummary, loadScanAccessState, recordScanAccessUsage, type ScanAccessState } from 'lib/scan-access';
import { loadSoundSettings, playEvent } from 'lib/notification-sounds';
import { appendTemperatureLog } from 'lib/temperature-log';
import { appendTraceEvent } from 'lib/trace-event-log';
import { buildTransportAiContext, buildTransportHubPath } from 'lib/transport-ai';
import { t, type AppLanguage, type TranslationKey } from 'lib/i18n';

type ScanResult = {
  type: string;
  data: string;
} | null;

type CapturedPhoto = {
  uri: string;
  base64: string | null;
} | null;

type ScanMode = 'Product' | 'Kassaticket';
type ScanDestination = 'bar' | 'frigo' | 'keuken' | 'koelcel' | 'diepvries' | 'stock' | 'transport';
type ColdScanLocation = 'Frigo' | 'Diepvries';

type UiLanguage = AppLanguage;

const UI_LANGUAGE_OPTIONS: { code: UiLanguage; label: string }[] = [
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'bg', label: 'BG' },
  { code: 'hi', label: 'HI' },
  { code: 'ja', label: 'JA' },
  { code: 'pl', label: 'PL' },
  { code: 'id', label: 'ID' },
  { code: 'ar', label: 'AR' },
];

function formatDetailTranslation(
  template: string,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
}

const OPERATIONAL_LABEL_TRANSLATIONS: Record<UiLanguage, Record<string, string>> = {
  nl: {},
  en: {
    'Uit Stock gehaald': 'Removed from Stock',
    'Klaar voor vertrek': 'Ready for departure',
    'Foto bewijs toegevoegd': 'Photo proof added',
    'Chauffeur bevestigd': 'Driver confirmed',
    'Manager bevestigd': 'Manager confirmed',
    'Vertrek bevestigd': 'Departure confirmed',
    'Klant ontvangt goederen': 'Customer receives goods',
    'Klant bevestigt ontvangst': 'Customer confirms receipt',
    'Klant bevestigt goederen ontvangen': 'Customer confirms goods received',
    'Facturatie vrijgegeven': 'Invoice released',
    'Factuur klaarzetten': 'Prepare invoice',
    'Goederen afboeken': 'Write off goods',
    'Dossier compleet': 'Dossier complete',
    'Product vervalt vandaag': 'Product expires today',
    'Vervalt vandaag': 'Expires today',
    'Bijna vervallen': 'Near expiry',
    'Eerst gebruiken in Keuken': 'Use first in Kitchen',
    'Naar Bar': 'To Bar',
    'Naar Keuken': 'To Kitchen',
    'Naar Koelcel': 'To Cold Room',
    Afval: 'Waste',
    'Wacht op vertrek': 'Waiting for departure',
    'Facturatie in wacht': 'Invoice pending',
    Open: 'Open',
    Onbekend: 'Unknown',
  },
  fr: {
    'Uit Stock gehaald': 'Sorti du stock',
    'Klaar voor vertrek': 'Prêt au départ',
    'Foto bewijs toegevoegd': 'Preuve photo ajoutée',
    'Chauffeur bevestigd': 'Chauffeur confirmé',
    'Manager bevestigd': 'Responsable confirmé',
    'Vertrek bevestigd': 'Départ confirmé',
    'Klant ontvangt goederen': 'Le client reçoit les marchandises',
    'Klant bevestigt ontvangst': 'Le client confirme la réception',
    'Klant bevestigt goederen ontvangen': 'Le client confirme la réception des marchandises',
    'Facturatie vrijgegeven': 'Facturation libérée',
    'Factuur klaarzetten': 'Préparer la facture',
    'Goederen afboeken': 'Passer les marchandises en sortie',
    'Dossier compleet': 'Dossier complet',
    'Product vervalt vandaag': "Le produit expire aujourd'hui",
    'Vervalt vandaag': "Expire aujourd'hui",
    'Bijna vervallen': 'Presque expiré',
    'Eerst gebruiken in Keuken': "À utiliser d'abord en cuisine",
    'Naar Bar': 'Vers le bar',
    'Naar Keuken': 'Vers la cuisine',
    'Naar Koelcel': 'Vers la chambre froide',
    Afval: 'Déchets',
    'Wacht op vertrek': 'En attente du départ',
    'Facturatie in wacht': 'Facturation en attente',
    Open: 'Ouvert',
    Onbekend: 'Inconnu',
  },
  de: {
    'Uit Stock gehaald': 'Aus dem Lager entnommen',
    'Klaar voor vertrek': 'Abfahrtsbereit',
    'Foto bewijs toegevoegd': 'Fotobeweis hinzugefügt',
    'Chauffeur bevestigd': 'Fahrer bestätigt',
    'Manager bevestigd': 'Manager bestätigt',
    'Vertrek bevestigd': 'Abfahrt bestätigt',
    'Klant ontvangt goederen': 'Kunde erhält Waren',
    'Klant bevestigt ontvangst': 'Kunde bestätigt den Empfang',
    'Klant bevestigt goederen ontvangen': 'Kunde bestätigt den Warenerhalt',
    'Facturatie vrijgegeven': 'Abrechnung freigegeben',
    'Factuur klaarzetten': 'Rechnung vorbereiten',
    'Goederen afboeken': 'Ware ausbuchen',
    'Dossier compleet': 'Akte vollständig',
    'Product vervalt vandaag': 'Produkt läuft heute ab',
    'Vervalt vandaag': 'Läuft heute ab',
    'Bijna vervallen': 'Bald ablaufend',
    'Eerst gebruiken in Keuken': 'Zuerst in der Küche verwenden',
    'Naar Bar': 'Zur Bar',
    'Naar Keuken': 'Zur Küche',
    'Naar Koelcel': 'Zum Kühlraum',
    Afval: 'Abfall',
    'Wacht op vertrek': 'Wartet auf Abfahrt',
    'Facturatie in wacht': 'Abrechnung in Wartestellung',
    Open: 'Offen',
    Onbekend: 'Unbekannt',
  },
  es: {
    'Uit Stock gehaald': 'Sacado del stock',
    'Klaar voor vertrek': 'Listo para salida',
    'Foto bewijs toegevoegd': 'Prueba fotográfica añadida',
    'Chauffeur bevestigd': 'Conductor confirmado',
    'Manager bevestigd': 'Gerente confirmado',
    'Vertrek bevestigd': 'Salida confirmada',
    'Klant ontvangt goederen': 'El cliente recibe la mercancía',
    'Klant bevestigt ontvangst': 'El cliente confirma la recepción',
    'Klant bevestigt goederen ontvangen': 'El cliente confirma la recepción de la mercancía',
    'Facturatie vrijgegeven': 'Facturación liberada',
    'Factuur klaarzetten': 'Preparar factura',
    'Goederen afboeken': 'Dar de baja la mercancía',
    'Dossier compleet': 'Expediente completo',
    'Product vervalt vandaag': 'El producto caduca hoy',
    'Vervalt vandaag': 'Caduca hoy',
    'Bijna vervallen': 'Próximo a caducar',
    'Eerst gebruiken in Keuken': 'Usar primero en cocina',
    'Naar Bar': 'Al bar',
    'Naar Keuken': 'A cocina',
    'Naar Koelcel': 'A cámara fría',
    Afval: 'Residuos',
    'Wacht op vertrek': 'A la espera de salida',
    'Facturatie in wacht': 'Facturación pendiente',
    Open: 'Abierto',
    Onbekend: 'Desconocido',
  },
  bg: {
    'Uit Stock gehaald': 'Премахнато от запасите',
    'Klaar voor vertrek': 'Готово за тръгване',
    'Foto bewijs toegevoegd': 'Добавено фото доказателство',
    'Chauffeur bevestigd': 'Шофьор потвърден',
    'Manager bevestigd': 'Мениджър потвърден',
    'Vertrek bevestigd': 'Тръгването е потвърдено',
    'Klant ontvangt goederen': 'Клиентът получава стоката',
    'Klant bevestigt ontvangst': 'Клиентът потвърждава получаването',
    'Klant bevestigt goederen ontvangen': 'Клиентът потвърждава получаването на стоката',
    'Facturatie vrijgegeven': 'Фактурирането е освободено',
    'Factuur klaarzetten': 'Подгответе фактура',
    'Goederen afboeken': 'Отписване на стоките',
    'Dossier compleet': 'Дело завършено',
    'Product vervalt vandaag': 'Продуктът изтича днес',
    'Vervalt vandaag': 'Изтича днес',
    'Bijna vervallen': 'Почти изтекъл',
    'Eerst gebruiken in Keuken': 'Първо използвайте в кухнята',
    'Naar Bar': 'Към бара',
    'Naar Keuken': 'Към кухнята',
    'Naar Koelcel': 'Към хладилната стая',
    Afval: 'Отпадъци',
    'Wacht op vertrek': 'Чака се тръгване',
    'Facturatie in wacht': 'Фактуриране в изчакване',
    Open: 'Отворен',
    Onbekend: 'Непознат',
  },
  hi: {
    'Uit Stock gehaald': 'स्टॉक से हटाया गया',
    'Klaar voor vertrek': 'रवाना होने के लिए तैयार',
    'Foto bewijs toegevoegd': 'फोटो प्रमाण जोड़ा गया',
    'Chauffeur bevestigd': 'चालक की पुष्टि हुई',
    'Manager bevestigd': 'मैनेजर की पुष्टि हुई',
    'Vertrek bevestigd': 'प्रस्थान की पुष्टि हुई',
    'Klant ontvangt goederen': 'ग्राहक को सामान प्राप्त हुआ',
    'Klant bevestigt ontvangst': 'ग्राहक ने प्राप्ति की पुष्टि की',
    'Klant bevestigt goederen ontvangen': 'ग्राहक ने सामान प्राप्त होने की पुष्टि की',
    'Facturatie vrijgegeven': 'इनवॉइस जारी किया गया',
    'Factuur klaarzetten': 'इनवॉइस तैयार करें',
    'Goederen afboeken': 'सामान को लिखें',
    'Dossier compleet': 'फ़ाइल पूरी है',
    'Product vervalt vandaag': 'उत्पाद आज समाप्त होता है',
    'Vervalt vandaag': 'आज समाप्त होता है',
    'Bijna vervallen': 'लगभग समाप्त',
    'Eerst gebruiken in Keuken': 'पहले रसोई में उपयोग करें',
    'Naar Bar': 'बार में',
    'Naar Keuken': 'रसोई में',
    'Naar Koelcel': 'ठंडी कक्ष में',
    Afval: 'कचरा',
    'Wacht op vertrek': 'रवाना होने की प्रतीक्षा',
    'Facturatie in wacht': 'इनवॉइसिंग लंबित',
    Open: 'खुला',
    Onbekend: 'अज्ञात',
  },
  ja: {
    'Uit Stock gehaald': '在庫から取り出されました',
    'Klaar voor vertrek': '出発準備完了',
    'Foto bewijs toegevoegd': '写真証拠が追加されました',
    'Chauffeur bevestigd': 'ドライバーが確認しました',
    'Manager bevestigd': 'マネージャーが確認しました',
    'Vertrek bevestigd': '出発が確認されました',
    'Klant ontvangt goederen': '顧客が商品を受け取ります',
    'Klant bevestigt ontvangst': '顧客が受領を確認しました',
    'Klant bevestigt goederen ontvangen': '顧客が商品の受領を確認しました',
    'Facturatie vrijgegeven': '請求がリリースされました',
    'Factuur klaarzetten': '請求書を準備する',
    'Goederen afboeken': '商品の消し込み',
    'Dossier compleet': 'ファイル完了',
    'Product vervalt vandaag': '製品は今日期限切れです',
    'Vervalt vandaag': '今日期限切れ',
    'Bijna vervallen': 'まもなく期限切れ',
    'Eerst gebruiken in Keuken': 'まずキッチンで使用してください',
    'Naar Bar': 'バーへ',
    'Naar Keuken': 'キッチンへ',
    'Naar Koelcel': '冷蔵庫へ',
    Afval: '廃棄物',
    'Wacht op vertrek': '出発を待っています',
    'Facturatie in wacht': '請求保留中',
    Open: 'オープン',
    Onbekend: '不明',
  },
  pl: {
    'Uit Stock gehaald': 'Usunięto ze stanu',
    'Klaar voor vertrek': 'Gotowy do wyjazdu',
    'Foto bewijs toegevoegd': 'Dodano dowód fotograficzny',
    'Chauffeur bevestigd': 'Kierowca potwierdzony',
    'Manager bevestigd': 'Menedżer potwierdzony',
    'Vertrek bevestigd': 'Wyjazd potwierdzony',
    'Klant ontvangt goederen': 'Klient otrzymuje towary',
    'Klant bevestigt ontvangst': 'Klient potwierdza odbiór',
    'Klant bevestigt goederen ontvangen': 'Klient potwierdza otrzymanie towaru',
    'Facturatie vrijgegeven': 'Fakturowanie zwolnione',
    'Factuur klaarzetten': 'Przygotuj fakturę',
    'Goederen afboeken': 'Wykreśl towary',
    'Dossier compleet': 'Akta kompletne',
    'Product vervalt vandaag': 'Produkt traci ważność dzisiaj',
    'Vervalt vandaag': 'Traci ważność dzisiaj',
    'Bijna vervallen': 'Wkrótce wygasa',
    'Eerst gebruiken in Keuken': 'Najpierw użyj w kuchni',
    'Naar Bar': 'Do baru',
    'Naar Keuken': 'Do kuchni',
    'Naar Koelcel': 'Do chłodni',
    Afval: 'Odpady',
    'Wacht op vertrek': 'Oczekiwanie na wyjazd',
    'Facturatie in wacht': 'Fakturowanie w toku',
    Open: 'Otwarty',
    Onbekend: 'Nieznany',
  },
  id: {
    'Uit Stock gehaald': 'Dikeluarkan dari stok',
    'Klaar voor vertrek': 'Siap berangkat',
    'Foto bewijs toegevoegd': 'Bukti foto ditambahkan',
    'Chauffeur bevestigd': 'Supir dikonfirmasi',
    'Manager bevestigd': 'Manajer dikonfirmasi',
    'Vertrek bevestigd': 'Keberangkatan dikonfirmasi',
    'Klant ontvangt goederen': 'Pelanggan menerima barang',
    'Klant bevestigt ontvangst': 'Pelanggan mengonfirmasi penerimaan',
    'Klant bevestigt goederen ontvangen': 'Pelanggan mengonfirmasi penerimaan barang',
    'Facturatie vrijgegeven': 'Penagihan dibebaskan',
    'Factuur klaarzetten': 'Siapkan faktur',
    'Goederen afboeken': 'Hapus barang',
    'Dossier compleet': 'Berkas lengkap',
    'Product vervalt vandaag': 'Produk kedaluwarsa hari ini',
    'Vervalt vandaag': 'Kedaluwarsa hari ini',
    'Bijna vervallen': 'Hampir kadaluwarsa',
    'Eerst gebruiken in Keuken': 'Gunakan terlebih dahulu di dapur',
    'Naar Bar': 'Ke bar',
    'Naar Keuken': 'Ke dapur',
    'Naar Koelcel': 'Ke ruang dingin',
    Afval: 'Sampah',
    'Wacht op vertrek': 'Menunggu keberangkatan',
    'Facturatie in wacht': 'Penagihan tertunda',
    Open: 'Terbuka',
    Onbekend: 'Tidak diketahui',
  },
  ar: {
    'Uit Stock gehaald': 'تمت إزالته من المخزون',
    'Klaar voor vertrek': 'جاهز للمغادرة',
    'Foto bewijs toegevoegd': 'تمت إضافة دليل صورة',
    'Chauffeur bevestigd': 'تم تأكيد السائق',
    'Manager bevestigd': 'تم تأكيد المدير',
    'Vertrek bevestigd': 'تم تأكيد المغادرة',
    'Klant ontvangt goederen': 'يتلقى العميل البضائع',
    'Klant bevestigt ontvangst': 'يؤكد العميل الاستلام',
    'Klant bevestigt goederen ontvangen': 'يؤكد العميل استلام البضائع',
    'Facturatie vrijgegeven': 'تم تحرير الفاتورة',
    'Factuur klaarzetten': 'إعداد الفاتورة',
    'Goederen afboeken': 'شطب البضائع',
    'Dossier compleet': 'الملف مكتمل',
    'Product vervalt vandaag': 'تنتهي صلاحية المنتج اليوم',
    'Vervalt vandaag': 'تنتهي صلاحية اليوم',
    'Bijna vervallen': 'على وشك الانتهاء',
    'Eerst gebruiken in Keuken': 'استخدمه أولاً في المطبخ',
    'Naar Bar': 'إلى البار',
    'Naar Keuken': 'إلى المطبخ',
    'Naar Koelcel': 'إلى غرفة التبريد',
    Afval: 'نفايات',
    'Wacht op vertrek': 'في انتظار المغادرة',
    'Facturatie in wacht': 'إصدار الفاتورة قيد الانتظار',
    Open: 'مفتوح',
    Onbekend: 'غير معروف',
  },
};

const SCAN_ACTION_COPY: Record<
  UiLanguage,
  {
    stockTitle: string;
    purchaseTitle: string;
    stockBody: string;
    purchaseBody: string;
    preferredLocation: string;
  }
> = {
  nl: {
    stockTitle: 'Live voorraadactie',
    purchaseTitle: 'Inkoopkoppeling',
    stockBody: 'Controleer het scanresultaat, kies een bestemming en sla pas daarna live op.',
    purchaseBody: 'Registreer deze ticketscan als inkoop / stock intake. De gekozen locatie wordt bijgewerkt en kosten worden gesplitst.',
    preferredLocation: 'Voorkeurslocatie',
  },
  en: {
    stockTitle: 'Live stock action',
    purchaseTitle: 'Purchase intake',
    stockBody: 'Check the scan result, choose a destination, then save it live.',
    purchaseBody: 'Register this receipt scan as purchase / stock intake. The selected location is updated and costs are split.',
    preferredLocation: 'Preferred location',
  },
  fr: {
    stockTitle: 'Action stock en direct',
    purchaseTitle: 'Reception achat',
    stockBody: 'Controlez le resultat du scan, choisissez une destination, puis enregistrez en direct.',
    purchaseBody: "Enregistrez ce ticket comme achat / entree stock. Le lieu choisi est mis a jour et les couts sont repartis.",
    preferredLocation: 'Lieu conseille',
  },
  de: {
    stockTitle: 'Live-Bestandsaktion',
    purchaseTitle: 'Wareneingang',
    stockBody: 'Pruefen Sie das Scanergebnis, waehlen Sie ein Ziel und speichern Sie danach live.',
    purchaseBody: 'Diesen Belegscan als Einkauf / Bestandseingang erfassen. Der gewaehlte Ort wird aktualisiert und Kosten werden aufgeteilt.',
    preferredLocation: 'Bevorzugter Ort',
  },
  es: {
    stockTitle: 'Accion de stock en vivo',
    purchaseTitle: 'Entrada de compra',
    stockBody: 'Comprueba el resultado del escaneo, elige un destino y luego guarda en vivo.',
    purchaseBody: 'Registra este ticket como compra / entrada de stock. La ubicacion elegida se actualiza y los costes se dividen.',
    preferredLocation: 'Ubicacion preferida',
  },
  bg: {
    stockTitle: 'Жива операция със запасите',
    purchaseTitle: 'Вход за покупка',
    stockBody: 'Проверете резултата от сканирането, изберете дестинация и след това запазете на живо.',
    purchaseBody: 'Регистрирайте това сканиране като покупка / прием на запас. Избраната локация се актуализира и разходите се разделят.',
    preferredLocation: 'Предпочитано местоположение',
  },
  hi: {
    stockTitle: 'लाइव स्टॉक कार्रवाई',
    purchaseTitle: 'खरीद इन्टेक',
    stockBody: 'स्कैन परिणाम की जांच करें, गंतव्य चुनें, फिर इसे लाइव सहेजें।',
    purchaseBody: 'इस रसीद स्कैन को खरीद / स्टॉक इन्टेक के रूप में रजिस्टर करें। चुनी गई जगह अपडेट होती है और लागतें विभाजित हो जाती हैं।',
    preferredLocation: 'प्रिय स्थान',
  },
  ja: {
    stockTitle: 'ライブ在庫アクション',
    purchaseTitle: '購入受付',
    stockBody: 'スキャン結果を確認し、行き先を選択してからライブで保存します。',
    purchaseBody: 'このレシートスキャンを購入 / 在庫受け入れとして登録します。選択した場所が更新され、コストが分割されます。',
    preferredLocation: '希望の場所',
  },
  pl: {
    stockTitle: 'Akcja zapasowa na żywo',
    purchaseTitle: 'Przyjęcie zakupu',
    stockBody: 'Sprawdź wynik skanowania, wybierz miejsce docelowe, a następnie zapisz na żywo.',
    purchaseBody: 'Zarejestruj to skanowanie paragonu jako zakup / przyjęcie zapasów. Wybrane miejsce jest aktualizowane, a koszty są dzielone.',
    preferredLocation: 'Preferowana lokalizacja',
  },
  id: {
    stockTitle: 'Aksi stok langsung',
    purchaseTitle: 'Penerimaan pembelian',
    stockBody: 'Periksa hasil pemindaian, pilih tujuan, lalu simpan secara langsung.',
    purchaseBody: 'Daftarkan pemindaian tiket ini sebagai pembelian / penerimaan stok. Lokasi yang dipilih diperbarui dan biaya dibagi.',
    preferredLocation: 'Lokasi pilihan',
  },
  ar: {
    stockTitle: 'إجراء المخزون المباشر',
    purchaseTitle: 'استلام الشراء',
    stockBody: 'تحقق من نتيجة المسح، اختر وجهة، ثم احفظها مباشرةً.',
    purchaseBody: 'سجل هذا المسح كشراء / إدخال مخزون. يتم تحديث الموقع المحدد ويتم تقسيم التكاليف.',
    preferredLocation: 'الموقع المفضل',
  },
};

function translateOperationalLabel(label: string, language: UiLanguage) {
  if (language === 'nl') {
    return label;
  }

  return OPERATIONAL_LABEL_TRANSLATIONS[language][label] ?? label;
}

function formatScanMoment(value: string | null) {
  if (!value) {
    return 'Nog geen scan';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Onbekend';
  }

  return new Intl.DateTimeFormat('nl-BE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

type TicketLine = {
  id: string;
  itemId: string | null;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  location: string;
  bucket: string;
  costBucket: ReceiptCostBucket;
  sourceLabel: string;
  barcode?: string | null;
};

type ScanMutationSummary = {
  actionLabel?: string;
  productName: string;
  category?: string;
  barcode?: string | null;
  userLabel?: string;
  fromLabel: string;
  toLabel: string;
  fromLocation?: string;
  toLocation?: string;
  quantity: number;
  confirmationLabel: string;
  resultDeltas: { label: string; amount: number }[];
  recordedAt: string;
  expiryDate?: string | null;
  expiryStatus?: ExpiryStatus;
  recommendedAction?: string;
  recommendedReason?: string;
};

type ScanStockAction =
  | 'arrived'
  | 'move'
  | 'consume'
  | 'delivered'
  | 'to_transport'
  | 'waste'
  | 'damaged'
  | 'correction'
  | 'reorder_needed';

type ScanMovementType = 'intake' | 'consumption' | 'waste' | 'correction' | 'transport';

type LiveScanEngineState = {
  productName: string;
  barcode: string | null;
  source: 'barcode' | 'photo' | 'manual' | 'empty';
  recognitionResult: RecognitionResult | null;
  selectedLocation: string | null;
  selectedMovement: ScanMovementType | null;
  quantity: number;
  expiryDate: string | null;
  pendingProposal: {
    productName: string;
    location: string;
    movement: ScanMovementType;
    reason: string;
    confidence: number | null;
  } | null;
  stockStatus: {
    location: string | null;
    matchingItems: number;
    locationProducts: number;
    locationUnits: number;
    locationValue: number;
    lowStockCount: number;
    expiringSoon: number;
  };
  riaAdvice: string;
  confirmReady: boolean;
  lastMutationResult: ScanMutationSummary | null;
  traceResult: {
    itemName: string;
    location: string;
    movement: string;
    recordedAt: string;
  } | null;
};

type ScanPipelineDebugState = {
  recognitionStatus: 'idle' | 'requested' | 'succeeded' | 'failed';
  recognitionError: string;
  aiStatus: 'idle' | 'requested' | 'succeeded' | 'failed';
  aiError: string;
};

function formatDispatchStatusLabel(status: DispatchRecord['status'], language: UiLanguage) {
  let label = 'Uit Stock gehaald';

  switch (status) {
    case 'picked_from_stock':
      label = 'Uit Stock gehaald';
      break;
    case 'ready_for_departure':
      label = 'Klaar voor vertrek';
      break;
    case 'photo_proof_added':
      label = 'Foto bewijs toegevoegd';
      break;
    case 'driver_confirmed':
      label = 'Chauffeur bevestigd';
      break;
    case 'manager_confirmed':
      label = 'Manager bevestigd';
      break;
    case 'departure_confirmed':
      label = 'Vertrek bevestigd';
      break;
    case 'customer_receiving':
      label = 'Klant ontvangt goederen';
      break;
    case 'customer_confirmed':
      label = 'Klant bevestigt goederen ontvangen';
      break;
    case 'invoice_released':
      label = 'Facturatie vrijgegeven';
      break;
    case 'invoice_ready':
      label = 'Factuur klaarzetten';
      break;
    case 'goods_closed':
      label = 'Goederen afboeken';
      break;
    case 'dossier_complete':
      label = 'Dossier compleet';
      break;
  }

  return translateOperationalLabel(label, language);
}

function formatDispatchReceiptStatusLabel(status: DispatchRecord['customerReceiptStatus'], language: UiLanguage) {
  let label = 'Wacht op vertrek';

  switch (status) {
    case 'awaiting_customer':
      label = 'Klant ontvangt goederen';
      break;
    case 'received':
      label = 'Klant bevestigt goederen ontvangen';
      break;
  }

  return translateOperationalLabel(label, language);
}

function formatDispatchInvoiceStatusLabel(status: DispatchRecord['invoiceStatus'], language: UiLanguage) {
  let label = 'Facturatie in wacht';

  switch (status) {
    case 'released':
      label = 'Facturatie vrijgegeven';
      break;
    case 'ready':
      label = 'Factuur klaarzetten';
      break;
  }

  return translateOperationalLabel(label, language);
}

function formatDispatchFinalAuditStatusLabel(status: DispatchRecord['finalAuditStatus'], language: UiLanguage) {
  return translateOperationalLabel(status === 'complete' ? 'Dossier compleet' : 'Open', language);
}

function formatTranslatedExpiryStatusLabel(status: ExpiryStatus, language: UiLanguage) {
  return translateOperationalLabel(formatExpiryStatusLabel(status), language);
}

const NATIVE_BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'ean13',
  'ean8',
  'code128',
  'code39',
  'upc_e',
  'upc_a',
  'pdf417',
  'aztec',
  'datamatrix',
];

const LIVE_STOCK_LOCATIONS = ['Bar', 'Frigo', 'Keuken', 'Koelcel', 'Diepvries', 'Stock', 'Transport', 'Afval'] as const;
const PRODUCT_SCAN_DESTINATIONS: { value: ScanDestination; location: string; label: string }[] = [
  { value: 'bar', location: 'Bar', label: 'Bar' },
  { value: 'frigo', location: 'Frigo', label: 'Frigo' },
  { value: 'keuken', location: 'Keuken', label: 'Keuken' },
  { value: 'koelcel', location: 'Koelcel', label: 'Koelcel' },
  { value: 'diepvries', location: 'Diepvries', label: 'Diepvries' },
  { value: 'stock', location: 'Stock', label: 'Magazijn / Stock' },
  { value: 'transport', location: 'Transport', label: 'Transport / Vervoer' },
];
const SCAN_DESTINATION_PROMPT =
  'Kies eerst een bestemming: Bar, Frigo, Keuken, Koelcel, Diepvries, Stock of Transport / Vervoer';
const DEFAULT_SCAN_LOCATION = 'Bar';
const DEFAULT_COLD_LOCATION_TEMPERATURES: Record<ColdScanLocation, number> = {
  Frigo: 4,
  Diepvries: -18,
};
const COLD_LOCATION_TEMPERATURE_LIMITS: Record<ColdScanLocation, { min: number; max: number }> = {
  Frigo: { min: -2, max: 10 },
  Diepvries: { min: -30, max: -10 },
};
const SCAN_STOCK_ACTIONS: { value: ScanStockAction; label: string }[] = [
  { value: 'arrived', label: 'Toegekomen' },
  { value: 'move', label: 'Verplaatst' },
  { value: 'consume', label: 'Verbruikt' },
  { value: 'delivered', label: 'Afgeleverd' },
  { value: 'to_transport', label: 'Naar transport' },
  { value: 'waste', label: 'Naar afval' },
  { value: 'damaged', label: 'Beschadigd' },
  { value: 'correction', label: 'Correctie' },
  { value: 'reorder_needed', label: 'Bijbestellen nodig' },
];
const SCAN_MOVEMENT_TYPES: { value: ScanMovementType; label: string }[] = [
  { value: 'intake', label: 'Inkoop / Toegevoegd' },
  { value: 'consumption', label: 'Verbruik' },
  { value: 'waste', label: 'Afval' },
  { value: 'correction', label: 'Correctie' },
];
const CHAUFFEUR_SCAN_MOVEMENT_TYPES: { value: ScanMovementType; label: string }[] = [
  { value: 'transport', label: 'Transport / Vervoer' },
];
const ALL_SCAN_MOVEMENT_TYPES: { value: ScanMovementType; label: string }[] = [
  ...SCAN_MOVEMENT_TYPES,
  ...CHAUFFEUR_SCAN_MOVEMENT_TYPES,
];

function normalizeBarcodeValue(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, '');
}

function formatScanLocationLabel(location: string) {
  if (location === 'Transport') return 'Transport / Vervoer';
  if (location === 'Stock') return 'Magazijn / Stock';
  return location;
}

function normalizeLiveStockLocation(location: string) {
  return (LIVE_STOCK_LOCATIONS as readonly string[]).includes(location) ? location : 'Stock';
}

function getScanDestinationValue(location: string): ScanDestination | null {
  return PRODUCT_SCAN_DESTINATIONS.find((destination) => destination.location === location)?.value ?? null;
}

function isColdScanLocation(location: string): location is ColdScanLocation {
  return location === 'Frigo' || location === 'Diepvries';
}

function clampColdLocationTemperature(location: ColdScanLocation, value: number) {
  const limits = COLD_LOCATION_TEMPERATURE_LIMITS[location];
  return Math.min(limits.max, Math.max(limits.min, value));
}

function formatColdLocationTemperatureLabel(location: string, temperatures: Record<ColdScanLocation, number>) {
  return isColdScanLocation(location) ? `${temperatures[location]}°C` : null;
}

function includesAnyTerm(text: string, terms: readonly string[]) {
  return terms.some((term) => text.includes(term));
}

const FRIGO_BAR_DRINK_TERMS = [
  'beer',
  'bier',
  'cola',
  'water',
  'wine',
  'wijn',
  'cava',
  'soft drink',
  'softdrink',
  'soft drinks',
  'frisdrank',
  'fris',
  'drank',
  'dranken',
  'gekoelde drank',
  'gekoelde dranken',
  'bar drink',
  'bar drinks',
] as const;

const DIEPVRIES_FROZEN_TERMS = [
  'diepvries',
  'frozen',
  'ijs',
  'ice cream',
  'friet',
  'frieten',
  'frozen fries',
  'diepvriesgroenten',
  'diepvries groenten',
  'frozen vegetables',
  'diepvriesfruit',
  'diepvries fruit',
  'frozen fruit',
  'bevroren vlees',
  'frozen meat',
  'bevroren vis',
  'frozen fish',
  'snack',
  'snacks',
  'dessert',
  'desserts',
] as const;

const KOELCEL_FOOD_TERMS = [
  'mayonaise',
  'mayonnaise',
  'mayo',
  'ketchup',
  'mosterd',
  'mustard',
  'dijon',
  'saus',
  'sauce',
  'sauces',
  'sauzen',
  'fresh food',
  'vers eten',
  'verse voeding',
  'vers',
  'zuivel',
  'dairy',
  'melk',
  'milk',
  'yoghurt',
  'yogurt',
  'kaas',
  'cheese',
  'vlees',
  'meat',
  'vis',
  'fish',
  'koel',
  'gekoeld',
] as const;

function formatScanStockActionLabel(action: ScanStockAction) {
  return SCAN_STOCK_ACTIONS.find((item) => item.value === action)?.label ?? 'Verplaatsen';
}

function formatScanMovementTypeLabel(movementType: ScanMovementType) {
  return ALL_SCAN_MOVEMENT_TYPES.find((item) => item.value === movementType)?.label ?? 'Verbruik';
}

function formatScanMovementConfirmLabel(movementType: ScanMovementType) {
  return movementType === 'intake' ? 'Inkoop' : formatScanMovementTypeLabel(movementType);
}

function getScanStockActionFromMovementType(movementType: ScanMovementType): ScanStockAction {
  if (movementType === 'intake') {
    return 'arrived';
  }
  if (movementType === 'transport') {
    return 'to_transport';
  }
  if (movementType === 'correction') {
    return 'correction';
  }
  return movementType === 'waste' ? 'waste' : 'consume';
}

function getScanMovementTypeFromStockAction(action: ScanStockAction): ScanMovementType {
  if (action === 'to_transport') {
    return 'transport';
  }

  if (action === 'correction') {
    return 'correction';
  }

  if (action === 'waste' || action === 'damaged') {
    return 'waste';
  }

  if (action === 'consume' || action === 'delivered') {
    return 'consumption';
  }

  return 'intake';
}

function getScanActionType(action: ScanStockAction) {
  switch (action) {
    case 'arrived':
      return 'arrived';
    case 'consume':
      return 'consumed';
    case 'delivered':
      return 'delivered';
    case 'to_transport':
      return 'to_transport';
    case 'waste':
      return 'waste';
    case 'damaged':
      return 'damaged';
    case 'correction':
      return 'adjusted';
    case 'reorder_needed':
      return 'reorder_needed';
    case 'move':
    default:
      return 'moved';
  }
}

function getFallbackScanLocation(locations: readonly string[]) {
  return locations.includes(DEFAULT_SCAN_LOCATION) ? DEFAULT_SCAN_LOCATION : locations[0] ?? DEFAULT_SCAN_LOCATION;
}

function createManualRecognitionFallback(params: {
  barcode?: string | null;
  reason: string;
  existingName?: string;
  existingCategory?: string;
  quantity?: number;
}): RecognitionResult {
  const barcode = normalizeBarcodeValue(params.barcode);
  const name =
    params.existingName?.trim() ||
    (barcode ? `Onbekende barcode ${barcode}` : 'Onbekend product');
  const category = params.existingCategory?.trim() || 'Controle nodig';

  return {
    name,
    category,
    quantity: Math.max(1, Math.round(params.quantity ?? 1)),
    expiryDays: null,
    confidence: 0.25,
    notes: `${params.reason} Vul naam/categorie handmatig aan en bevestig voor opslag.`,
    source: 'manual',
    barcode: barcode || null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

function createScanProofId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getTicketBucket(category: string, name: string) {
  const normalized = `${category} ${name}`.toLowerCase();

  if (
    normalized.includes('zuivel') ||
    normalized.includes('melk') ||
    normalized.includes('yoghurt') ||
    normalized.includes('kaas') ||
    normalized.includes('room') ||
    normalized.includes('boter')
  ) {
    return 'Zuivel';
  }

  if (
    normalized.includes('drank') ||
    normalized.includes('water') ||
    normalized.includes('sap') ||
    normalized.includes('cola') ||
    normalized.includes('fris') ||
    normalized.includes('bier') ||
    normalized.includes('wijn') ||
    normalized.includes('koffie') ||
    normalized.includes('thee') ||
    normalized.includes('bar')
  ) {
    return 'Dranken';
  }

  return 'Food cost';
}

function formatReceiptCostBucket(bucket: ReceiptCostBucket) {
  if (bucket === 'bar_cost') return 'Bar cost';
  if (bucket === 'food_cost') return 'Food cost';
  return 'Controle nodig';
}

function getReceiptCostBucketTone(bucket: ReceiptCostBucket) {
  if (bucket === 'bar_cost') {
    return { backgroundColor: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' };
  }

  if (bucket === 'food_cost') {
    return { backgroundColor: '#ecfdf5', borderColor: '#86efac', color: '#0f766e' };
  }

  return { backgroundColor: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' };
}

function getShelfLifeAdvice(expiryDays: number | null) {
  if (expiryDays === null) {
    return {
      label: 'Controle nodig',
      detail: 'Geen duidelijke houdbaarheid gevonden. Kijk ticket of verpakking nog even na.',
      tone: '#1d4ed8',
      surface: '#eff6ff',
    };
  }

  if (expiryDays <= 0) {
    return {
      label: 'Vandaag verwerken',
      detail: 'Meteen gebruiken, afboeken of in de alerts opvolgen.',
      tone: '#dc2626',
      surface: '#fef2f2',
    };
  }

  if (expiryDays <= 2) {
    return {
      label: 'Korte houdbaarheid',
      detail: 'Snel roteren in keuken of winkelvloer om waste te vermijden.',
      tone: '#b45309',
      surface: '#fffbeb',
    };
  }

  return {
    label: 'Stabiele houdbaarheid',
    detail: 'Kan normaal in de voorraadflow worden opgenomen.',
    tone: '#0f766e',
    surface: '#ecfeff',
  };
}

function estimateUnitPrice(category: string, name: string) {
  const normalized = `${category} ${name}`.toLowerCase();

  if (normalized.includes('zuivel')) {
    return 2.8;
  }

  if (normalized.includes('drank') || normalized.includes('water') || normalized.includes('sap')) {
    return 3.4;
  }

  if (normalized.includes('vers') || normalized.includes('salade')) {
    return 6.9;
  }

  return 4.5;
}

function parsePositiveNumber(value: string) {
  const normalized = value.trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatEuroAmount(amount: number) {
  return `EUR ${Math.max(0, amount).toFixed(2)}`;
}

function formatTracePrice(unitPrice: number | null) {
  return unitPrice === null ? 'prijs ontbreekt' : `EUR ${unitPrice.toFixed(2)}`;
}

function getConfidenceTone(value: number) {
  const score = Math.max(0, Math.min(1, value ?? 0));
  if (score >= 0.85) {
    return { background: '#ecfdf3', text: '#166534', border: '#86efac' };
  }
  if (score >= 0.6) {
    return { background: '#fffbeb', text: '#92400e', border: '#fcd34d' };
  }
  return { background: '#fef2f2', text: '#991b1b', border: '#fecdd3' };
}

function formatMutationAmount(amount: number) {
  return amount > 0 ? `+${amount}` : `${amount}`;
}

type ScanVerdict = 'geldig' | 'ongeldig' | 'onbekend' | 'opgeslagen';

const TRUSTED_RECOGNITION_SOURCES = new Set(['open-food-facts', 'openfoodfacts', 'user-override']);
const UNCONFIRMED_RECOGNITION_SOURCES = new Set([
  'barcode-lookup',
  'barcode-match',
  'barcode-pattern',
  'barcode-unknown',
  'cache',
  'local-catalog',
  'live-fallback',
  'live-unavailable',
  'manual',
  'manual-barcode-fallback',
  'manual-fallback',
]);

function isTrustedRecognitionSource(source: string) {
  const normalized = source.trim().toLowerCase();
  return TRUSTED_RECOGNITION_SOURCES.has(normalized) || normalized.includes('openai') || normalized.includes('vision');
}

function isUnconfirmedRecognitionSource(source: string) {
  const normalized = source.trim().toLowerCase();
  return UNCONFIRMED_RECOGNITION_SOURCES.has(normalized) || normalized.includes('fallback');
}

function getRecognitionSourceLabel(recognition: RecognitionResult) {
  if (recognition.source.trim().toLowerCase() === 'manual') {
    return 'Handmatige correctie';
  }

  if (isTrustedRecognitionSource(recognition.source)) {
    return recognition.source === 'user-override' ? 'Handmatige barcodecorrectie' : 'Live barcode/AI herkenning';
  }

  if (isUnconfirmedRecognitionSource(recognition.source)) {
    return 'Product niet automatisch herkend';
  }

  return 'Herkenning vraagt controle';
}

function getRecognitionAuditSource(recognition: RecognitionResult) {
  const normalized = recognition.source.trim().toLowerCase();
  if (normalized === 'manual' || normalized.includes('fallback')) {
    return 'manual';
  }
  return normalized || 'unknown';
}

function buildScanRiaRecommendation(input: { recognition: RecognitionResult | null; suggestedLocation: string }) {
  const recognition = input.recognition;
  if (!recognition) {
    return {
      location: normalizeLiveStockLocation(input.suggestedLocation),
      action: 'move' as ScanStockAction,
      reason: 'Nog geen herkenning. Werkvloer kiest product, actie en locatie handmatig.',
    };
  }

  const text = `${recognition.name} ${recognition.category} ${recognition.notes}`.toLowerCase();

  if (recognition.recallFlag || (recognition.expiryDays !== null && recognition.expiryDays <= 0)) {
    return {
      location: 'Afval',
      action: 'waste' as ScanStockAction,
      reason: 'Recall of vervallen product vraagt afboeking.',
    };
  }

  if (recognition.expiryDays !== null && recognition.expiryDays <= 2) {
    return {
      location: includesAnyTerm(text, DIEPVRIES_FROZEN_TERMS)
        ? 'Diepvries'
        : includesAnyTerm(text, FRIGO_BAR_DRINK_TERMS)
        ? 'Frigo'
        : includesAnyTerm(text, KOELCEL_FOOD_TERMS)
          ? 'Koelcel'
          : 'Keuken',
      action: 'consume' as ScanStockAction,
      reason: 'Korte houdbaarheid vraagt eerst een vervalcheck.',
    };
  }

  if (text.includes('transport') || text.includes('levering') || text.includes('dispatch')) {
    return {
      location: 'Transport',
      action: 'move' as ScanStockAction,
      reason: 'Transportcontext gevonden, dus voorstel is verplaatsing naar Transport.',
    };
  }

  if (includesAnyTerm(text, DIEPVRIES_FROZEN_TERMS)) {
    return {
      location: 'Diepvries',
      action: 'move' as ScanStockAction,
      reason: 'Diepvriesproduct hoort in Diepvries.',
    };
  }

  if (includesAnyTerm(text, KOELCEL_FOOD_TERMS)) {
    return {
      location: 'Koelcel',
      action: 'move' as ScanStockAction,
      reason: 'Gekoeld foodproduct hoort in Koelcel.',
    };
  }

  if (includesAnyTerm(text, FRIGO_BAR_DRINK_TERMS)) {
    return {
      location: 'Frigo',
      action: 'move' as ScanStockAction,
      reason: 'Gekoelde bar- of drankvoorraad hoort in Frigo.',
    };
  }

  if (text.includes('brood') || text.includes('eten') || text.includes('keuken') || text.includes('vers')) {
    return {
      location: 'Keuken',
      action: 'move' as ScanStockAction,
      reason: 'Vers of keukenproduct hoort in Keuken.',
    };
  }

  return {
    location: normalizeLiveStockLocation(input.suggestedLocation),
    action: 'move' as ScanStockAction,
    reason: 'Geen harde productregel gevonden. Werkvloerbevestiging blijft leidend.',
  };
}

function buildScanAuditNote(input: {
  baseNote: string;
  productName: string;
  productCategory: string;
  recognitionSource: string;
  recognitionConfidence: number | null;
  aiSuggestedLocation: string;
  aiSuggestedAction: ScanStockAction;
  aiSuggestedReason: string;
  confirmedLocation: string;
  confirmedAction: ScanStockAction;
  confirmedByUser: string;
  confirmedByRole: string | null;
  previousLocation: string | null;
  quantity: number;
  recognitionPhotoUri: string | null;
  proofPhotoUri: string | null;
  auditStatus: 'saved' | 'needs_review' | 'needs_reorder';
}) {
  const suggestionOverridden =
    input.aiSuggestedLocation !== input.confirmedLocation || input.aiSuggestedAction !== input.confirmedAction;
  const confidence =
    typeof input.recognitionConfidence === 'number' && Number.isFinite(input.recognitionConfidence)
      ? Math.round(input.recognitionConfidence * 100)
      : null;
  const selectedLocation = formatScanLocationLabel(input.confirmedLocation);
  const suggestedLocation = formatScanLocationLabel(input.aiSuggestedLocation);
  const selectedAction = formatScanStockActionLabel(input.confirmedAction);
  const suggestedAction = formatScanStockActionLabel(input.aiSuggestedAction);
  const sourceType = input.recognitionSource === 'manual' ? 'manual' : 'ai_assisted';

  return [
    input.baseNote,
    `product_name=${input.productName}`,
    `category=${input.productCategory}`,
    `source=${sourceType}`,
    `status=${input.auditStatus}`,
    `action_type=${getScanActionType(input.confirmedAction)}`,
    `quantity_delta=${
      input.confirmedAction === 'consume' ||
      input.confirmedAction === 'delivered' ||
      input.confirmedAction === 'waste' ||
      input.confirmedAction === 'damaged'
        ? `-${input.quantity}`
        : '0'
    }`,
    `selected_location=${selectedLocation}`,
    `selected_action=${selectedAction}`,
    `recognition_photo=${input.recognitionPhotoUri ?? '-'}`,
    `proof_photo=${input.proofPhotoUri ?? '-'}`,
    `suggested_location=${suggestedLocation}`,
    `suggested_action=${suggestedAction}`,
    `ai_confidence=${confidence ?? 'unknown'}`,
    `ai_reason=${input.aiSuggestedReason}`,
    `recognition_source=${input.recognitionSource}`,
    `recognition_confidence=${confidence ?? 'unknown'}`,
    `ai_suggested_location=${suggestedLocation}`,
    `ai_suggested_action=${suggestedAction}`,
    `ai_suggested_reason=${input.aiSuggestedReason}`,
    `confirmed_location=${selectedLocation}`,
    `confirmed_action=${selectedAction}`,
    `confirmed_by_user=${input.confirmedByUser}`,
    `user_role=${input.confirmedByRole ?? 'unknown'}`,
    `previous_location=${input.previousLocation ? formatScanLocationLabel(input.previousLocation) : '-'}`,
    `ai_followed=${suggestionOverridden ? 'false' : 'true'}`,
    `ai_suggestion_overridden=${suggestionOverridden ? 'true' : 'false'}`,
  ].join(' | ');
}

function getScanAuditStatus(recognition: RecognitionResult, action: ScanStockAction): 'saved' | 'needs_review' | 'needs_reorder' {
  if (action === 'reorder_needed') {
    return 'needs_reorder';
  }

  if (action === 'damaged') {
    return 'needs_review';
  }

  if (action === 'correction') {
    return 'needs_review';
  }

  if (recognition.confidence !== null && recognition.confidence < 0.75) {
    return 'needs_review';
  }

  return isUnconfirmedRecognitionSource(recognition.source) ? 'needs_review' : 'saved';
}

function determineScanVerdict(params: {
  recognition: RecognitionResult;
  matches: InventoryRecognitionMatch[];
  barcode: string | null;
  recallFlag: boolean;
}): ScanVerdict {
  const recalled =
    params.recallFlag ||
    Boolean(params.recognition.recallFlag) ||
    (params.recognition.expiryDays !== null && params.recognition.expiryDays <= 0);

  if (recalled) {
    return 'ongeldig';
  }

  const hasDatabaseMatch =
    params.matches.length > 0 ||
    isTrustedRecognitionSource(params.recognition.source);

  if (hasDatabaseMatch) {
    return 'geldig';
  }

  return 'onbekend';
}

function getScanVerdictMeta(verdict: ScanVerdict | null, recognition: RecognitionResult | null, language: UiLanguage) {
  const productName = recognition?.name?.trim() || 'Scan';
  const detail = (key: TranslationKey) =>
    formatDetailTranslation(t(key, language), {
      productName,
    });

  switch (verdict) {
    case 'geldig':
      return {
        title: t('scan.detail.verdict.valid.title', language),
        detail: detail('scan.detail.verdict.valid.body'),
        tone: '#0f766e',
        surface: '#ecfeff',
      };
    case 'ongeldig':
      return {
        title: t('scan.detail.verdict.invalid.title', language),
        detail: detail('scan.detail.verdict.invalid.body'),
        tone: '#dc2626',
        surface: '#fef2f2',
      };
    case 'onbekend':
      return {
        title: t('scan.detail.verdict.unknown.title', language),
        detail: detail('scan.detail.verdict.unknown.body'),
        tone: '#b45309',
        surface: '#fffbeb',
      };
    case 'opgeslagen':
      return {
        title: t('scan.detail.verdict.saved.title', language),
        detail: detail('scan.detail.verdict.saved.body'),
        tone: '#1d4ed8',
        surface: '#eff6ff',
      };
    default:
      return {
        title: t('scan.detail.verdict.default.title', language),
        detail: 'Camera → lezen → vergelijken → opslaan → advies van Ria.',
        tone: '#475569',
        surface: '#f8fafc',
      };
  }
}

type InventoryRecognitionMatch = {
  item: InventoryItem;
  score: number;
  reasons: string[];
};

type SmartRecognitionOutcome = {
  recognition: RecognitionResult;
  matches: InventoryRecognitionMatch[];
  talkback: string;
};

function normalizeMatchText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isGenericCategory(value: string) {
  const normalized = normalizeMatchText(value);

  return (
    !normalized ||
    normalized === 'algemeen' ||
    normalized === 'general' ||
    normalized === 'unknown' ||
    normalized === 'onbekend' ||
    normalized === 'verpakt product'
  );
}

function isLiveScanInventoryCandidate(item: InventoryItem) {
  const id = item.id.trim().toLowerCase();
  const source = item.source.trim().toLowerCase();
  const name = item.name.trim().toLowerCase();

  if (id.startsWith('seed-')) {
    return false;
  }

  if (source === 'demo' || source === 'mock' || source === 'sample' || source === 'voorbeeld' || source === 'manual-seed') {
    return false;
  }

  if (!item.barcode && (name === 'brood' || name === 'wit brood' || name === 'limonade')) {
    return false;
  }

  return true;
}

function getDefaultTalkback(mode: ScanMode) {
  if (mode === 'Kassaticket') {
    return 'Scan-assistent: scan een kassabon en ik splits meteen naar food cost, bar cost en inkoop.';
  }

  return 'Scan-assistent: scan een barcode of neem een foto; ik geef direct concrete product- en voorraadfeedback.';
}

function enhanceRecognitionWithInventory(params: {
  recognition: RecognitionResult;
  items: InventoryItem[];
  selectedLocation: string;
  barcode: string | null;
}): SmartRecognitionOutcome {
  const { recognition, items, selectedLocation, barcode } = params;
  const normalizedName = normalizeMatchText(recognition.name);
  const normalizedCategory = normalizeMatchText(recognition.category);

  const matches = items
    .filter(isLiveScanInventoryCandidate)
    .map<InventoryRecognitionMatch>((item) => {
      let score = 0;
      const reasons: string[] = [];
      const itemName = normalizeMatchText(item.name);
      const itemCategory = normalizeMatchText(item.category);

      if (barcode && item.barcode === barcode) {
        score += 8;
        reasons.push('barcode');
      }

      if (normalizedName && itemName === normalizedName) {
        score += 5;
        reasons.push('naam');
      }

      if (!barcode && normalizedCategory && itemCategory === normalizedCategory && !isUnconfirmedRecognitionSource(recognition.source)) {
        score += 2;
        reasons.push('categorie');
      }

      if (reasons.length > 0 && item.location === selectedLocation) {
        score += 1;
      }

      if (!barcode && normalizedName && itemName.includes(normalizedName) && itemName !== normalizedName) {
        score += 1;
        reasons.push('naam-deel');
      }

      return { item, score, reasons };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (matches.length === 0) {
    return {
      recognition,
      matches,
      talkback: `Scan-assistent: geen directe voorraadmatch. Controleer naam, categorie en houdbaarheid. Zekerheid ${Math.round(
        recognition.confidence * 100
      )}%.`,
    };
  }

  const best = matches[0];
  let next: RecognitionResult = { ...recognition };
  const noteSegments: string[] = [];
  const hasBarcodeMatch = Boolean(barcode && best.item.barcode === barcode);
  const hasNameMatch = normalizeMatchText(best.item.name) === normalizedName;

  if (hasBarcodeMatch) {
    next = {
      ...next,
      name: best.item.name,
      category: best.item.category,
      expiryDays: best.item.expiryDays ?? next.expiryDays,
      confidence: Math.min(0.99, Math.max(next.confidence, 0.93)),
      source: `${next.source} + voorraad-barcode`,
      barcode: barcode ?? next.barcode,
    };
    noteSegments.push(`Barcode matcht met voorraaditem ${best.item.name} in ${best.item.location}.`);
  } else if (hasNameMatch) {
    next = {
      ...next,
      category: isGenericCategory(next.category) ? best.item.category : next.category,
      expiryDays: best.item.expiryDays ?? next.expiryDays,
      confidence: Math.min(0.98, Math.max(next.confidence, 0.87)),
      source: `${next.source} + voorraad-naam`,
    };
    noteSegments.push(`Naam matcht met bestaande voorraad in ${best.item.location}.`);
  } else if (!barcode && !isUnconfirmedRecognitionSource(recognition.source)) {
    next = {
      ...next,
      category: isGenericCategory(next.category) ? best.item.category : next.category,
      confidence: Math.min(0.95, Math.max(next.confidence, 0.8)),
      source: `${next.source} + voorraad-categorie`,
    };
    noteSegments.push(`Categorie afgestemd op voorraadpatroon in ${best.item.location}.`);
  }

  if (!next.batchCode && best.item.batchCode) {
    next.batchCode = best.item.batchCode;
    noteSegments.push('Batchcode automatisch meegenomen uit gelijkaardige voorraad.');
  }

  if (!next.lotNumber && best.item.lotNumber) {
    next.lotNumber = best.item.lotNumber;
    noteSegments.push('Lotnummer automatisch meegenomen uit gelijkaardige voorraad.');
  }

  if (best.item.recallFlag) {
    next.recallFlag = true;
    noteSegments.push('Recall-signaal gevonden op gelinkt voorraaditem.');
  }

  if (noteSegments.length > 0) {
    next.notes = `${next.notes} ${noteSegments.join(' ')}`.trim();
  }

  const previewMatches = matches
    .slice(0, 2)
    .map((entry) => `${entry.item.name} (${entry.item.location})`)
    .join(', ');

  return {
    recognition: next,
    matches,
    talkback: `Scan-assistent: ${noteSegments[0] ?? 'Voorraadmatch gevonden.'} Top matches: ${previewMatches}. Zekerheid ${Math.round(
      next.confidence * 100
    )}%.`,
  };
}

function getTicketCandidateScore(params: {
  name: string;
  category: string;
  location: string;
  targetBucket: string;
  preferredLocation: string;
}) {
  let score = 0;

  if (params.location === params.preferredLocation) {
    score += 3;
  }

  if (getTicketBucket(params.category, params.name) === params.targetBucket) {
    score += 2;
  }

  if (params.category.toLowerCase().includes('vers') || params.category.toLowerCase().includes('zuivel')) {
    score += 1;
  }

  return score;
}

export default function ScanScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { pageMaxWidth, pagePadding } = useResponsiveLayout();
  const cameraRef = useRef<CameraView | null>(null);
  const bottomSheetRef = useRef<ScrollView | null>(null);
  const locationActionOffsetRef = useRef(0);
  const barcodeScanLockRef = useRef(false);
  const { items, locations, movements, dispatches } = useInventory();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanMode, setScanMode] = useState<ScanMode>('Product');
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>('nl');
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [cameraPreviewOpen, setCameraPreviewOpen] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [scanned, setScanned] = useState<ScanResult>(null);
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto>(null);
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [staffConfirmed, setStaffConfirmed] = useState(false);
  const [confirmedDestination, setConfirmedDestination] = useState<string | null>(null);
  const [editRecognition, setEditRecognition] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [editedExpiryDays, setEditedExpiryDays] = useState('');
  const [editedBatch, setEditedBatch] = useState('');
  const [editedLot, setEditedLot] = useState('');
  const [recallFlag, setRecallFlag] = useState(false);
  const [aiTalkback, setAiTalkback] = useState(getDefaultTalkback('Product'));
  const [statusMessage, setStatusMessage] = useState(() => t('scan.detail.status.initial'));
  const [scanLiveMessage, setScanLiveMessage] = useState('');
  const [scanVerdict, setScanVerdict] = useState<ScanVerdict | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingInventory, setIsSavingInventory] = useState(false);
  const [realAiState, setRealAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [realAiAnswer, setRealAiAnswer] = useState<RealAiResponse | null>(null);
  const [realAiError, setRealAiError] = useState('');
  const [scanPipelineDebug, setScanPipelineDebug] = useState<ScanPipelineDebugState>({
    recognitionStatus: 'idle',
    recognitionError: '',
    aiStatus: 'idle',
    aiError: '',
  });
  const lastAutoRiaKeyRef = useRef<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [lastMutationSummary, setLastMutationSummary] = useState<ScanMutationSummary | null>(null);
  const [selectedLocation, setSelectedLocation] = useState(DEFAULT_SCAN_LOCATION);
  const [, setLocationTouched] = useState(false);
  const [destinationChosen, setDestinationChosen] = useState(false);
  const [coldLocationTemperatures, setColdLocationTemperatures] = useState<Record<ColdScanLocation, number>>(
    DEFAULT_COLD_LOCATION_TEMPERATURES
  );
  const [selectedStockAction, setSelectedStockAction] = useState<ScanStockAction>('move');
  const [selectedMovementType, setSelectedMovementType] = useState<ScanMovementType | null>(null);
  const [, setActionTouched] = useState(false);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [manualMovementName, setManualMovementName] = useState('');
  const [manualMovementCategory, setManualMovementCategory] = useState('');
  const [manualMovementFrom, setManualMovementFrom] = useState('');
  const [manualMovementTo, setManualMovementTo] = useState('');
  const [manualMovementQuantity, setManualMovementQuantity] = useState('1');
  const scanDetail = useCallback(
    (key: TranslationKey, replacements?: Record<string, string | number | null | undefined>) =>
      formatDetailTranslation(t(key, uiLanguage), replacements),
    [uiLanguage]
  );
  const scanLocationLabel = useCallback(
    (destination: ScanDestination | null | undefined) => {
      switch (destination) {
        case 'bar':
          return scanDetail('scan.location.bar');
        case 'frigo':
          return scanDetail('scan.location.fridge');
        case 'keuken':
          return scanDetail('scan.location.kitchen');
        case 'koelcel':
          return scanDetail('scan.location.cooling');
        case 'diepvries':
          return scanDetail('scan.location.freezer');
        case 'stock':
          return scanDetail('scan.location.stock');
        case 'transport':
          return scanDetail('scan.location.transport');
        default:
          return '';
      }
    },
    [scanDetail]
  );
  const scanLocationValueLabel = useCallback(
    (location: string) => {
      const destination = getScanDestinationValue(location);
      return destination ? scanLocationLabel(destination) : formatScanLocationLabel(location);
    },
    [scanLocationLabel]
  );
  const scanMovementLabel = useCallback(
    (movementType: ScanMovementType | null | undefined) => {
      switch (movementType) {
        case 'intake':
          return scanDetail('scan.movement.purchase');
        case 'consumption':
          return scanDetail('scan.movement.consumption');
        case 'waste':
          return scanDetail('scan.movement.waste');
        case 'correction':
          return scanDetail('scan.movement.correction');
        case 'transport':
          return scanDetail('scan.location.transport');
        default:
          return '';
      }
    },
    [scanDetail]
  );
  const [saleQuantityInput, setSaleQuantityInput] = useState('1');
  const [saleUnitPriceInput, setSaleUnitPriceInput] = useState('');
  const [ticketText, setTicketText] = useState('');
  const [ticketCostOverrides, setTicketCostOverrides] = useState<Record<string, ReceiptCostBucket>>({});
  const [multiSaveBusy, setMultiSaveBusy] = useState(false);
  const [scanAccess, setScanAccess] = useState<ScanAccessState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAvailability() {
      try {
        const available = await CameraView.isAvailableAsync();
        if (!cancelled) {
          setCameraAvailable(available);
        }
      } catch {
        if (!cancelled) {
          setCameraAvailable(false);
        }
      }
    }

    checkAvailability();

    return () => {
      cancelled = true;
    };
  }, []);

  const scanLocationOptions = useMemo(
    () => Array.from(new Set<string>([...LIVE_STOCK_LOCATIONS, ...locations])),
    [locations]
  );
  const canUseTransportMovement = auth.role === 'CHAUFFEUR' || auth.activeMembership?.role === 'CHAUFFEUR';
  const visibleScanMovementTypes = useMemo(
    () => (canUseTransportMovement ? ALL_SCAN_MOVEMENT_TYPES : SCAN_MOVEMENT_TYPES),
    [canUseTransportMovement]
  );
  const selectedDestination = destinationChosen ? getScanDestinationValue(selectedLocation) : null;
  const selectedDestinationLabel = selectedDestination ? scanLocationLabel(selectedDestination) : null;
  const selectedMovementLabel = selectedMovementType ? scanMovementLabel(selectedMovementType) : null;
  const selectedMovementConfirmLabel = selectedMovementType ? formatScanMovementConfirmLabel(selectedMovementType) : null;
  const selectedQuantity = Math.max(1, Math.round(parsePositiveNumber(saleQuantityInput)) || recognition?.quantity || 1);
  const scanActionCopy = SCAN_ACTION_COPY[uiLanguage];
  const hasActiveScanMembership = Boolean(
    auth.userId &&
      auth.companyId &&
      auth.branchId &&
      auth.activeMembership?.id &&
      auth.activeMembership?.status === 'ACTIVE'
  );
  const movementPolicyAllowed = selectedMovementType === 'transport' ? canUseTransportMovement : true;
  const canBuildManualRecognition = Boolean(editedName.trim());
  const canConfirmInventoryDestination = Boolean(
    (recognition || canBuildManualRecognition) &&
      selectedDestination &&
      selectedMovementType &&
      hasActiveScanMembership &&
      movementPolicyAllowed
  );
  const inventoryConfirmLabel = !selectedDestinationLabel
    ? selectedMovementConfirmLabel
      ? scanDetail('scan.confirm.chooseLocation')
      : scanDetail('scan.confirm.chooseLocation')
    : !selectedMovementConfirmLabel
      ? scanDetail('scan.confirm.chooseMovement')
      : 'BEVESTIG';
  const inventoryConfirmDetail =
    selectedDestinationLabel && selectedMovementConfirmLabel
      ? selectedMovementType === 'intake' || selectedMovementType === 'transport'
        ? `${selectedMovementConfirmLabel} naar ${selectedDestinationLabel}`
        : selectedMovementType === 'correction'
          ? `${selectedMovementConfirmLabel} in ${selectedDestinationLabel}`
        : `${selectedMovementConfirmLabel} uit ${selectedDestinationLabel}`
      : null;

  const focusLocationActionStep = useCallback(() => {
    const targetY = Math.max(0, locationActionOffsetRef.current - 12);

    setTimeout(() => {
      bottomSheetRef.current?.scrollTo({ y: targetY, animated: true });
    }, 120);
  }, []);

  useEffect(() => {
    if (!scanLocationOptions.includes(selectedLocation)) {
      setSelectedLocation(getFallbackScanLocation(scanLocationOptions));
      setDestinationChosen(false);
      setSelectedMovementType(null);
      setTicketCostOverrides({});
    }
  }, [scanLocationOptions, selectedLocation]);

  useEffect(() => {
    if (selectedMovementType === 'transport' && !canUseTransportMovement) {
      setSelectedMovementType(null);
      setActionTouched(false);
    }
  }, [canUseTransportMovement, selectedMovementType]);

  const suggestedLocation = useMemo(() => {
    if (!recognition) {
      return getFallbackScanLocation(scanLocationOptions);
    }

    const barcodeMatch = scanned?.data
      ? items.find((item) => isLiveScanInventoryCandidate(item) && item.barcode === scanned.data)?.location
      : null;
    if (barcodeMatch) {
      return barcodeMatch;
    }

    const sameName = items.filter(
      (item) => isLiveScanInventoryCandidate(item) && item.name.trim().toLowerCase() === recognition.name.trim().toLowerCase()
    );
    if (sameName.length > 0) {
      return sameName[0]?.location ?? getFallbackScanLocation(scanLocationOptions);
    }

    const sameCategory = items.filter(
      (item) =>
        isLiveScanInventoryCandidate(item) &&
        !isUnconfirmedRecognitionSource(recognition.source) &&
        item.category.trim().toLowerCase() === recognition.category.trim().toLowerCase()
    );
    if (sameCategory.length > 0) {
      const frequency = new Map<string, number>();
      sameCategory.forEach((item) => {
        frequency.set(item.location, (frequency.get(item.location) ?? 0) + 1);
      });

      return (
        [...frequency.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
        getFallbackScanLocation(scanLocationOptions)
      );
    }

    return getFallbackScanLocation(scanLocationOptions);
  }, [items, recognition, scanLocationOptions, scanned?.data]);
  const riaRecommendation = useMemo(
    () => buildScanRiaRecommendation({ recognition, suggestedLocation }),
    [recognition, suggestedLocation]
  );
  const riaSuggestedMovementType = useMemo(
    () => getScanMovementTypeFromStockAction(riaRecommendation.action),
    [riaRecommendation.action]
  );
  const riaSuggestedMovementLabel = scanMovementLabel(riaSuggestedMovementType);

  useEffect(() => {
    if (!recognition) {
      return;
    }

    setSaleQuantityInput(`${Math.max(1, recognition.quantity)}`);
    setSaleUnitPriceInput(estimateUnitPrice(recognition.category, recognition.name).toFixed(2).replace('.', ','));
    setActionTouched(false);
    setSelectedMovementType(null);
    setDestinationChosen(false);
    setConfirmedDestination(null);
    setStaffConfirmed(false);
  }, [recognition]);

  useEffect(() => {
    if (!recognition) {
      setEditRecognition(false);
      setEditedName('');
      setEditedCategory('');
      setEditedExpiryDays('');
      setEditedBatch('');
      setEditedLot('');
      setRecallFlag(false);
      return;
    }

    const matchedItem = items.find((item) => {
      if (!isLiveScanInventoryCandidate(item)) {
        return false;
      }
      const barcodeMatch = recognition.barcode && item.barcode === recognition.barcode;
      const nameMatch = item.name.trim().toLowerCase() === recognition.name.trim().toLowerCase();
      return barcodeMatch || nameMatch;
    });

    setEditedName(recognition.name);
    setEditedCategory(recognition.category);
    setEditedExpiryDays(recognition.expiryDays === null ? '' : String(recognition.expiryDays));
    setEditedBatch(recognition.batchCode ?? matchedItem?.batchCode ?? '');
    setEditedLot(recognition.lotNumber ?? matchedItem?.lotNumber ?? '');
    setRecallFlag(recognition.recallFlag ?? matchedItem?.recallFlag ?? false);
  }, [items, recognition]);

  const relatedInventoryItems = useMemo(() => {
    if (!recognition && !scanned?.data) {
      return [];
    }

    return items.filter((item) => {
      if (!isLiveScanInventoryCandidate(item)) {
        return false;
      }

      if (scanned?.data && item.barcode === scanned.data) {
        return true;
      }

      if (!recognition) {
        return false;
      }

      return item.name.trim().toLowerCase() === recognition.name.trim().toLowerCase();
    });
  }, [items, recognition, scanned?.data]);

  const locationStockSnapshot = useMemo(() => {
    const locationItems = items.filter((item) => item.location === selectedLocation);
    const totalUnits = locationItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = locationItems.reduce((sum, item) => sum + item.stockValue, 0);
    const priceMissingCount = locationItems.filter((item) => item.priceMissing).length;
    const expiringSoon = locationItems.filter((item) => item.expiryDays !== null && item.expiryDays <= 2).length;
    const lowStock = locationItems
      .slice()
      .sort((left, right) => left.quantity - right.quantity)
      .slice(0, 6);

    return {
      totalProducts: locationItems.length,
      totalUnits,
      totalValue,
      priceMissingCount,
      expiringSoon,
      lowStock,
    };
  }, [items, selectedLocation]);
  const locationCapitalRows = useMemo(
    () => getLocationBreakdown(items, ['Bar', 'Frigo', 'Diepvries', 'Keuken', 'Koelcel', 'Stock']),
    [items]
  );
  const movementValueBreakdown = useMemo(
    () => getMovementValueBreakdown(movements, ['Bar', 'Frigo', 'Diepvries', 'Keuken', 'Koelcel', 'Stock']),
    [movements]
  );
  const lowStockAlerts = useMemo(
    () => getLowStockAlertsByLocation(items, ['Bar', 'Keuken', 'Frigo', 'Diepvries', 'Koelcel', 'Stock']),
    [items]
  );

  const matchedSaleItem = useMemo(() => {
    if (scanMode !== 'Kassaticket' || relatedInventoryItems.length === 0) {
      return null;
    }

    return (
      relatedInventoryItems.find((item) => item.location === selectedLocation) ??
      relatedInventoryItems[0] ??
      null
    );
  }, [relatedInventoryItems, scanMode, selectedLocation]);

  const liveMovementStock = useMemo(() => {
    const fallbackMovement = movements.find((movement) => movement.type === 'transfer' && movement.source === 'manual') ?? null;
    const productName = (manualMovementName.trim() || fallbackMovement?.itemName || '').toLowerCase();
    const productCategory = (manualMovementCategory.trim() || fallbackMovement?.category || '').toLowerCase();
    const hasQuery = Boolean(productName && productCategory);

    return {
      productLabel: manualMovementName.trim() || 'Nog geen product',
      categoryLabel: manualMovementCategory.trim() || 'Nog geen categorie',
      rows: LIVE_STOCK_LOCATIONS.map((location) => {
        const quantity = hasQuery
          ? items.reduce((sum, item) => {
              const matchesLocation = item.location.trim().toLowerCase() === location.toLowerCase();
              const matchesName = item.name.trim().toLowerCase() === productName;
              const matchesCategory = item.category.trim().toLowerCase() === productCategory;
              return matchesLocation && matchesName && matchesCategory ? sum + item.quantity : sum;
            }, 0)
          : 0;

        return { location, quantity };
      }),
    };
  }, [items, manualMovementCategory, manualMovementName, movements]);

  const latestManualMovement = useMemo(
    () => movements.find((movement) => movement.type === 'transfer' && movement.source === 'manual') ?? null,
    [movements]
  );

  const manualExpiryItem = useMemo(() => {
    const name = (manualMovementName.trim() || latestManualMovement?.itemName || '').trim().toLowerCase();
    const category = (manualMovementCategory.trim() || latestManualMovement?.category || '').trim().toLowerCase();
    const fromLocation = (manualMovementFrom.trim() || latestManualMovement?.fromLocation || '').trim().toLowerCase();

    if (!name || !category) {
      return null;
    }

    const exactMatch = fromLocation
      ? items.find(
          (item) =>
            item.name.trim().toLowerCase() === name &&
            item.category.trim().toLowerCase() === category &&
            item.location.trim().toLowerCase() === fromLocation
        )
      : null;

    if (exactMatch) {
      return exactMatch;
    }

    return (
      items.find(
        (item) => item.name.trim().toLowerCase() === name && item.category.trim().toLowerCase() === category
      ) ?? null
    );
  }, [items, latestManualMovement, manualMovementCategory, manualMovementFrom, manualMovementName]);

  const persistedManualMutationSummary = useMemo<ScanMutationSummary | null>(() => {
    if (!latestManualMovement) {
      return null;
    }

    const fromLabel = latestManualMovement.fromLocation ?? 'Onbekend';
    const toLabel = latestManualMovement.toLocation ?? 'Onbekend';

    return {
      actionLabel: latestManualMovement.actionLabel,
      productName: latestManualMovement.itemName,
      category: latestManualMovement.category ?? 'Onbekend',
      fromLabel,
      toLabel,
      fromLocation: latestManualMovement.fromLocation ?? undefined,
      toLocation: latestManualMovement.toLocation ?? undefined,
      quantity: latestManualMovement.quantity,
      confirmationLabel: 'Bevestigd',
      resultDeltas: [
        { label: fromLabel, amount: -latestManualMovement.quantity },
        { label: toLabel, amount: latestManualMovement.quantity },
      ],
      recordedAt: latestManualMovement.recordedAt,
      expiryDate: latestManualMovement.expiryDate ?? null,
      expiryStatus: latestManualMovement.expiryStatus,
      recommendedAction: latestManualMovement.recommendedAction,
      recommendedReason: latestManualMovement.recommendedReason,
    };
  }, [latestManualMovement]);

  const visibleMutationSummary = lastMutationSummary ?? persistedManualMutationSummary;
  const latestManualMovementText = latestManualMovement
    ? `${latestManualMovement.quantity} ${latestManualMovement.itemName} verplaatst van ${latestManualMovement.fromLocation ?? 'Onbekend'} naar ${
        latestManualMovement.toLocation ?? 'Onbekend'
      }`
    : '';
  const activeDispatch = dispatches[0] ?? null;
  const activeDispatchHasProof = Boolean(activeDispatch?.photoUri || activeDispatch?.photoPlaceholder);
  const canConfirmDispatchWorkfloor = Boolean(activeDispatch && !activeDispatch.floorConfirmedAt);
  const canAddDispatchPhotoProof = Boolean(activeDispatch && activeDispatch.floorConfirmedAt && !activeDispatchHasProof);
  const canConfirmDispatchDriver = Boolean(
    activeDispatch && activeDispatch.floorConfirmedAt && activeDispatchHasProof && !activeDispatch.driverConfirmedAt
  );
  const canConfirmDispatchManager = Boolean(
    activeDispatch && activeDispatch.floorConfirmedAt && activeDispatchHasProof && !activeDispatch.managerConfirmedAt
  );
  const canConfirmDispatchDeparture = Boolean(
    activeDispatch &&
      activeDispatch.driverConfirmedAt &&
      activeDispatch.managerConfirmedAt &&
      !activeDispatch.departureConfirmedAt
  );
  const canConfirmDispatchCustomerReceipt = Boolean(
    activeDispatch && activeDispatch.departureConfirmedAt && !activeDispatch.customerConfirmedAt
  );
  const canReleaseDispatchInvoice = Boolean(
    activeDispatch && activeDispatch.customerConfirmedAt && activeDispatch.invoiceStatus === 'pending'
  );
  const canPrepareDispatchInvoice = Boolean(
    activeDispatch && activeDispatch.invoiceReleasedAt && activeDispatch.invoiceStatus === 'released'
  );
  const canOffbookDispatchGoods = Boolean(
    activeDispatch && activeDispatch.invoiceStatus === 'ready' && !activeDispatch.goodsClosedAt
  );
  const canCloseDispatchDossier = Boolean(
    activeDispatch && activeDispatch.goodsClosedAt && activeDispatch.finalAuditStatus !== 'complete'
  );

  const scanVerdictMeta = useMemo(() => getScanVerdictMeta(scanVerdict, recognition, uiLanguage), [scanVerdict, recognition, uiLanguage]);

  const scanCoach = useMemo(() => {
    const base = scanVerdictMeta;

    if (!recognition) {
      return base;
    }

    if (scanVerdict === 'geldig' && relatedInventoryItems.length > 0) {
      return {
        ...base,
        detail: `${base.detail} Bestaande voorraadmatch gevonden in ${selectedLocation}.`,
      };
    }

    if (scanVerdict === 'onbekend' && scanned?.data) {
      return {
        ...base,
        detail: `${base.detail} Barcode ${scanned.data} staat nog niet in de productdatabase.`,
      };
    }

    return base;
  }, [recognition, relatedInventoryItems.length, scanVerdict, scanVerdictMeta, scanned?.data, selectedLocation]);

  const smartSuggestions = useMemo(() => {
    if (!recognition) {
      return [
        scanDetail('scan.status.capturing'),
        scanDetail('scan.status.reading'),
        scanDetail('scan.status.comparing'),
        scanDetail('scan.status.verdictOptions'),
        scanDetail('scan.status.saving'),
      ];
    }

    const suggestions = [
      scanVerdict === 'geldig'
        ? scanDetail('scan.verdict.validSuggestion', { verdict: scanDetail('scan.verdict.valid') })
        : scanVerdict === 'ongeldig'
          ? scanDetail('scan.verdict.invalidSuggestion', { verdict: scanDetail('scan.verdict.invalid') })
          : scanVerdict === 'opgeslagen'
            ? scanDetail('scan.verdict.savedSuggestion')
            : scanDetail('scan.verdict.unknownSuggestion', { verdict: scanDetail('scan.verdict.unknown') }),
      scanDetail('scan.status.riaProposal', {
        location: scanLocationValueLabel(riaRecommendation.location),
        movement: riaSuggestedMovementLabel,
      }),
      recognition.confidence >= 0.85
        ? scanDetail('scan.status.confidenceHigh')
        : scanDetail('scan.status.checkNameCategory'),
      scanned?.data ? scanDetail('scan.status.barcodeLinked') : scanDetail('scan.status.noBarcodePhotoContext'),
    ];

    if (relatedInventoryItems.length > 0) {
      suggestions.push(
        scanDetail('scan.status.similarStockFound', {
          items: relatedInventoryItems
            .slice(0, 2)
            .map((item) => item.name)
            .join(', '),
        })
      );
    }

    return suggestions;
  }, [recognition, relatedInventoryItems, riaRecommendation.location, riaSuggestedMovementLabel, scanDetail, scanLocationValueLabel, scanned?.data, scanVerdict]);

  const liveScanState = useMemo<LiveScanEngineState>(() => {
    const productName = editedName.trim() || recognition?.name.trim() || '';
    const barcode = normalizeBarcodeValue(manualBarcodeInput) || scanned?.data || recognition?.barcode || null;
    const source: LiveScanEngineState['source'] = barcode
      ? 'barcode'
      : capturedPhoto?.uri
        ? 'photo'
        : productName
          ? 'manual'
          : 'empty';
    const expiryDays = editedExpiryDays.trim() ? parseExpiryDaysInput(editedExpiryDays) : recognition?.expiryDays ?? null;
    const expiryDate =
      expiryDays === null
        ? null
        : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const suggestedMovement = getScanMovementTypeFromStockAction(riaRecommendation.action);
    const pendingProposal = productName
      ? {
          productName,
          location: riaRecommendation.location,
          movement: suggestedMovement,
          reason: riaRecommendation.reason,
          confidence: recognition?.confidence ?? null,
        }
      : null;
    const confirmReady = Boolean(
      productName &&
        selectedDestination &&
        selectedMovementType &&
        hasActiveScanMembership &&
        movementPolicyAllowed &&
        !isAnalyzing &&
        !isSavingInventory
    );
    const traceResult = visibleMutationSummary
      ? {
          itemName: visibleMutationSummary.productName,
          location: visibleMutationSummary.toLabel,
          movement: visibleMutationSummary.actionLabel ?? 'Bevestigd',
          recordedAt: visibleMutationSummary.recordedAt,
        }
      : null;
    const nextStep = !productName
      ? scanDetail('scan.ria.placeholder')
      : !selectedDestination
        ? 'Kies een locatie.'
        : !selectedMovementType
          ? 'Kies een beweging.'
          : !hasActiveScanMembership
            ? 'Actieve company/membership ontbreekt.'
            : !movementPolicyAllowed
              ? 'Deze beweging is niet toegestaan voor je rol.'
              : 'Klaar voor menselijke bevestiging.';

    return {
      productName,
      barcode,
      source,
      recognitionResult: recognition,
      selectedLocation: selectedDestination ? selectedLocation : null,
      selectedMovement: selectedMovementType,
      quantity: selectedQuantity,
      expiryDate,
      pendingProposal,
      stockStatus: {
        location: selectedDestination ? selectedLocation : null,
        matchingItems: relatedInventoryItems.length,
        locationProducts: locationStockSnapshot.totalProducts,
        locationUnits: locationStockSnapshot.totalUnits,
        locationValue: locationStockSnapshot.totalValue,
        lowStockCount: lowStockAlerts.length,
        expiringSoon: locationStockSnapshot.expiringSoon,
      },
      riaAdvice: pendingProposal
        ? scanDetail('scan.ria.proposalDetail', {
            productName: pendingProposal.productName,
            location: scanLocationValueLabel(pendingProposal.location),
            movement: scanMovementLabel(pendingProposal.movement),
            reason: pendingProposal.reason,
          })
        : nextStep,
      confirmReady,
      lastMutationResult: visibleMutationSummary,
      traceResult,
    };
  }, [
    capturedPhoto?.uri,
    editedExpiryDays,
    editedName,
    hasActiveScanMembership,
    isAnalyzing,
    isSavingInventory,
    locationStockSnapshot.expiringSoon,
    locationStockSnapshot.totalProducts,
    locationStockSnapshot.totalUnits,
    locationStockSnapshot.totalValue,
    lowStockAlerts.length,
    manualBarcodeInput,
    movementPolicyAllowed,
    recognition,
    relatedInventoryItems.length,
    riaRecommendation.action,
    riaRecommendation.location,
    riaRecommendation.reason,
    scanned?.data,
    scanDetail,
    scanLocationValueLabel,
    scanMovementLabel,
    selectedDestination,
    selectedLocation,
    selectedMovementType,
    selectedQuantity,
    visibleMutationSummary,
  ]);
  const scanTransportFocus = useMemo(
    () =>
      buildTransportAiContext({
        region: 'Europa',
        useCase: scanMode === 'Kassaticket' ? 'Delivery' : 'Logistiek',
      }).transport,
    [scanMode]
  );

  const scanAiContext = useMemo(
    () => ({
      screen: 'scan',
      scanState: liveScanState,
      scanMode,
      productName: liveScanState.productName,
      barcode: liveScanState.barcode,
      selectedLocation: liveScanState.selectedLocation,
      selectedMovement: liveScanState.selectedMovement,
      quantity: liveScanState.quantity,
      expiryDate: liveScanState.expiryDate,
      pendingProposal: liveScanState.pendingProposal,
      stockStatus: liveScanState.stockStatus,
      confirmReady: liveScanState.confirmReady,
      lastMutationResult: liveScanState.lastMutationResult,
      traceResult: liveScanState.traceResult,
      suggestedLocation,
      riaSuggestedLocation: riaRecommendation.location,
      riaSuggestedAction: riaRecommendation.action,
      riaSuggestedReason: riaRecommendation.reason,
      selectedStockAction,
      scanVerdict,
      scanVerdictLabel: scanVerdictMeta.title,
      talkback: aiTalkback,
      riaAdvice: liveScanState.riaAdvice,
      statusMessage: liveScanState.riaAdvice,
      recognition: recognition
        ? {
            name: recognition.name,
            category: recognition.category,
            confidence: Math.round(recognition.confidence * 100),
            expiryDays: recognition.expiryDays,
            notes: recognition.notes,
            quantity: recognition.quantity,
            batchCode: recognition.batchCode ?? null,
            lotNumber: recognition.lotNumber ?? null,
          }
        : null,
      relatedInventory: relatedInventoryItems.slice(0, 4).map((item) => ({
        name: item.name,
        location: item.location,
        quantity: item.quantity,
        expiryDays: item.expiryDays,
      })),
      locationSnapshot: {
        totalProducts: locationStockSnapshot.totalProducts,
        totalUnits: locationStockSnapshot.totalUnits,
        expiringSoon: locationStockSnapshot.expiringSoon,
      },
      transportFocus: scanTransportFocus,
      suggestions: smartSuggestions.slice(0, 4),
    }),
    [
      aiTalkback,
      liveScanState,
      locationStockSnapshot.expiringSoon,
      locationStockSnapshot.totalProducts,
      locationStockSnapshot.totalUnits,
      recognition,
      riaRecommendation,
      relatedInventoryItems,
      scanTransportFocus,
      scanMode,
      scanVerdict,
      scanVerdictMeta.title,
      selectedStockAction,
      smartSuggestions,
      suggestedLocation,
    ]
  );

  const scanAccessSummary = useMemo(() => getScanAccessSummary(scanAccess), [scanAccess]);
  const scanAccessRemainingLabel = scanAccessSummary.unlocked
    ? 'Onbeperkt via betaling'
    : `${scanAccessSummary.freeScansLeft} gratis scan${scanAccessSummary.freeScansLeft === 1 ? '' : 's'} over`;
  const scanAccessStatusText = scanAccessSummary.unlocked
    ? 'Betaling is actief. Je kan onbeperkt blijven scannen.'
    : scanAccessSummary.isLocked
      ? 'Je hebt je 15 gratis scans gebruikt. Open betalingen om door te gaan.'
      : `Nog ${scanAccessSummary.freeScansLeft} gratis scan${scanAccessSummary.freeScansLeft === 1 ? '' : 's'} beschikbaar.`;
  const confirmBlockedReason = liveScanState.confirmReady
    ? 'geen blokkade'
    : !auth.ready
      ? 'no session: sessie wordt nog gecontroleerd'
      : !auth.userId
        ? 'no session: gebruiker is niet ingelogd'
        : !auth.companyId || !auth.branchId || !auth.activeMembership?.id || auth.activeMembership?.status !== 'ACTIVE'
          ? 'no membership: actieve company/branch/membership ontbreekt'
          : !liveScanState.productName
            ? scanDetail('scan.confirm.noProduct')
            : !selectedDestination
              ? 'no location: kies eerst een locatie'
              : !selectedMovementType
                ? 'no movement: kies eerst een beweging'
                : !movementPolicyAllowed
                  ? 'policy blocked: beweging niet toegestaan voor deze rol'
                  : isAnalyzing
                    ? 'recognition requested: herkenning loopt nog'
                    : isSavingInventory
                      ? 'stock action: opslag loopt nog'
                      : scanAccessSummary.isLocked
                        ? 'policy blocked: gratis scanlimiet bereikt'
                        : 'confirm blocked: controleer product, locatie en beweging';
  const scanPipelineDebugRows = [
    {
      label: 'barcode detected',
      value: scanned?.data ? `ja (${scanned.data})` : 'nee',
      ok: Boolean(scanned?.data),
    },
    {
      label: 'recognition requested',
      value: scanPipelineDebug.recognitionStatus === 'idle' ? 'nee' : 'ja',
      ok: scanPipelineDebug.recognitionStatus !== 'idle',
    },
    {
      label: 'recognition failed/succeeded',
      value:
        scanPipelineDebug.recognitionStatus === 'succeeded'
          ? 'succeeded'
          : scanPipelineDebug.recognitionStatus === 'failed'
            ? `failed: ${scanPipelineDebug.recognitionError}`
            : scanPipelineDebug.recognitionStatus === 'requested'
              ? 'requested'
              : 'idle',
      ok: scanPipelineDebug.recognitionStatus === 'succeeded',
    },
    {
      label: 'AI requested',
      value: scanPipelineDebug.aiStatus === 'idle' ? 'nee' : 'ja',
      ok: scanPipelineDebug.aiStatus !== 'idle',
    },
    {
      label: 'AI failed/succeeded',
      value:
        scanPipelineDebug.aiStatus === 'succeeded'
          ? 'succeeded'
          : scanPipelineDebug.aiStatus === 'failed'
            ? `failed: ${scanPipelineDebug.aiError}`
            : scanPipelineDebug.aiStatus === 'requested'
              ? 'requested'
              : 'idle',
      ok: scanPipelineDebug.aiStatus === 'succeeded',
    },
    {
      label: 'proposal created',
      value: liveScanState.pendingProposal
        ? `${liveScanState.pendingProposal.productName} -> ${formatScanLocationLabel(
            liveScanState.pendingProposal.location
          )} / ${formatScanMovementTypeLabel(liveScanState.pendingProposal.movement)}`
        : 'nee',
      ok: Boolean(liveScanState.pendingProposal),
    },
    {
      label: 'confirm ready',
      value: liveScanState.confirmReady ? 'ja' : 'nee',
      ok: liveScanState.confirmReady,
    },
    {
      label: 'confirm blocked reason',
      value: confirmBlockedReason,
      ok: liveScanState.confirmReady,
    },
  ];
  const scanStatusLabel = scanned?.data ? 'Barcode herkend' : 'Wachten op scan';
  const scanTimeLabel = formatScanMoment(lastScannedAt);

  useEffect(() => {
    let cancelled = false;

    loadScanAccessState()
      .then((state) => {
        if (!cancelled) {
          setScanAccess(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScanAccess({
            freeScansUsed: 0,
            unlocked: false,
            updatedAt: new Date().toISOString(),
            lastScanAt: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRealAiState('idle');
    setRealAiAnswer(null);
    setRealAiError('');
  }, [recognition?.name, recognition?.category, recognition?.confidence, scanMode, scanned?.data, selectedLocation]);

  const WEB_BARCODE_TYPES: BarcodeType[] = ['qr', 'ean13', 'ean8', 'code128'];
  const barcodeTypes: BarcodeType[] = Platform.OS === 'web' ? WEB_BARCODE_TYPES : NATIVE_BARCODE_TYPES;
  const liveCameraLabel =
    scanMode === 'Kassaticket' ? 'Live ticketcamera' : 'Live productscan';
  const ticketSplit = useMemo(() => {
    if (!recognition || scanMode !== 'Kassaticket') {
      return null;
    }

    const bucket = getTicketBucket(recognition.category, recognition.name);
    const shelfLife = getShelfLifeAdvice(recognition.expiryDays);

    return {
      bucket,
      bucketDetail:
        bucket === 'Zuivel'
        ? 'Het ticket wordt onder zuivel geplaatst voor aparte rotatie en korte houdbaarheid.'
          : bucket === 'Dranken'
            ? 'Het ticket wordt onder dranken geplaatst voor aparte opvolging en bestellijst.'
            : 'Het ticket wordt onder food cost geplaatst voor keuken- en margesturing.',
      shelfLife,
    };
  }, [recognition, scanMode]);

  const automaticTicketLines = useMemo(() => {
    if (scanMode !== 'Kassaticket' || !recognition) {
      return [] as TicketLine[];
    }

    const lines: TicketLine[] = [];
    const seenNames = new Set<string>();
    const preferredUnitPrice = parsePositiveNumber(saleUnitPriceInput);
    const targetBucket = getTicketBucket(recognition.category, recognition.name);

    const addLine = (line: TicketLine) => {
      const normalizedName = line.name.trim().toLowerCase();
      if (!normalizedName || seenNames.has(normalizedName)) {
        return;
      }

      seenNames.add(normalizedName);
      lines.push(line);
    };

    addLine({
      id: `ticket-main-${recognition.name.toLowerCase().replace(/\s+/g, '-')}`,
      itemId: matchedSaleItem?.id ?? null,
      name: recognition.name,
      category: recognition.category,
      quantity: Math.max(1, Math.round(parsePositiveNumber(saleQuantityInput)) || recognition.quantity || 1),
      unitPrice: preferredUnitPrice > 0 ? preferredUnitPrice : estimateUnitPrice(recognition.category, recognition.name),
      location: selectedLocation,
      bucket: targetBucket,
      costBucket: classifyReceiptLineCost(recognition.name, recognition.category),
      sourceLabel: 'Hoofdregel',
    });

    const companionCandidates = items
      .filter((item) => item.location === selectedLocation)
      .filter((item) => item.name.trim().toLowerCase() !== recognition.name.trim().toLowerCase())
      .sort((left, right) => {
        const leftScore = getTicketCandidateScore({
          name: left.name,
          category: left.category,
          location: left.location,
          targetBucket,
          preferredLocation: selectedLocation,
        });
        const rightScore = getTicketCandidateScore({
          name: right.name,
          category: right.category,
          location: right.location,
          targetBucket,
          preferredLocation: selectedLocation,
        });

        return rightScore - leftScore;
      })
      .slice(0, 2);

    companionCandidates.forEach((item, index) => {
      addLine({
        id: `ticket-extra-${item.id}`,
        itemId: item.id,
        name: item.name,
        category: item.category,
        quantity: 1,
        unitPrice: estimateUnitPrice(item.category, item.name),
        location: item.location,
        bucket: getTicketBucket(item.category, item.name),
        costBucket: classifyReceiptLineCost(item.name, item.category),
        sourceLabel: index === 0 ? 'Automatische regel' : 'Extra ticketregel',
      });
    });

    return lines;
  }, [
    items,
    matchedSaleItem?.id,
    recognition,
    saleQuantityInput,
    saleUnitPriceInput,
    scanMode,
    selectedLocation,
  ]);

  const textTicketLines = useMemo(() => {
    if (scanMode !== 'Kassaticket' || !ticketText.trim()) {
      return [] as TicketLine[];
    }

    const barcodeMatch = ticketText.match(/\b\d{8,13}\b/);
    const ticketBarcode = barcodeMatch ? barcodeMatch[0] : null;
    const parsed = parseReceiptText(ticketText).slice(0, 20);

    return parsed.map((line, index) => {
      const bucket = getTicketBucket('Ticket', line.name);
      const matchedItem =
        items.find((item) => item.name.trim().toLowerCase() === line.name.toLowerCase()) ?? null;

      return {
        id: `text-${index}-${line.name.toLowerCase().replace(/\s+/g, '-')}`,
        itemId: matchedItem?.id ?? null,
        name: line.name,
        category: matchedItem?.category ?? bucket,
        quantity: line.quantity,
        unitPrice: line.unitPrice > 0 ? line.unitPrice : estimateUnitPrice(bucket, line.name),
        location: selectedLocation,
        bucket,
        costBucket: line.costBucket,
        sourceLabel: 'Tekstregel',
        barcode: ticketBarcode,
      } as TicketLine;
    });
  }, [items, scanMode, selectedLocation, ticketText]);
  const activeTicketLines = textTicketLines.length > 0 ? textTicketLines : automaticTicketLines;
  const effectiveTicketLines = activeTicketLines.map((line) => ({
    ...line,
    costBucket: ticketCostOverrides[line.id] ?? line.costBucket,
  }));
  const getTicketLineAmount = (line: TicketLine) => line.quantity * (Number.isFinite(line.unitPrice) ? line.unitPrice : 0);
  const ticketTotal = effectiveTicketLines.reduce((sum, line) => sum + getTicketLineAmount(line), 0);
  const totalFoodCost = effectiveTicketLines.reduce(
    (sum, line) => (line.costBucket === 'food_cost' ? sum + getTicketLineAmount(line) : sum),
    0
  );
  const totalBarCost = effectiveTicketLines.reduce(
    (sum, line) => (line.costBucket === 'bar_cost' ? sum + getTicketLineAmount(line) : sum),
    0
  );
  const totalUnknownCost = effectiveTicketLines.reduce(
    (sum, line) => (line.costBucket === 'unknown' ? sum + getTicketLineAmount(line) : sum),
    0
  );
  const hasUnknownTicketLines = effectiveTicketLines.some((line) => line.costBucket === 'unknown');

  const scanAiActions = useMemo<RealAiAvailableAction[]>(() => {
    if (!recognition && !editedName.trim()) return [];

    const actions: RealAiAvailableAction[] = [
      {
        kind: 'scan_use_suggested_location',
        label: `Voorstel locatie: ${formatScanLocationLabel(riaRecommendation.location)}`,
        description: riaRecommendation.reason,
      },
      {
        kind: 'scan_use_suggested_action',
        label: `Voorstel beweging: ${riaSuggestedMovementLabel}`,
        description: 'Alleen advies. De werkvloer kiest de beweging handmatig.',
      },
      {
        kind: 'scan_save_inventory',
        label: 'Mens bevestigt scan',
        description: 'Opslaan blijft geblokkeerd tot locatie en beweging handmatig gekozen zijn.',
      },
    ];

    if (canUseTransportMovement) {
      actions.push({
        kind: 'scan_prepare_transport',
        label: 'Transportvoorstel tonen',
        description: 'Alleen voor chauffeurrol; de chauffeur bevestigt zelf.',
      });
    }

    return actions;
  }, [canUseTransportMovement, editedName, recognition, riaRecommendation.location, riaRecommendation.reason, riaSuggestedMovementLabel]);

  async function runRecognition(input: {
    barcode?: string | null;
    imageBase64?: string | null;
    imageUri?: string | null;
  }) {
    setScanPipelineDebug((current) => ({
      ...current,
      recognitionStatus: 'requested',
      recognitionError: '',
    }));
    setIsAnalyzing(true);
    setSaveMessage('');
    setLastMutationSummary(null);
    setScanVerdict(null);
    setStaffConfirmed(false);
    setConfirmedDestination(null);
    setDestinationChosen(false);
    setTicketCostOverrides({});
    setStatusMessage(
      scanMode === 'Kassaticket'
        ? scanDetail('scan.detail.status.ticketProcessing')
        : scanDetail('scan.detail.status.productProcessing')
    );

    try {
      const rawResult = await recognizeProduct(input);
      const barcode = (input.barcode ?? rawResult.barcode ?? '').trim();
      const smartOutcome =
        scanMode === 'Product'
          ? enhanceRecognitionWithInventory({
              recognition: rawResult,
            items,
            selectedLocation,
            barcode: barcode || null,
          })
          : null;
      const result = smartOutcome?.recognition ?? rawResult;
      const nextVerdict = determineScanVerdict({
        recognition: result,
        matches: smartOutcome?.matches ?? [],
        barcode: barcode || null,
        recallFlag: recallFlag || Boolean(result.recallFlag),
      });
      setRecognition(result);
      setProduct(null);
      setScanVerdict(nextVerdict);
      setAiTalkback(
        scanMode === 'Product'
          ? nextVerdict === 'geldig'
            ? smartOutcome?.talkback ??
              `Scan-assistent: geldig. ${result.name} staat in de database en kan nu worden opgevolgd.`
            : nextVerdict === 'ongeldig'
              ? `Scan-assistent: ongeldig. ${result.name} vraagt controle op recall of verval.`
              : `Scan-assistent: onbekend. ${result.name} staat nog niet vast in de database.`
          : `Scan-assistent: ticketregel ${result.name} onder ${getTicketBucket(
              result.category,
              result.name
            )}. ${getShelfLifeAdvice(result.expiryDays).detail}`
      );
      setStatusMessage(
        scanMode === 'Kassaticket'
          ? nextVerdict === 'opgeslagen'
            ? scanDetail('scan.detail.status.ticketSaved', { productName: result.name })
            : nextVerdict === 'ongeldig'
              ? scanDetail('scan.detail.status.ticketInvalid', { productName: result.name })
              : nextVerdict === 'geldig'
                ? scanDetail('scan.detail.status.ticketValid', { productName: result.name })
                : scanDetail('scan.detail.status.ticketUnknown', { productName: result.name })
          : nextVerdict === 'opgeslagen'
            ? scanDetail('scan.detail.status.productSavedChooseDestination', { productName: result.name })
            : nextVerdict === 'ongeldig'
              ? scanDetail('scan.detail.status.productInvalid', { productName: result.name })
              : nextVerdict === 'geldig'
                ? scanDetail('scan.detail.status.productValid', { productName: result.name })
                : scanDetail('scan.detail.status.productUnknown', { productName: result.name })
      );

      if (scanMode === 'Product') {
        const matches =
          smartOutcome?.matches.map((entry) => entry.item) ??
          items.filter((item) => {
            if (barcode && item.barcode === barcode) return true;
            return (
              item.name.trim().toLowerCase() === result.name.trim().toLowerCase() ||
              item.category.trim().toLowerCase() === result.category.trim().toLowerCase()
            );
          });
        const totalMatchedUnits = matches.reduce((sum, item) => sum + item.quantity, 0);

        const expiryDays = result.expiryDays;
        const confidence = result.confidence;

        if (expiryDays !== null && expiryDays <= 2) {
          addLiveAlertEvent({
            event: 'expiry',
            title: 'Scan: vervalalert',
            detail: `${result.name} - ${expiryDays <= 0 ? 'vandaag opvolgen' : `nog ${expiryDays} dagen`} - ${selectedLocation}`,
            href: '/alerts',
            location: selectedLocation,
          });
        } else if (confidence < 0.75) {
          addLiveAlertEvent({
            event: 'recognition',
            title: 'Scan: controle nodig',
            detail: `${result.name} - zekerheid ${Math.round(confidence * 100)}% - check naam/categorie - ${selectedLocation}`,
            href: '/alerts',
            location: selectedLocation,
          });
        } else if (matches.length > 0 && totalMatchedUnits <= 1) {
          addLiveAlertEvent({
            event: 'restock',
            title: 'Scan: lage stock (match)',
            detail: `${result.name} - match in stock: ${totalMatchedUnits} st. - ${selectedLocation}`,
            href: '/alerts',
            location: selectedLocation,
          });
        }
      }

      if (scanMode === 'Kassaticket' && !ticketText.trim()) {
        const ocrText = await ocrReceipt({
          imageBase64: input.imageBase64 ?? null,
          imageUri: input.imageUri ?? null,
        });

        if (ocrText.trim()) {
          setTicketText(ocrText);
          setStatusMessage(scanDetail('scan.detail.status.receiptRecognized'));
        }
      }
      setScanPipelineDebug((current) => ({
        ...current,
        recognitionStatus: 'succeeded',
        recognitionError: '',
      }));
      focusLocationActionStep();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Live herkenning is niet beschikbaar. Controleer api.taze.to/health en probeer opnieuw.';
      setScanPipelineDebug((current) => ({
        ...current,
        recognitionStatus: 'failed',
        recognitionError: message,
      }));
      const fallbackResult = createManualRecognitionFallback({
        barcode: input.barcode,
        reason: message,
        existingName: editedName,
        existingCategory: editedCategory,
      });
      const fallbackVerdict = determineScanVerdict({
        recognition: fallbackResult,
        matches: [],
        barcode: fallbackResult.barcode,
        recallFlag: false,
      });

      setRecognition(fallbackResult);
      setProduct(null);
      setScanVerdict(fallbackVerdict);
      setEditRecognition(true);
      setStatusMessage(
        fallbackResult.barcode
          ? scanDetail('scan.detail.status.recognitionUnavailableWithBarcode', { barcode: fallbackResult.barcode })
          : scanDetail('scan.detail.status.recognitionUnavailable')
      );
      setAiTalkback(`Scan-assistent: ${message} Handmatige bevestiging blijft beschikbaar.`);
      focusLocationActionStep();
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleTakePhoto() {
    if (!cameraRef.current || isCapturing) {
      if (!cameraRef.current) {
        setCameraPreviewOpen(true);
        setStatusMessage('Camera geopend. Tik opnieuw op AI foto zodra het beeld actief is.');
      }
      return;
    }

    setIsCapturing(true);
    setSaveMessage('');

    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.55,
        base64: true,
      });

      const nextPhoto = {
        uri: picture.uri,
        base64: picture.base64 ?? null,
      };

      setCapturedPhoto(nextPhoto);
      setStatusMessage(
        scanMode === 'Kassaticket'
        ? 'Kassabon genomen. Food cost, bar cost en inkoop worden nu uitgesplitst...'
          : scanned?.data
            ? 'Foto genomen. Barcode en foto worden samen slimmer geanalyseerd...'
            : 'Foto genomen. Productvoorstel wordt bijgewerkt...'
      );

      await runRecognition({
        barcode: scanned?.data ?? null,
        imageBase64: nextPhoto.base64,
        imageUri: nextPhoto.uri,
      });
    } catch {
      setStatusMessage(scanDetail('scan.detail.status.photoCaptureFailed'));
    } finally {
      setIsCapturing(false);
    }
  }

  function handleBarcodeScanned(result: { type?: string; data?: string | null }) {
    const barcode = normalizeBarcodeValue(result.data);
    const lastScannedMs = lastScannedAt ? new Date(lastScannedAt).getTime() : 0;
    const isSameBurst = scanned?.data === barcode && Date.now() - lastScannedMs < 1500;

    if (!barcode || barcodeScanLockRef.current || isSameBurst || isAnalyzing) {
      return;
    }

    barcodeScanLockRef.current = true;
    setScanned({ type: result.type ?? 'barcode', data: barcode });
    setLastScannedAt(new Date().toISOString());
    setManualBarcodeInput(barcode);
    setScanLiveMessage(scanDetail('scan.detail.status.scanSuccess', { barcode }));
    playEvent('recognition', loadSoundSettings()).catch(() => {});
    setStatusMessage(
      capturedPhoto
        ? scanDetail('scan.detail.status.barcodeWithPhoto')
        : scanDetail('scan.detail.status.barcodeTakePhoto')
    );

    void runRecognition({
      barcode,
      imageBase64: capturedPhoto?.base64 ?? null,
      imageUri: capturedPhoto?.uri ?? null,
    });

    setTimeout(() => {
      barcodeScanLockRef.current = false;
      setScanLiveMessage('');
    }, 3000);
  }

  async function handleManualBarcodeScan() {
    const barcode = normalizeBarcodeValue(manualBarcodeInput);
    const manualName = editedName.trim();
    const manualQuantity = Math.max(1, Math.round(parsePositiveNumber(saleQuantityInput)) || 1);

    if (!barcode) {
      Alert.alert(
        scanDetail('scan.detail.alert.barcodeMissing.title'),
        scanDetail('scan.detail.alert.barcodeMissing.body')
      );
      return;
    }

    setScanned({ type: 'manual-barcode', data: barcode });
    setLastScannedAt(new Date().toISOString());
    setCapturedPhoto(null);

    if (manualName) {
      const manualRecognition = createManualRecognitionFallback({
        barcode,
        reason: 'Handmatige code-invoer actief.',
        existingName: manualName,
        existingCategory: editedCategory.trim() || 'Handmatig',
        quantity: manualQuantity,
      });
      const manualVerdict = determineScanVerdict({
        recognition: manualRecognition,
        matches: [],
        barcode,
        recallFlag: false,
      });

      setRecognition(manualRecognition);
      setProduct(null);
      setScanVerdict(manualVerdict);
      setEditRecognition(true);
      setStaffConfirmed(false);
      setConfirmedDestination(null);
      setDestinationChosen(false);
      setTicketCostOverrides({});
      setStatusMessage(
        scanDetail('scan.detail.status.manualProductReady', {
          productName: manualRecognition.name,
          barcode,
        })
      );
      setAiTalkback(
        `Scan-assistent: handmatig product ${manualRecognition.name} staat klaar. Kies een bestemming en bevestig zelf.`
      );
      focusLocationActionStep();
      return;
    }

    setStatusMessage(scanDetail('scan.detail.status.manualBarcodeProcessed', { barcode }));
    await runRecognition({ barcode });
  }

  function buildManualRecognitionFromInputs(reason: string) {
    const barcode = normalizeBarcodeValue(manualBarcodeInput);
    const manualName = editedName.trim();

    if (!manualName) {
      return null;
    }

    return createManualRecognitionFallback({
      barcode: barcode || null,
      reason,
      existingName: manualName,
      existingCategory: editedCategory.trim() || 'Handmatig',
      quantity: Math.max(1, Math.round(parsePositiveNumber(saleQuantityInput)) || 1),
    });
  }

  async function confirmDestination(destination: ScanDestination | null, movementType: ScanMovementType | null = selectedMovementType) {
    if (isSavingInventory) {
      return;
    }

    if (!destination) {
      const message = scanDetail('scan.detail.alert.locationMissing.body', { prompt: SCAN_DESTINATION_PROMPT });
      Alert.alert(scanDetail('scan.detail.alert.locationMissing.title'), message);
      setStatusMessage(message);
      return;
    }

    const targetLocation = PRODUCT_SCAN_DESTINATIONS.find((item) => item.value === destination)?.location ?? '';
    const destinationValue = getScanDestinationValue(targetLocation);
    let activeRecognition = recognition;

    if (!destinationValue || !movementType) {
      Alert.alert(
        scanDetail('scan.detail.alert.locationMovementMissing.title'),
        scanDetail('scan.detail.alert.locationMovementMissing.body')
      );
      setStatusMessage(scanDetail('scan.detail.alert.locationMovementMissing.body'));
      return;
    }

    if (!activeRecognition) {
      activeRecognition = buildManualRecognitionFromInputs('Handmatige live voorraadactie.');
      if (!activeRecognition) {
        Alert.alert(scanDetail('scan.detail.alert.missing.title'), scanDetail('scan.detail.alert.missingProductName.body'));
        return;
      }

      const manualBarcode = activeRecognition.barcode ?? normalizeBarcodeValue(manualBarcodeInput);
      if (manualBarcode) {
        setScanned({ type: 'manual-barcode', data: manualBarcode });
        setLastScannedAt(new Date().toISOString());
      }
      setCapturedPhoto(null);
      setRecognition(activeRecognition);
      setProduct(null);
      setScanVerdict(
        determineScanVerdict({
          recognition: activeRecognition,
          matches: [],
          barcode: activeRecognition.barcode,
          recallFlag: false,
        })
      );
    }

    const confirmedBarcode = normalizeBarcodeValue(manualBarcodeInput);
    if (confirmedBarcode) {
      setScanned({ type: scanned?.type ?? 'manual-barcode', data: confirmedBarcode });
      setLastScannedAt((value) => value ?? new Date().toISOString());
    }

    setIsSavingInventory(true);
    setStaffConfirmed(true);
    setConfirmedDestination(targetLocation);
    setSaveMessage('');
    setStatusMessage(
      movementType === 'intake' || movementType === 'transport'
        ? scanDetail('scan.detail.status.savingToLocation', {
            movement: formatScanMovementTypeLabel(movementType),
            location: formatScanLocationLabel(targetLocation),
          })
        : movementType === 'correction'
          ? scanDetail('scan.detail.status.savingInLocation', {
              movement: formatScanMovementTypeLabel(movementType),
              location: formatScanLocationLabel(targetLocation),
            })
          : scanDetail('scan.detail.status.savingFromLocation', {
              movement: formatScanMovementTypeLabel(movementType),
              location: formatScanLocationLabel(targetLocation),
            })
    );

    try {
      await handleSaveInventory({
        confirmedByStaff: true,
        destination: targetLocation,
        movementType,
        recognitionOverride: activeRecognition,
      });
    } finally {
      setIsSavingInventory(false);
    }
  }

  async function handleSaveInventory(options: {
    confirmedByStaff?: boolean;
    destination?: string;
    movementType?: ScanMovementType;
    recognitionOverride?: RecognitionResult;
  } = {}) {
    if (!auth.ready) {
      setStatusMessage('Sessie wordt nog gecontroleerd. Wacht even voordat je opslaat.');
      return false;
    }

    if (!auth.userId) {
      setStatusMessage('Log in om deze voorraadbeweging echt in Supabase op te slaan.');
      router.push('/account');
      return false;
    }

    const activeRecognition = options.recognitionOverride ?? recognition;

    if (!activeRecognition) {
      return false;
    }

    const targetLocation = options.destination?.trim() || confirmedDestination?.trim() || '';
    const targetTemperatureLabel = formatColdLocationTemperatureLabel(targetLocation, coldLocationTemperatures);
    const destinationValue = getScanDestinationValue(targetLocation);
    const confirmedMovementType = options.movementType ?? selectedMovementType;
    const confirmedMovementAction = confirmedMovementType ? getScanStockActionFromMovementType(confirmedMovementType) : null;
    const confirmedMovementLabel = confirmedMovementType ? formatScanMovementTypeLabel(confirmedMovementType) : null;
    const hasExplicitConfirmation = Boolean(options.confirmedByStaff || (staffConfirmed && targetLocation));

    if (!hasExplicitConfirmation || !targetLocation || !destinationValue || !confirmedMovementType || !confirmedMovementAction) {
      setStatusMessage(scanDetail('scan.detail.alert.locationMovementMissing.body'));
      return false;
    }

    if (scanAccessSummary.isLocked) {
      setStatusMessage('Je hebt de 15 gratis scans gebruikt. Open betalingen om verder te gaan.');
      router.push('/payments');
      return false;
    }

    const productName = editedName.trim() || activeRecognition.name;
    const productCategory = editedCategory.trim() || activeRecognition.category || 'Handmatig';
    const confirmedBarcode = normalizeBarcodeValue(manualBarcodeInput) || scanned?.data || activeRecognition.barcode || null;
    const hasManualProductFallback = Boolean(productName.trim() && activeRecognition.source === 'manual');
    if (!confirmedBarcode && !capturedPhoto?.uri && !hasManualProductFallback) {
      setStatusMessage('Scan eerst een barcode, neem een foto of vul productnaam handmatig in voordat je live opslaat.');
      return false;
    }

    const quantity = Math.max(
      1,
      Math.round(parsePositiveNumber(saleQuantityInput)) || Math.round(activeRecognition.quantity ?? 1) || 1
    );
    const parsedUnitPrice = parsePositiveNumber(saleUnitPriceInput);
    const inventoryUnitPrice = parsedUnitPrice > 0 ? parsedUnitPrice : null;
    const priceAuditLabel = formatTracePrice(inventoryUnitPrice);
    const priceMissingLabel = inventoryUnitPrice === null ? ' | prijs ontbreekt' : '';
    const recognitionAuditSource = getRecognitionAuditSource(activeRecognition);
    const confirmedByUser = auth.email ?? auth.userId;
    const auditStatus = getScanAuditStatus(activeRecognition, confirmedMovementAction);
    const auditNote = (
      baseNote: string,
      previousLocation: string | null = null,
      statusOverride: 'saved' | 'needs_review' | 'needs_reorder' = auditStatus
    ) =>
      buildScanAuditNote({
        baseNote,
        productName,
        productCategory,
        recognitionSource: recognitionAuditSource,
        recognitionConfidence: activeRecognition.confidence ?? null,
        aiSuggestedLocation: riaRecommendation.location,
        aiSuggestedAction: riaRecommendation.action,
        aiSuggestedReason: riaRecommendation.reason,
        confirmedLocation: targetLocation,
        confirmedAction: confirmedMovementAction,
        confirmedByUser,
        confirmedByRole: auth.role,
        previousLocation,
        quantity,
        recognitionPhotoUri: capturedPhoto?.uri ?? null,
        proofPhotoUri: capturedPhoto?.uri ?? null,
        auditStatus: statusOverride,
      }) + ` | destination_location=${destinationValue}${targetTemperatureLabel ? ` | temperature=${targetTemperatureLabel}` : ''}`;

    if (scanMode === 'Product' && confirmedMovementType === 'transport') {
      if (!canUseTransportMovement) {
        setStatusMessage('Transport registreren kan alleen met de rol Chauffeur.');
        return false;
      }

      const sourceItem =
        relatedInventoryItems.find((item) => item.location !== targetLocation) ??
        relatedInventoryItems.find((item) => item.location === targetLocation) ??
        null;

      if (!sourceItem) {
        setStatusMessage(`${productName} bestaat nog niet in voorraad. Gebruik eerst Inkoop / Toegevoegd.`);
        return false;
      }

      if (sourceItem.location === targetLocation) {
        setStatusMessage(`Kies een andere bestemming dan ${formatScanLocationLabel(sourceItem.location)} voor transport.`);
        return false;
      }

      if (sourceItem.quantity < quantity) {
        setStatusMessage(
          `Te weinig voorraad in ${formatScanLocationLabel(sourceItem.location)}: gevraagd ${quantity}, beschikbaar ${sourceItem.quantity}.`
        );
        return false;
      }

      const movementValue = sourceItem.unitPrice === null ? null : quantity * sourceItem.unitPrice;
      const unitLabel = getInventoryUnitLabel(sourceItem);
      const traceMovementNote = `${productName} - Transport / Vervoer - ${quantity} ${unitLabel} - ${sourceItem.location} naar ${targetLocation}${
        movementValue === null ? '' : ` - ${formatTracePrice(movementValue)}`
      }`;
      const mutationResult = transferStock({
        itemId: sourceItem.id,
        toLocation: targetLocation,
        quantity,
        note: auditNote(traceMovementNote, sourceItem.location),
        source: recognitionAuditSource,
      });

      if (!mutationResult.ok) {
        setStatusMessage(
          mutationResult.reason === 'same-location'
            ? `Kies een andere bestemming dan ${formatScanLocationLabel(sourceItem.location)} voor transport.`
            : `${productName} kon niet naar ${formatScanLocationLabel(targetLocation)} worden verplaatst.`
        );
        return false;
      }

      const inventorySync = await persistInventoryStateToCloudNow();
      if (!inventorySync.ok) {
        setStatusMessage(
          `Supabase inventory-opslag niet bevestigd (${inventorySync.error ?? 'sync mislukt'}). Geen productieproof opgeslagen.`
        );
        return false;
      }

      const traceEventId = createScanProofId('trace-transport');
      const traceEvents = await appendTraceEvent({
        id: traceEventId,
        eventKind: 'transfer',
        itemId: sourceItem.id,
        itemName: sourceItem.name,
        location: targetLocation,
        fromLocation: sourceItem.location,
        toLocation: targetLocation,
        quantity: mutationResult.movedQuantity,
        source: recognitionAuditSource,
        barcode: confirmedBarcode ?? sourceItem.barcode ?? null,
        batchCode: editedBatch.trim() || sourceItem.batchCode || null,
        lotNumber: editedLot.trim() || sourceItem.lotNumber || null,
        confidence: activeRecognition.confidence ?? sourceItem.confidence ?? null,
        expiryDays: activeRecognition.expiryDays ?? sourceItem.expiryDays ?? null,
        note: auditNote(traceMovementNote, sourceItem.location),
      });
      const syncedTraceEvent = traceEvents.find((entry) => entry.id === traceEventId && entry.syncState === 'synced');
      if (!syncedTraceEvent) {
        setStatusMessage('Supabase audit-opslag niet bevestigd. Controleer trace_events voordat je dit als productieproof gebruikt.');
        return false;
      }
      await writeColdLocationTemperatureLog({
        traceEventId,
        location: targetLocation,
        productName,
        note: traceMovementNote,
      });

      const nextScanAccess = await recordScanAccessUsage(scanAccess);
      const recordedAt = new Date().toISOString();
      setScanAccess(nextScanAccess);
      setScanVerdict('opgeslagen');
      setLastMutationSummary({
        actionLabel: confirmedMovementLabel ?? undefined,
        productName,
        category: productCategory,
        barcode: confirmedBarcode ?? sourceItem.barcode ?? null,
        userLabel: confirmedByUser,
        fromLabel: sourceItem.location,
        toLabel: targetLocation,
        quantity: mutationResult.movedQuantity,
        confirmationLabel: 'Bevestigd',
        resultDeltas: [
          { label: sourceItem.location, amount: -mutationResult.movedQuantity },
          { label: targetLocation, amount: mutationResult.movedQuantity },
        ],
        recordedAt,
        expiryDate: sourceItem.expiryDate,
        expiryStatus: sourceItem.expiryStatus,
        recommendedAction: confirmedMovementLabel ?? undefined,
        recommendedReason: riaRecommendation.reason,
      });
      setSaveMessage(
        `Scan live opgeslagen: ${productName} - Transport / Vervoer - ${formatScanLocationLabel(sourceItem.location)} naar ${formatScanLocationLabel(
          targetLocation
        )} - ${formatScanMoment(recordedAt)} - ${confirmedByUser}.`
      );
      setStatusMessage(`Transport bevestigd naar ${formatScanLocationLabel(targetLocation)}.`);
      return true;
    }

    if (scanMode === 'Product' && confirmedMovementType === 'correction') {
      const sourceItem =
        relatedInventoryItems.find((item) => item.location === targetLocation) ??
        relatedInventoryItems[0] ??
        null;

      if (!sourceItem) {
        setStatusMessage(`${productName} bestaat nog niet in voorraad. Gebruik eerst Inkoop / Toegevoegd.`);
        return false;
      }

      const traceMovementNote = `${productName} - Correctie - ${quantity} ${getInventoryUnitLabel(sourceItem)} - ${targetLocation}`;
      const correctionResult = updateInventoryItemCorrection({
        itemId: sourceItem.id,
        name: productName,
        category: productCategory,
        location: targetLocation,
        quantity,
        note: auditNote(traceMovementNote, sourceItem.location),
        source: recognitionAuditSource,
      });

      if (!correctionResult.ok) {
        setStatusMessage('Correctie kon niet worden opgeslagen. Controleer product, categorie en locatie.');
        return false;
      }

      const inventorySync = await persistInventoryStateToCloudNow();
      if (!inventorySync.ok) {
        setStatusMessage(
          `Supabase inventory-opslag niet bevestigd (${inventorySync.error ?? 'sync mislukt'}). Geen productieproof opgeslagen.`
        );
        return false;
      }

      const traceEventId = createScanProofId('trace-correction');
      const traceEvents = await appendTraceEvent({
        id: traceEventId,
        eventKind: 'inventory_mutation',
        itemId: sourceItem.id,
        itemName: productName,
        location: targetLocation,
        fromLocation: sourceItem.location,
        toLocation: targetLocation,
        quantity,
        source: recognitionAuditSource,
        barcode: confirmedBarcode ?? sourceItem.barcode ?? null,
        batchCode: editedBatch.trim() || sourceItem.batchCode || null,
        lotNumber: editedLot.trim() || sourceItem.lotNumber || null,
        confidence: activeRecognition.confidence ?? sourceItem.confidence ?? null,
        expiryDays: activeRecognition.expiryDays ?? sourceItem.expiryDays ?? null,
        note: auditNote(traceMovementNote, sourceItem.location, 'needs_review'),
      });
      const syncedTraceEvent = traceEvents.find((entry) => entry.id === traceEventId && entry.syncState === 'synced');
      if (!syncedTraceEvent) {
        setStatusMessage('Supabase audit-opslag niet bevestigd. Controleer trace_events voordat je dit als productieproof gebruikt.');
        return false;
      }
      await writeColdLocationTemperatureLog({
        traceEventId,
        location: targetLocation,
        productName,
        note: traceMovementNote,
      });

      const nextScanAccess = await recordScanAccessUsage(scanAccess);
      const recordedAt = new Date().toISOString();
      setScanAccess(nextScanAccess);
      setScanVerdict('opgeslagen');
      setLastMutationSummary({
        actionLabel: confirmedMovementLabel ?? undefined,
        productName,
        category: productCategory,
        barcode: confirmedBarcode ?? sourceItem.barcode ?? null,
        userLabel: confirmedByUser,
        fromLabel: sourceItem.location,
        toLabel: targetLocation,
        quantity,
        confirmationLabel: 'Bevestigd',
        resultDeltas: [{ label: targetLocation, amount: quantity - sourceItem.quantity }],
        recordedAt,
        expiryDate: correctionResult.item.expiryDate,
        expiryStatus: correctionResult.item.expiryStatus,
        recommendedAction: confirmedMovementLabel ?? undefined,
        recommendedReason: 'Menselijke correctie bevestigd en traceerbaar opgeslagen.',
      });
      setSaveMessage(
        `Scan live opgeslagen: ${productName} - Correctie - ${formatScanLocationLabel(targetLocation)} - ${formatScanMoment(
          recordedAt
        )} - ${confirmedByUser}.`
      );
      setStatusMessage(`Correctie bevestigd voor ${formatScanLocationLabel(targetLocation)}.`);
      return true;
    }

    if (scanMode === 'Product' && (confirmedMovementType === 'consumption' || confirmedMovementType === 'waste')) {
      const sourceItem = relatedInventoryItems.find((item) => item.location === targetLocation) ?? null;

      if (!sourceItem) {
        setStatusMessage(`${productName} bestaat niet in ${formatScanLocationLabel(targetLocation)}. Verbruik/Afval kan alleen uit bestaande voorraad.`);
        return false;
      }

      if (sourceItem.quantity < quantity) {
        setStatusMessage(
          `Te weinig voorraad in ${formatScanLocationLabel(targetLocation)}: gevraagd ${quantity}, beschikbaar ${sourceItem.quantity}.`
        );
        return false;
      }

      const isWasteAction = confirmedMovementType === 'waste';
      const movementValue = sourceItem.unitPrice === null ? null : quantity * sourceItem.unitPrice;
      const unitLabel = getInventoryUnitLabel(sourceItem);
      const traceMovementNote = `${productName} - ${confirmedMovementLabel} - ${quantity} ${unitLabel} - ${sourceItem.location}${
        movementValue === null ? '' : ` - ${formatTracePrice(movementValue)}`
      }`;
      const mutationResult = isWasteAction
        ? recordWaste({
            itemId: sourceItem.id,
            quantity,
            location: sourceItem.location,
            note: auditNote(traceMovementNote, sourceItem.location),
            source: recognitionAuditSource,
          })
        : consumeStock({
            itemId: sourceItem.id,
            quantity,
            note: auditNote(traceMovementNote, sourceItem.location),
            source: recognitionAuditSource,
          });

      if (!mutationResult.ok) {
        if (mutationResult.reason === 'insufficient-stock') {
          setStatusMessage(
            `Te weinig voorraad in ${formatScanLocationLabel(targetLocation)}: beschikbaar ${mutationResult.availableQuantity}.`
          );
        } else if (mutationResult.reason === 'location-mismatch') {
          const actualLocation = 'itemLocation' in mutationResult ? mutationResult.itemLocation : targetLocation;
          setStatusMessage(
            `Kan waste niet registreren: ${productName} staat in ${formatScanLocationLabel(
              actualLocation
            )}, niet in ${formatScanLocationLabel(targetLocation)}.`
          );
        } else {
          setStatusMessage(`${productName} bestaat niet in ${formatScanLocationLabel(targetLocation)}. Verbruik/Afval is geblokkeerd.`);
        }
        return false;
      }

      const inventorySync = await persistInventoryStateToCloudNow();
      if (!inventorySync.ok) {
        setStatusMessage(
          `Supabase inventory-opslag niet bevestigd (${inventorySync.error ?? 'sync mislukt'}). Geen productieproof opgeslagen.`
        );
        return false;
      }

      const changedQuantity = 'wastedQuantity' in mutationResult ? mutationResult.wastedQuantity : mutationResult.usedQuantity;
      const remainingQuantity = mutationResult.remainingQuantity;
      const actionStatus = remainingQuantity <= 0 ? 'needs_reorder' : auditStatus;
      const traceEventId = createScanProofId(isWasteAction ? 'trace-waste' : 'trace-consume');
      const traceEvents = await appendTraceEvent({
        id: traceEventId,
        eventKind: isWasteAction ? 'waste' : 'consume',
        itemId: sourceItem.id,
        itemName: sourceItem.name,
        location: sourceItem.location,
        fromLocation: sourceItem.location,
        toLocation: isWasteAction ? 'Afval' : sourceItem.location,
        quantity: changedQuantity,
        source: recognitionAuditSource,
        barcode: confirmedBarcode ?? sourceItem.barcode ?? null,
        batchCode: editedBatch.trim() || sourceItem.batchCode || null,
        lotNumber: editedLot.trim() || sourceItem.lotNumber || null,
        confidence: activeRecognition.confidence ?? sourceItem.confidence ?? null,
        expiryDays: activeRecognition.expiryDays ?? sourceItem.expiryDays ?? null,
        note: auditNote(traceMovementNote, sourceItem.location, actionStatus),
      });
      const syncedTraceEvent = traceEvents.find((entry) => entry.id === traceEventId && entry.syncState === 'synced');
      if (!syncedTraceEvent) {
        setStatusMessage('Supabase audit-opslag niet bevestigd. Controleer trace_events voordat je dit als productieproof gebruikt.');
        return false;
      }
      await writeColdLocationTemperatureLog({
        traceEventId,
        location: sourceItem.location,
        productName,
        note: traceMovementNote,
      });

      const nextScanAccess = await recordScanAccessUsage(scanAccess);
      const recordedAt = new Date().toISOString();
      setScanAccess(nextScanAccess);
      setScanVerdict('opgeslagen');
      setLastMutationSummary({
        actionLabel: confirmedMovementLabel ?? undefined,
        productName,
        category: productCategory,
        barcode: confirmedBarcode ?? sourceItem.barcode ?? null,
        userLabel: confirmedByUser,
        fromLabel: sourceItem.location,
        toLabel: sourceItem.location,
        quantity: changedQuantity,
        confirmationLabel: remainingQuantity <= 0 ? 'Controle/bijbestellen nodig' : 'Bevestigd',
        resultDeltas: [
          { label: sourceItem.location, amount: -changedQuantity },
          ...(isWasteAction ? [{ label: 'Afval', amount: changedQuantity }] : []),
        ],
        recordedAt,
        expiryDate: sourceItem.expiryDate,
        expiryStatus: sourceItem.expiryStatus,
        recommendedAction: remainingQuantity <= 0 ? 'Bijbestellen nodig' : confirmedMovementLabel ?? undefined,
        recommendedReason:
          remainingQuantity <= 0
            ? `${productName} staat op 0 na ${(confirmedMovementLabel ?? 'verbruik').toLowerCase()}.`
            : riaRecommendation.reason,
      });

      setSaveMessage(
        `Scan live opgeslagen: ${productName} - barcode ${confirmedBarcode ?? sourceItem.barcode ?? 'geen'} - ${formatScanLocationLabel(
          sourceItem.location
        )} - ${formatScanMoment(recordedAt)} - ${confirmedByUser}.`
      );
      setStatusMessage(
        remainingQuantity <= 0
          ? `${confirmedMovementLabel} bevestigd. Voorraad is 0: controle/bijbestellen nodig.`
          : `${confirmedMovementLabel} bevestigd. Restvoorraad: ${remainingQuantity}.`
      );
      return true;
    }

    if (confirmedMovementType !== 'intake') {
      setStatusMessage('Onbekende scanbeweging. Kies Inkoop, Verbruik, Afval, Correctie of Transport.');
      return false;
    }

    const result = addOrMergeInventoryItem({
      name: productName,
      category: productCategory,
      location: targetLocation,
      quantity,
      expiryDays: activeRecognition.expiryDays,
      confidence: activeRecognition.confidence,
      notes: activeRecognition.notes,
      barcode: confirmedBarcode,
      photoUri: capturedPhoto?.uri ?? null,
      batchCode: editedBatch.trim() || null,
      lotNumber: editedLot.trim() || null,
      recallFlag,
      unitPrice: inventoryUnitPrice,
      source: scanMode === 'Kassaticket' ? `ticket - ${recognitionAuditSource}` : recognitionAuditSource,
    });

    registerInventoryIntakeFollowUps({
      itemId: result.itemId,
      itemName: productName,
      location: targetLocation,
      expiryDays: activeRecognition.expiryDays,
      confidence: activeRecognition.confidence,
      recallFlag,
      mode: result.mode,
      matchedBy: result.matchedBy,
    });
    const inventorySync = await persistInventoryStateToCloudNow();
    if (!inventorySync.ok) {
      setStatusMessage(
        `Supabase inventory-opslag niet bevestigd (${inventorySync.error ?? 'sync mislukt'}). Geen productieproof opgeslagen.`
      );
      return false;
    }

    const previousLocation =
      relatedInventoryItems.find((item) => item.location !== targetLocation)?.location ??
      (result.mode === 'merged' ? targetLocation : null);
    const traceEventId = createScanProofId('trace-scan');
    const traceEvents = await appendTraceEvent({
      id: traceEventId,
      eventKind: 'scan_saved',
      itemId: result.itemId,
      itemName: productName,
      location: targetLocation,
      fromLocation: null,
      toLocation: targetLocation,
      quantity,
      source: scanMode === 'Kassaticket' ? `ticket-${recognitionAuditSource}` : recognitionAuditSource,
      barcode: confirmedBarcode,
      batchCode: editedBatch.trim() || null,
      lotNumber: editedLot.trim() || null,
      confidence: activeRecognition.confidence ?? null,
      expiryDays: activeRecognition.expiryDays ?? null,
      note: auditNote(
        result.mode === 'merged'
          ? `${productName} - Inkoop - ${priceAuditLabel} - naar ${targetLocation}${priceMissingLabel} - samengevoegd`
          : `${productName} - Inkoop - ${priceAuditLabel} - naar ${targetLocation}${priceMissingLabel}`,
        previousLocation
      ),
    });
    const syncedTraceEvent = traceEvents.find((entry) => entry.id === traceEventId && entry.syncState === 'synced');
    if (!syncedTraceEvent) {
      setStatusMessage('Supabase audit-opslag niet bevestigd. Controleer trace_events voordat je dit als productieproof gebruikt.');
      return false;
    }
    await writeColdLocationTemperatureLog({
      traceEventId,
      location: targetLocation,
      productName,
      note:
        result.mode === 'merged'
          ? `${productName} - Inkoop - ${priceAuditLabel} - naar ${targetLocation}${priceMissingLabel} - samengevoegd`
          : `${productName} - Inkoop - ${priceAuditLabel} - naar ${targetLocation}${priceMissingLabel}`,
    });

    const nextScanAccess = await recordScanAccessUsage(scanAccess);
    const recordedAt = new Date().toISOString();
    setScanAccess(nextScanAccess);
    setScanVerdict('opgeslagen');
    setLastMutationSummary({
      productName,
      category: productCategory,
      barcode: confirmedBarcode,
      userLabel: confirmedByUser,
      actionLabel: confirmedMovementLabel ?? undefined,
      fromLabel: 'Ontvangst',
      toLabel: targetLocation,
      quantity,
      confirmationLabel: 'Bevestigd',
      resultDeltas: [{ label: targetLocation, amount: quantity }],
      recordedAt,
      recommendedAction: confirmedMovementLabel ?? undefined,
      recommendedReason: riaRecommendation.reason,
    });

    setSaveMessage(
      `Scan live opgeslagen: ${productName} - barcode ${confirmedBarcode ?? 'geen'} - ${formatScanLocationLabel(
        targetLocation
      )} - ${formatScanMoment(recordedAt)} - ${confirmedByUser}.`
    );
    setStatusMessage(
      result.mode === 'merged'
        ? scanDetail(result.matchedBy === 'barcode' ? 'scan.detail.status.scanSavedMergedBarcode' : 'scan.detail.status.scanSavedMergedName')
        : scanDetail('scan.detail.status.scanSaved')
    );
    if (getScanAccessSummary(nextScanAccess).isLocked) {
      setStatusMessage(scanDetail('scan.detail.status.freeScansEnded'));
    }
    return true;
  }

  async function handleSaveMultiFromPhoto() {
    if (scanMode !== 'Product' || !recognition || multiSaveBusy) {
      return;
    }

    if (scanAccessSummary.isLocked) {
      setStatusMessage('Je hebt de 15 gratis scans gebruikt. Open betalingen om verder te gaan.');
      router.push('/payments');
      return;
    }

    setMultiSaveBusy(true);
    const parsedUnitPrice = parsePositiveNumber(saleUnitPriceInput);
    const inventoryUnitPrice = parsedUnitPrice > 0 ? parsedUnitPrice : null;
    const companions = relatedInventoryItems
      .filter((item) => item.name.trim().toLowerCase() !== recognition.name.trim().toLowerCase())
      .slice(0, 2);

    const primaryResult = addOrMergeInventoryItem({
      name: recognition.name,
      category: recognition.category,
      location: selectedLocation,
      quantity: recognition.quantity,
      expiryDays: recognition.expiryDays,
      confidence: recognition.confidence,
      notes: recognition.notes,
      barcode: scanned?.data ?? recognition.barcode ?? null,
      photoUri: capturedPhoto?.uri ?? null,
      batchCode: editedBatch.trim() || null,
      lotNumber: editedLot.trim() || null,
      recallFlag,
      unitPrice: inventoryUnitPrice,
      source: 'foto-multi',
    });

    registerInventoryIntakeFollowUps({
      itemId: primaryResult.itemId,
      itemName: recognition.name,
      location: selectedLocation,
      expiryDays: recognition.expiryDays,
      confidence: recognition.confidence,
      recallFlag,
      mode: primaryResult.mode,
      matchedBy: primaryResult.matchedBy,
    });
    const primaryQuantity = Math.max(1, Math.round(recognition.quantity ?? 1));
    appendTraceEvent({
      eventKind: 'scan_saved',
      itemId: primaryResult.itemId,
      itemName: recognition.name,
      location: selectedLocation,
      fromLocation: null,
      toLocation: selectedLocation,
      quantity: primaryQuantity,
      source: 'foto-multi',
      barcode: scanned?.data ?? recognition.barcode ?? null,
      batchCode: editedBatch.trim() || null,
      lotNumber: editedLot.trim() || null,
      confidence: recognition.confidence ?? null,
      expiryDays: recognition.expiryDays ?? null,
      note:
        primaryResult.mode === 'merged'
          ? `${recognition.name} - Inkoop - ${formatTracePrice(inventoryUnitPrice)} - naar ${selectedLocation}${
              inventoryUnitPrice === null ? ' | prijs ontbreekt' : ''
            } - samengevoegd`
          : `${recognition.name} - Inkoop - ${formatTracePrice(inventoryUnitPrice)} - naar ${selectedLocation}${
              inventoryUnitPrice === null ? ' | prijs ontbreekt' : ''
            }`,
    }).catch(() => {});

    let mergedCount = primaryResult.mode === 'merged' ? 1 : 0;
    companions.forEach((item) => {
      const result = addOrMergeInventoryItem({
        name: item.name,
        category: item.category,
        location: item.location,
        quantity: 1,
        expiryDays: item.expiryDays,
        confidence: item.confidence,
        notes: 'Toegevoegd als extra product uit dezelfde foto.',
        barcode: item.barcode,
        photoUri: capturedPhoto?.uri ?? null,
        unitPrice: item.unitPrice,
        source: 'foto-multi',
      });
      if (result.mode === 'merged') {
        mergedCount += 1;
      }

      registerInventoryIntakeFollowUps({
        itemId: result.itemId,
        itemName: item.name,
        location: item.location,
        expiryDays: item.expiryDays,
        confidence: item.confidence,
        recallFlag: item.recallFlag,
        mode: result.mode,
        matchedBy: result.matchedBy,
      });
      appendTraceEvent({
        eventKind: 'scan_saved',
        itemId: result.itemId,
        itemName: item.name,
        location: item.location,
        fromLocation: null,
        toLocation: item.location,
        quantity: 1,
        source: 'foto-multi',
        barcode: item.barcode ?? null,
        batchCode: item.batchCode ?? null,
        lotNumber: item.lotNumber ?? null,
        confidence: item.confidence ?? null,
        expiryDays: item.expiryDays ?? null,
        note: result.mode === 'merged' ? 'Extra fotoproduct samengevoegd' : 'Extra fotoproduct opgeslagen',
      }).catch(() => {});
    });

    setSaveMessage(`Opgeslagen: ${1 + companions.length} producten verwerkt, waarvan ${mergedCount} samengevoegd.`);
    setLastMutationSummary({
      productName: recognition.name,
      fromLabel: 'Ontvangst',
      toLabel: selectedLocation,
      quantity: primaryQuantity,
      confirmationLabel: 'Bevestigd',
      resultDeltas: [{ label: selectedLocation, amount: primaryQuantity }],
      recordedAt: new Date().toISOString(),
    });
    setScanVerdict('opgeslagen');
    setStatusMessage("Opgeslagen: voorraad en herkenning zijn bijgewerkt met meerdere foto's.");
    const nextScanAccess = await recordScanAccessUsage(scanAccess);
    setScanAccess(nextScanAccess);
    if (getScanAccessSummary(nextScanAccess).isLocked) {
      setStatusMessage('Je 15 gratis scans zijn nu op. Open betalingen om te blijven werken.');
    }
    setMultiSaveBusy(false);
  }

  async function handleRegisterReceiptPurchase() {
    if (!recognition) {
      return false;
    }

    if (scanAccessSummary.isLocked) {
      setStatusMessage('Je hebt de 15 gratis scans gebruikt. Open betalingen om verder te gaan.');
      router.push('/payments');
      return false;
    }

    const quantity = parsePositiveNumber(saleQuantityInput);
    const unitPrice = parsePositiveNumber(saleUnitPriceInput);

    if (!(quantity > 0)) {
      setStatusMessage('Geef een geldig aantal in voor de kassabon.');
      return false;
    }

    const costBucket = classifyReceiptLineCost(recognition.name, recognition.category);
    if (costBucket === 'unknown') {
      setStatusMessage('Controle nodig: bevestig onbekende kassabonregel eerst als Food cost of Bar cost.');
      return false;
    }

    const result = registerBatchReceiptPurchases([{
      itemId: matchedSaleItem?.id ?? null,
      itemName: recognition.name,
      category: recognition.category,
      location: selectedLocation,
      quantity,
      unitPrice,
      barcode: scanned?.data ?? recognition.barcode ?? null,
      source: 'receipt-purchase',
      costBucket,
    }]);

    if (!result.ok) {
      setStatusMessage('De inkoop kon nog niet verwerkt worden. Probeer opnieuw na een nieuwe scan.');
      return false;
    }

    const inventorySync = await persistInventoryStateToCloudNow();
    if (!inventorySync.ok) {
      setStatusMessage(`Supabase app_state sync niet bevestigd (${inventorySync.error ?? 'sync mislukt'}). Geen productieproof tonen.`);
      return false;
    }

    const selectedTemperatureLabel = formatColdLocationTemperatureLabel(selectedLocation, coldLocationTemperatures);
    const traceEventId = createScanProofId('trace-receipt-purchase');
    const traceEvents = await appendTraceEvent({
      id: traceEventId,
      eventKind: 'inventory_mutation',
      itemId: matchedSaleItem?.id ?? null,
      itemName: recognition.name,
      location: selectedLocation,
      fromLocation: null,
      toLocation: selectedLocation,
      quantity: Math.max(1, Math.round(quantity)),
      source: 'receipt-purchase',
      barcode: scanned?.data ?? recognition.barcode ?? null,
      batchCode: recognition.batchCode ?? null,
      lotNumber: recognition.lotNumber ?? null,
      confidence: recognition.confidence ?? null,
      expiryDays: recognition.expiryDays ?? null,
      note: [
        `${recognition.name} - Inkoop - ${formatTracePrice(unitPrice > 0 ? unitPrice : null)} - naar ${selectedLocation}`,
        `action=Inkoop`,
        `destination=${selectedLocation}`,
        selectedTemperatureLabel ? `temperature=${selectedTemperatureLabel}` : null,
        `cost_bucket=${costBucket}`,
        unitPrice > 0 ? `unit_price=${unitPrice.toFixed(2)}` : 'prijs ontbreekt',
        `amount=${(quantity * unitPrice).toFixed(2)}`,
      ].filter(Boolean).join(' | '),
    });
    const syncedTraceEvent = traceEvents.find((entry) => entry.id === traceEventId && entry.syncState === 'synced');
    if (!syncedTraceEvent) {
      setStatusMessage('Supabase trace_events sync niet bevestigd. Geen productieproof tonen.');
      return false;
    }
    await writeColdLocationTemperatureLog({
      traceEventId,
      location: selectedLocation,
      productName: recognition.name,
      note: `${recognition.name} - Inkoop kassabonregel - naar ${selectedLocation}`,
    });

    setScanVerdict('opgeslagen');
    setLastMutationSummary({
      productName: recognition.name,
      fromLabel: 'Inkoop',
      toLabel: selectedLocation,
      quantity: Math.max(1, Math.round(quantity)),
      confirmationLabel: 'Bevestigd',
      resultDeltas: [{ label: selectedLocation, amount: Math.max(1, Math.round(quantity)) }],
      recordedAt: new Date().toISOString(),
    });
    setSaveMessage(
      `Opgeslagen: ${recognition.name} is als inkoop toegevoegd aan ${selectedLocation}. ${
        unitPrice > 0 ? `Waarde ${formatEuroAmount(quantity * unitPrice)}.` : 'Prijs ontbreekt; waarde 0.'
      }`
    );
    setStatusMessage('Opgeslagen: kassabon verwerkt als inkoop / stock intake.');
    const nextScanAccess = await recordScanAccessUsage(scanAccess);
    setScanAccess(nextScanAccess);
    if (getScanAccessSummary(nextScanAccess).isLocked) {
      setStatusMessage('Je 15 gratis scans zijn nu op. Open betalingen om te blijven werken.');
    }
    return true;
  }

  async function handleRegisterTicketBatch() {
    if (effectiveTicketLines.length === 0) {
      return false;
    }

    if (!selectedDestination) {
      setStatusMessage(`${SCAN_DESTINATION_PROMPT} voordat je de inkoop opslaat.`);
      return false;
    }

    if (hasUnknownTicketLines) {
      setStatusMessage('Controle nodig: bevestig onbekende kassabonregels eerst als Food cost of Bar cost.');
      return false;
    }

    if (scanAccessSummary.isLocked) {
      setStatusMessage('Je hebt de 15 gratis scans gebruikt. Open betalingen om verder te gaan.');
      router.push('/payments');
      return false;
    }

    const result = registerBatchReceiptPurchases(
      effectiveTicketLines.map((line) => ({
        itemId: line.itemId,
        itemName: line.name,
        category: line.category,
        location: selectedLocation,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        barcode: line.barcode ?? scanned?.data ?? recognition?.barcode ?? null,
        source: 'receipt-purchase',
        costBucket: line.costBucket,
      }))
    );

    if (!result.ok) {
      setStatusMessage('De kassabon kon nog niet verwerkt worden. Probeer opnieuw na een nieuwe scan.');
      return false;
    }

    const inventorySync = await persistInventoryStateToCloudNow();
    if (!inventorySync.ok) {
      setStatusMessage(`Supabase app_state sync niet bevestigd (${inventorySync.error ?? 'sync mislukt'}). Geen productieproof tonen.`);
      return false;
    }

    const selectedTemperatureLabel = formatColdLocationTemperatureLabel(selectedLocation, coldLocationTemperatures);
    const traceEventId = createScanProofId('trace-ticket-split');
    const traceEvents = await appendTraceEvent({
      id: traceEventId,
      eventKind: 'inventory_mutation',
      itemId: null,
      itemName: 'Kassabon',
      location: selectedLocation,
      fromLocation: selectedLocation,
      toLocation: selectedLocation,
      quantity: result.count,
      source: 'receipt-purchase-cost-split',
      barcode: scanned?.data ?? recognition?.barcode ?? null,
      batchCode: null,
      lotNumber: null,
      confidence: recognition?.confidence ?? null,
      expiryDays: null,
      note: [
        'Inkoop kassabon cost split bevestigd',
        `action=Inkoop`,
        `destination=${selectedLocation}`,
        selectedTemperatureLabel ? `temperature=${selectedTemperatureLabel}` : null,
        `total_food_cost=${result.totalFoodCost.toFixed(2)}`,
        `total_bar_cost=${result.totalBarCost.toFixed(2)}`,
        `total_unknown_cost=${result.totalUnknownCost.toFixed(2)}`,
        `lines=${effectiveTicketLines
          .map((line) =>
            `${line.name}:Inkoop:${line.costBucket}:${selectedLocation}:${formatTracePrice(
              line.unitPrice > 0 ? line.unitPrice : null
            )}:${getTicketLineAmount(line).toFixed(2)}`
          )
          .join(';')}`,
      ].filter(Boolean).join(' | '),
    });
    const syncedTraceEvent = traceEvents.find((entry) => entry.id === traceEventId && entry.syncState === 'synced');
    if (!syncedTraceEvent) {
      setStatusMessage('Supabase trace_events sync niet bevestigd. Geen productieproof tonen.');
      return false;
    }
    await writeColdLocationTemperatureLog({
      traceEventId,
      location: selectedLocation,
      productName: 'Kassabon',
      note: `Inkoop kassabon cost split - naar ${selectedLocation}`,
    });

    setScanVerdict('opgeslagen');
    setLastMutationSummary({
      productName: effectiveTicketLines[0]?.name ?? 'Kassabon',
      fromLabel: 'Inkoop',
      toLabel: selectedLocation,
      quantity: result.count,
      confirmationLabel: 'Bevestigd',
      resultDeltas: [{ label: selectedLocation, amount: result.count }],
      recordedAt: new Date().toISOString(),
    });
    setSaveMessage(
      `Opgeslagen: ${result.count} inkoopregels toegevoegd aan ${selectedLocation}. Food cost EUR ${result.totalFoodCost.toFixed(2)}, bar cost EUR ${result.totalBarCost.toFixed(2)}.`
    );
    setStatusMessage(
      `Opgeslagen: inkoop kassabon naar ${selectedLocation}. Food EUR ${result.totalFoodCost.toFixed(2)}, bar EUR ${result.totalBarCost.toFixed(2)}, unknown EUR ${result.totalUnknownCost.toFixed(2)}.`
    );
    const nextScanAccess = await recordScanAccessUsage(scanAccess);
    setScanAccess(nextScanAccess);
    if (getScanAccessSummary(nextScanAccess).isLocked) {
      setStatusMessage('Je 15 gratis scans zijn nu op. Open betalingen om te blijven werken.');
    }
    return true;
  }

  function resetFlow() {
    setScanned(null);
    setLastScannedAt(null);
    setCapturedPhoto(null);
    setRecognition(null);
    setProduct(null);
    setStaffConfirmed(false);
    setConfirmedDestination(null);
    setSaveMessage('');
    setLastMutationSummary(null);
    setScanVerdict(null);
    setLocationTouched(false);
    setDestinationChosen(false);
    setTicketCostOverrides({});
    setSelectedStockAction('move');
    setSelectedMovementType(null);
    setActionTouched(false);
    setScanPipelineDebug({
      recognitionStatus: 'idle',
      recognitionError: '',
      aiStatus: 'idle',
      aiError: '',
    });
    setStatusMessage(
      scanMode === 'Kassaticket'
        ? 'Scanner is opnieuw klaar voor een kassaticket.'
        : 'Scanner is opnieuw klaar voor een product.'
    );
    setAiTalkback(getDefaultTalkback(scanMode));
  }

  const askScanAi = useCallback(async () => {
    if (!recognition && !liveScanState.productName) {
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError('Scan een product of vul productnaam handmatig in voordat je Ria vraagt.');
      setScanPipelineDebug((current) => ({
        ...current,
        aiStatus: 'failed',
        aiError: 'Geen product of herkenning beschikbaar.',
      }));
      return;
    }

    setRealAiState('loading');
    setRealAiAnswer(null);
    setRealAiError('');
    setScanPipelineDebug((current) => ({
      ...current,
      aiStatus: 'requested',
      aiError: '',
    }));

    try {
      const answer = await requestRealAi({
        screen: 'scan',
        question:
          scanMode === 'Kassaticket'
            ? 'Welke operationele volgende stap raad je aan voor dit kassabonresultaat?'
            : 'Welke concrete volgende stap raad je aan voor dit gescande product?',
        context: scanAiContext,
        availableActions: scanAiActions,
      });
      setRealAiAnswer(answer);
      setRealAiState('done');
      setScanPipelineDebug((current) => ({
        ...current,
        aiStatus: 'succeeded',
        aiError: '',
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'De echte AI is nu niet bereikbaar.';
      setRealAiState('error');
      setRealAiAnswer(null);
      setRealAiError(message);
      setScanPipelineDebug((current) => ({
        ...current,
        aiStatus: 'failed',
        aiError: message,
      }));
    }
  }, [liveScanState.productName, recognition, scanAiActions, scanAiContext, scanMode]);

  useEffect(() => {
    const autoRiaProductName = liveScanState.productName.trim();

    if (!recognition && autoRiaProductName.length < 2) {
      return;
    }

    const autoRiaKey = [
      scanMode,
      scanned?.data ?? recognition.barcode ?? 'no-barcode',
      recognition?.name ?? autoRiaProductName,
      recognition?.category ?? (editedCategory.trim() || 'manual'),
      recognition?.confidence ?? 'manual',
      liveScanState.source,
      selectedLocation,
      selectedMovementType ?? 'no-movement',
    ].join('|');

    if (lastAutoRiaKeyRef.current === autoRiaKey) {
      return;
    }

    lastAutoRiaKeyRef.current = autoRiaKey;
    askScanAi().catch(() => {});
  }, [
    askScanAi,
    editedCategory,
    liveScanState.productName,
    liveScanState.source,
    recognition,
    recognition?.barcode,
    recognition?.category,
    recognition?.confidence,
    recognition?.name,
    scanMode,
    scanned?.data,
    selectedLocation,
    selectedMovementType,
  ]);

  async function applyScanAiAction(action: NonNullable<RealAiResponse['action']>) {
    if (realAiAnswer?.auditId) {
      markAiAuditInteraction(realAiAnswer.auditId, {
        kind: 'action_applied',
        label: action.label,
      }).catch(() => {});
    }

    let success = false;

    switch (action.kind) {
      case 'scan_use_suggested_location':
        setStatusMessage(
          `${scanDetail('scan.status.riaProposal', {
            location: scanLocationValueLabel(riaRecommendation.location),
            movement: riaSuggestedMovementLabel,
          })} Tik zelf op een locatie om te kiezen.`
        );
        success = false;
        break;
      case 'scan_use_suggested_action':
        setStatusMessage('AI/RIA mag de beweging niet kiezen. Kies handmatig Verbruik of Afval.');
        success = false;
        break;
      case 'scan_save_inventory':
        setStatusMessage(scanDetail('scan.confirm.chooseLocation'));
        success = false;
        break;
      case 'scan_register_sale':
        setStatusMessage('AI/RIA mag geen inkoop boeken. Menselijke bevestiging blijft verplicht.');
        success = false;
        break;
      case 'scan_register_ticket_batch':
        setStatusMessage('AI/RIA mag geen kassabonbatch boeken. Menselijke bevestiging blijft verplicht.');
        success = false;
        break;
      case 'scan_prepare_transport':
        setStatusMessage('AI/RIA toont alleen een transportvoorstel. Chauffeur kiest locatie/beweging en bevestigt zelf.');
        success = false;
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
  }

  function parseExpiryDaysInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  }

  function applyRecognitionEdits() {
    if (!recognition) return;
    const name = editedName.trim();
    const category = editedCategory.trim();
    if (!name || !category) {
      Alert.alert(scanDetail('scan.detail.alert.missing.title'), scanDetail('scan.detail.alert.missingNameCategory.body'));
      return;
    }

    const expiryDays = parseExpiryDaysInput(editedExpiryDays);

    setRecognition({
      ...recognition,
      name,
      category,
      expiryDays,
      confidence: Math.min(0.99, Math.max(recognition.confidence, 0.85)),
      notes: recognition.notes,
      batchCode: editedBatch.trim() || null,
      lotNumber: editedLot.trim() || null,
      recallFlag,
    });
    setScanVerdict('geldig');
    setEditRecognition(false);
    setStatusMessage(scanDetail('scan.detail.status.correctionApplied'));
  }

  async function learnBarcodeOverride() {
    if (!recognition) return;
    const barcode = (scanned?.data ?? recognition.barcode ?? '').trim();
    if (!barcode) {
      Alert.alert(scanDetail('scan.detail.alert.noBarcode.title'), scanDetail('scan.detail.alert.noBarcode.body'));
      return;
    }

    const name = editedName.trim() || recognition.name;
    const category = editedCategory.trim() || recognition.category;
    const expiryDays = parseExpiryDaysInput(editedExpiryDays);

    if (!name.trim() || !category.trim()) {
      Alert.alert(scanDetail('scan.detail.alert.missing.title'), scanDetail('scan.detail.alert.missingNameCategory.body'));
      return;
    }

    try {
      await setBarcodeOverride(barcode, {
        name,
        category,
        expiryDays,
      });

      setRecognition({
        ...recognition,
        name,
        category,
        expiryDays,
        confidence: 0.99,
        source: 'user-override',
        notes: `Correctie opgeslagen. Deze barcode wordt voortaan automatisch ingevuld.`,
        barcode,
      });
      setScanVerdict('geldig');

      addLiveAlertEvent({
        event: 'recognition',
        title: 'Barcode geleerd',
        detail: `${barcode} -> ${name} (${category})`,
        href: '/scan',
        location: selectedLocation,
      });

      setStatusMessage(scanDetail('scan.detail.status.barcodeLearned'));
      setEditRecognition(false);
    } catch {
      Alert.alert(scanDetail('scan.detail.alert.saveFailed.title'), scanDetail('scan.detail.alert.saveFailed.body'));
    }
  }

  function openCompactBarcodeScanner() {
    setCameraPreviewOpen(true);
    setStatusMessage(scanDetail('scan.detail.status.barcodeScannerOpened'));
  }

  function openCompactPhotoScanner() {
    setCameraPreviewOpen(true);
    setStatusMessage(scanDetail('scan.detail.status.photoScannerOpened'));
  }

  function confirmCompactAiProposal() {
    const destination = getScanDestinationValue(riaRecommendation.location);
    if (!destination) {
      Alert.alert(
        scanDetail('scan.detail.alert.locationMissing.title'),
        scanDetail('scan.detail.alert.aiLocationMissing.body')
      );
      return;
    }

    setLocationTouched(true);
    setSelectedLocation(riaRecommendation.location);
    setDestinationChosen(true);
    setActionTouched(true);
    setSelectedMovementType(riaSuggestedMovementType);
    setCameraPreviewOpen(false);
    confirmDestination(destination, riaSuggestedMovementType).catch(() => {});
  }

  function updateColdLocationTemperature(location: ColdScanLocation, delta: number) {
    setColdLocationTemperatures((current) => {
      const nextValue = clampColdLocationTemperature(location, current[location] + delta);
      setStatusMessage(`${location} temperatuur ingesteld op ${nextValue}°C.`);
      return { ...current, [location]: nextValue };
    });
  }

  function chooseScanDestination(location: string) {
    setLocationTouched(true);
    setSelectedLocation(location);
    setDestinationChosen(true);
    setConfirmedDestination(null);
    setStaffConfirmed(false);
    const temperatureLabel = formatColdLocationTemperatureLabel(location, coldLocationTemperatures);
    setStatusMessage(
      `Bestemming gekozen: ${formatScanLocationLabel(location)}${
        temperatureLabel ? ` (${temperatureLabel})` : ''
      }. Nog niet opgeslagen.`
    );
  }

  async function writeColdLocationTemperatureLog(params: {
    traceEventId: string;
    location: string;
    productName: string;
    note: string;
  }) {
    if (!isColdScanLocation(params.location)) return null;

    return appendTemperatureLog({
      traceEventId: params.traceEventId,
      location: params.location,
      temperatureCelsius: coldLocationTemperatures[params.location],
      temperatureSource: 'manual',
      note: `${params.productName} | ${params.note}`,
    });
  }

  function renderScanDestinationPicker(keyPrefix: string) {
    return PRODUCT_SCAN_DESTINATIONS.map((destination) => {
      const location = destination.location;
      const active = destinationChosen && location === selectedLocation;
      const coldLocation = isColdScanLocation(location) ? location : null;

      if (coldLocation) {
        return (
          <View key={`${keyPrefix}-${location}`} style={styles.coldLocationControl}>
            <View style={styles.temperatureAdjustRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${location} temperatuur lager`}
                style={styles.temperatureStepButton}
                onPress={() => updateColdLocationTemperature(coldLocation, -1)}>
                <MaterialIcons name="remove" size={16} color="#0f766e" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${location} temperatuur ${coldLocationTemperatures[coldLocation]} graden`}
                style={[styles.temperatureCircle, active ? styles.temperatureCircleActive : null]}
                onPress={() => chooseScanDestination(location)}>
                <ThemedText type="defaultSemiBold" style={active ? styles.temperatureTextActive : styles.temperatureText}>
                  {coldLocationTemperatures[coldLocation]}°C
                </ThemedText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${location} temperatuur hoger`}
                style={styles.temperatureStepButton}
                onPress={() => updateColdLocationTemperature(coldLocation, 1)}>
                <MaterialIcons name="add" size={16} color="#0f766e" />
              </Pressable>
            </View>
            <Pressable
              style={[styles.locationChip, styles.coldLocationChip, active ? styles.locationChipActive : null]}
              onPress={() => chooseScanDestination(location)}>
              <ThemedText type="defaultSemiBold" style={active ? styles.locationChipTextActive : styles.locationChipText}>
                {scanLocationLabel(destination.value)}
              </ThemedText>
            </Pressable>
          </View>
        );
      }

      return (
        <Pressable
          key={`${keyPrefix}-${location}`}
          style={[styles.locationChip, active ? styles.locationChipActive : null]}
          onPress={() => chooseScanDestination(location)}>
          <ThemedText type="defaultSemiBold" style={active ? styles.locationChipTextActive : styles.locationChipText}>
            {scanLocationLabel(destination.value)}
          </ThemedText>
        </Pressable>
      );
    });
  }

  if (!auth.ready) {
    return (
      <CenteredPanel
        icon="hourglass-empty"
        title="Sessie controleren"
        body="Taze controleert je Supabase-login voordat de productie-scanflow opent."
      />
    );
  }

  if (!auth.userId) {
    return (
      <CenteredPanel
        icon="login"
        title="Login vereist voor voorraadproof"
        body="Log in om scans, voorraadbewegingen en audit-events als echte Supabase-data op te slaan. Anonieme demo/local opslag is hier uitgeschakeld."
        cta="Ga naar login"
        onPress={() => router.push('/account')}
      />
    );
  }

  if (!permission) {
    return (
      <ThemedView style={styles.centeredScreen}>
        <View style={styles.centeredCard}>
          <View style={styles.centeredIconWrap}>
            <MaterialIcons name="camera-alt" size={40} color="#0f766e" />
          </View>
          <ThemedText type="title" style={styles.centeredTitle}>
            {scanDetail('scan.detail.camera.preparing.title')}
          </ThemedText>
          <ThemedText style={styles.centeredBody}>
            {scanDetail('scan.detail.camera.preparing.body')}
          </ThemedText>
          <Pressable style={styles.primaryAction} onPress={() => requestPermission()}>
            <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
              {scanDetail('scan.detail.camera.enableAction')}
            </ThemedText>
          </Pressable>

          <View style={styles.manualScanPanel}>
            <ThemedText type="defaultSemiBold" style={styles.manualScanTitle}>
              {scanDetail('scan.detail.camera.manualTitle')}
            </ThemedText>
            <ThemedText style={styles.manualScanBody}>
              {scanDetail('scan.detail.camera.manualPrepareBody')}
            </ThemedText>
            <TextInput
              value={manualBarcodeInput}
              onChangeText={setManualBarcodeInput}
              placeholder="Barcode"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              style={styles.manualScanInput}
            />
            <Pressable style={styles.manualScanButton} onPress={() => void handleManualBarcodeScan()}>
              <ThemedText type="defaultSemiBold" style={styles.manualScanButtonText}>
                {scanDetail('scan.detail.camera.tryBarcodeAction')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  if (cameraAvailable === false && Platform.OS !== 'web') {
    return (
      <ThemedView style={styles.centeredScreen}>
        <View style={styles.centeredCard}>
          <View style={styles.centeredIconWrap}>
            <MaterialIcons name="no-photography" size={40} color="#0f766e" />
          </View>
          <ThemedText type="title" style={styles.centeredTitle}>
            {scanDetail('scan.detail.camera.unavailable.title')}
          </ThemedText>
          <ThemedText style={styles.centeredBody}>
            {scanDetail('scan.detail.camera.unavailable.body')}
          </ThemedText>

          <View style={styles.manualScanPanel}>
            <ThemedText type="defaultSemiBold" style={styles.manualScanTitle}>
              {scanDetail('scan.detail.camera.manualTitle')}
            </ThemedText>
            <ThemedText style={styles.manualScanBody}>
              {scanDetail('scan.detail.camera.manualUnavailableBody')}
            </ThemedText>
            <TextInput
              value={manualBarcodeInput}
              onChangeText={setManualBarcodeInput}
              placeholder="Barcode"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              style={styles.manualScanInput}
            />
            <TextInput
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Productnaam"
              placeholderTextColor="#94a3b8"
              style={styles.manualScanInput}
            />
            <TextInput
              value={saleQuantityInput}
              onChangeText={setSaleQuantityInput}
              placeholder="Aantal"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              style={styles.manualScanInput}
            />
            <Pressable style={styles.manualScanButton} onPress={() => void handleManualBarcodeScan()}>
              <ThemedText type="defaultSemiBold" style={styles.manualScanButtonText}>
                {scanDetail('scan.detail.camera.useCodeProductAction')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.centeredScreen}>
        <View style={styles.centeredCard}>
          <View style={styles.centeredIconWrap}>
            <MaterialIcons name="qr-code-scanner" size={40} color="#0f766e" />
          </View>
          <ThemedText type="title" style={styles.centeredTitle}>
            {scanDetail('scan.detail.camera.permissionTitle')}
          </ThemedText>
          <ThemedText style={styles.centeredBody}>
            {scanDetail('scan.detail.camera.permissionBody')}
          </ThemedText>
          <Pressable style={styles.primaryAction} onPress={() => requestPermission()}>
            <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
              {scanDetail('scan.detail.camera.permissionAction')}
            </ThemedText>
          </Pressable>

          <View style={styles.manualScanPanel}>
            <ThemedText type="defaultSemiBold" style={styles.manualScanTitle}>
              {scanDetail('scan.detail.camera.testWithoutCameraTitle')}
            </ThemedText>
            <ThemedText style={styles.manualScanBody}>
              {scanDetail('scan.detail.camera.testWithoutCameraBody')}
            </ThemedText>
            <TextInput
              value={manualBarcodeInput}
              onChangeText={setManualBarcodeInput}
              placeholder="Barcode"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              style={styles.manualScanInput}
            />
            <Pressable style={styles.manualScanButton} onPress={() => void handleManualBarcodeScan()}>
              <ThemedText type="defaultSemiBold" style={styles.manualScanButtonText}>
                {scanDetail('scan.detail.camera.tryBarcodeAction')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ThemedView>
    );
  }

  const showLegacyCameraFlow = false;
  const compactEntryActive =
    scanMode === 'Product' &&
    !cameraPreviewOpen &&
    !recognition &&
    !scanned &&
    !capturedPhoto &&
    !editedName.trim();
  const compactProposalActive =
    scanMode === 'Product' &&
    !cameraPreviewOpen &&
    Boolean(recognition) &&
    !editRecognition &&
    !visibleMutationSummary;

  return (
    <ThemedView style={styles.screen}>
      <View accessibilityLiveRegion="polite" style={styles.screenReaderOnly}>
        <ThemedText>{scanLiveMessage}</ThemedText>
      </View>
      <View style={styles.cameraShell}>
        {cameraPreviewOpen ? (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            enableTorch={torchEnabled}
            ratio="16:9"
            onBarcodeScanned={barcodeScanLockRef.current ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes,
            }}
          />
        ) : null}

        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <View style={styles.statusBadge}>
                <MaterialIcons name="camera-alt" size={18} color="#ffffff" />
                <ThemedText type="defaultSemiBold" style={styles.statusBadgeText}>
                  {liveCameraLabel}
                </ThemedText>
              </View>
              <Pressable
                style={styles.brandScanBadge}
                onPress={() => router.replace('/')}
                accessibilityRole="button"
                accessibilityLabel={t('scan.accessibility.home', uiLanguage)}>
                <TazeLogo size={28} framed={false} />
                <ThemedText type="defaultSemiBold" style={styles.brandScanText}>
                  Taze
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.statusPill}>
              <ThemedText style={styles.statusPillText}>
                {isAnalyzing
                  ? t('scan.status.analyzing', uiLanguage)
                  : scanned
                    ? t('scan.status.codeFound', uiLanguage)
                    : t('scan.status.active', uiLanguage)}
              </ThemedText>
            </View>
          </View>

          {compactEntryActive ? (
            <View style={styles.compactScanPanel}>
              <View style={styles.compactScanHeader}>
                <TazeLogo size={34} framed={false} />
                <View style={styles.compactScanCopy}>
                  <ThemedText type="subtitle" style={styles.compactScanTitle}>
                    Scan
                  </ThemedText>
                  <ThemedText style={styles.compactScanBody}>
                    {t('scan.compact.body', uiLanguage)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.compactScanActions}>
                <Pressable style={styles.compactScanButton} onPress={openCompactBarcodeScanner}>
                  <ThemedText type="defaultSemiBold" style={styles.compactScanButtonText}>
                    {t('scan.action.scan', uiLanguage)}
                  </ThemedText>
                </Pressable>
                <Pressable style={styles.compactScanButtonSecondary} onPress={openCompactPhotoScanner}>
                  <ThemedText type="defaultSemiBold" style={styles.compactScanButtonText}>
                    {t('scan.action.ria', uiLanguage)}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {compactProposalActive && recognition ? (
            <View style={styles.compactProposalCard}>
              <View style={styles.cardHeaderRow}>
                <MaterialIcons name="auto-awesome" size={18} color="#0f766e" />
                <ThemedText type="defaultSemiBold" style={styles.compactProposalLabel}>
                  {t('scan.proposal.label', uiLanguage)}
                </ThemedText>
              </View>
              <ThemedText type="subtitle" style={styles.compactProposalName}>
                {recognition.name}
              </ThemedText>
              <ThemedText style={styles.compactProposalMeta}>{recognition.category}</ThemedText>
              <View style={styles.compactSuggestionRow}>
                <ThemedText style={styles.infoLabel}>{t('scan.proposal.location', uiLanguage)}</ThemedText>
                <ThemedText type="defaultSemiBold">{formatScanLocationLabel(riaRecommendation.location)}</ThemedText>
              </View>
              <View style={styles.compactSuggestionRow}>
                <ThemedText style={styles.infoLabel}>{t('scan.proposal.action', uiLanguage)}</ThemedText>
                <ThemedText type="defaultSemiBold">{riaSuggestedMovementLabel}</ThemedText>
              </View>
              <ThemedText style={styles.compactHumanNote}>
                {t('scan.proposal.humanNote', uiLanguage)}
              </ThemedText>
              <View style={styles.compactProposalActions}>
                <Pressable
                  style={[styles.compactConfirmButton, isSavingInventory ? styles.productConfirmButtonDisabled : null]}
                  disabled={isSavingInventory}
                  onPress={confirmCompactAiProposal}>
                  <ThemedText type="defaultSemiBold" style={styles.compactConfirmButtonText}>
                    {t('scan.action.confirm', uiLanguage)}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.compactEditButton}
                  onPress={() => {
                    setEditRecognition(true);
                    setCameraPreviewOpen(false);
                  }}>
                  <ThemedText type="defaultSemiBold" style={styles.compactEditButtonText}>
                    {t('scan.action.edit', uiLanguage)}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {cameraPreviewOpen ? (
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              <View style={styles.scanCenterIcon}>
                <MaterialIcons name="qr-code-scanner" size={42} color="#ffffff" />
              </View>
            </View>
            <View style={styles.scanQuickActions}>
              <Pressable style={styles.scanQuickButton} onPress={openCompactBarcodeScanner}>
                <ThemedText type="defaultSemiBold" style={styles.scanQuickButtonText}>
                  {t('scan.action.scan', uiLanguage).toUpperCase()}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.scanQuickButtonSecondary} onPress={openCompactPhotoScanner}>
                <ThemedText type="defaultSemiBold" style={styles.scanQuickButtonText}>
                  {t('scan.action.ria', uiLanguage)}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.scanQuickButtonConfirm, isSavingInventory ? styles.productConfirmButtonDisabled : null]}
                disabled={isSavingInventory}
                onPress={confirmCompactAiProposal}>
                <ThemedText type="defaultSemiBold" style={styles.scanQuickButtonText}>
                  {t('scan.action.confirm', uiLanguage).toUpperCase()}
                </ThemedText>
              </Pressable>
            </View>
            {showLegacyCameraFlow ? (
              <>
                <View style={styles.manualScanPanel}>
                  <ThemedText type="defaultSemiBold" style={styles.manualScanTitle}>
                    {scanDetail('scan.detail.camera.manualTitle')}
                  </ThemedText>
                  <ThemedText style={styles.manualScanBody}>
                    {scanDetail('scan.detail.camera.manualLegacyBody')}
                  </ThemedText>
                  <TextInput
                    value={manualBarcodeInput}
                    onChangeText={setManualBarcodeInput}
                    placeholder="Barcode"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="number-pad"
                    style={styles.manualScanInput}
                  />
                  {!staffConfirmed || !confirmedDestination ? (
                    <>
                      <TextInput
                        value={editedName}
                        onChangeText={(value) => {
                          setEditedName(value);
                          setStaffConfirmed(false);
                          setConfirmedDestination(null);
                          setStatusMessage(
                            value.trim()
                              ? scanDetail('scan.detail.status.manualProductTyping', { productName: value.trim() })
                              : scanDetail('scan.detail.status.manualProductMissing')
                          );
                        }}
                        placeholder="Productnaam"
                        placeholderTextColor="#94a3b8"
                        style={styles.manualScanInput}
                      />
                      <TextInput
                        value={editedCategory}
                        onChangeText={setEditedCategory}
                        placeholder="Categorie"
                        placeholderTextColor="#94a3b8"
                        style={styles.manualScanInput}
                      />
                    </>
                  ) : null}
                  <Pressable style={styles.manualScanButton} onPress={() => void handleManualBarcodeScan()}>
                    <ThemedText type="defaultSemiBold" style={styles.manualScanButtonText}>
                      {scanDetail('scan.detail.camera.tryBarcodeAction')}
                    </ThemedText>
                  </Pressable>
                </View>
                {liveScanState.productName || recognition ? (
                  <View style={styles.scanRuntimeProposalCard}>
                    <View style={styles.cardHeaderRow}>
                      <MaterialIcons name="auto-awesome" size={18} color="#0f766e" />
                      <ThemedText type="defaultSemiBold" style={styles.scanDebugTitle}>
                        {scanDetail('scan.ria.proposal')} {scanDetail('scan.ria.title')}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.scanRuntimeProposalText}>{liveScanState.riaAdvice}</ThemedText>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
          ) : null}

          <ScrollView
            ref={bottomSheetRef}
            style={compactEntryActive || compactProposalActive ? styles.hiddenScanDetails : null}
            contentContainerStyle={[
              styles.bottomSheet,
              {
                width: '100%',
                maxWidth: pageMaxWidth,
                alignSelf: 'center',
                paddingHorizontal: pagePadding,
              },
            ]}>
            <View style={styles.scanWorkflowBlock}>
              <View style={styles.scanWorkflowHeader}>
                <View style={styles.scanWorkflowStepBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                    1
                  </ThemedText>
                </View>
                <View style={styles.scanWorkflowCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                    Scan/manual product
                  </ThemedText>
                  <ThemedText style={styles.scanWorkflowBody}>
                    Scan een barcode of vul productnaam handmatig in. Barcode/foto is niet verplicht voor menselijke bevestiging.
                  </ThemedText>
                </View>
              </View>
              <View style={styles.manualScanPanel}>
                <TextInput
                  value={manualBarcodeInput}
                  onChangeText={setManualBarcodeInput}
                  placeholder="Barcode optioneel"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  style={styles.manualScanInput}
                />
                <TextInput
                  value={editedName}
                  onChangeText={(value) => {
                    setEditedName(value);
                    setStaffConfirmed(false);
                    setConfirmedDestination(null);
                    setStatusMessage(
                      value.trim()
                        ? scanDetail('scan.detail.status.manualProductTyping', { productName: value.trim() })
                        : scanDetail('scan.detail.status.manualProductMissing')
                    );
                  }}
                  placeholder="Productnaam"
                  placeholderTextColor="#94a3b8"
                  style={styles.manualScanInput}
                />
                <TextInput
                  value={editedCategory}
                  onChangeText={setEditedCategory}
                  placeholder="Categorie"
                  placeholderTextColor="#94a3b8"
                  style={styles.manualScanInput}
                />
                <TextInput
                  value={saleQuantityInput}
                  onChangeText={setSaleQuantityInput}
                  placeholder="Aantal"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  style={styles.manualScanInput}
                />
                <TextInput
                  value={saleUnitPriceInput}
                  onChangeText={setSaleUnitPriceInput}
                  placeholder="Prijs/st optioneel"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  style={styles.manualScanInput}
                />
                <TextInput
                  value={editedExpiryDays}
                  onChangeText={setEditedExpiryDays}
                  placeholder="Houdbaarheid dagen optioneel"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={styles.manualScanInput}
                />
                <View style={styles.controls}>
                  <ActionButton
                    icon="photo-camera"
                    label={isCapturing ? 'Foto bezig...' : 'Neem foto'}
                    onPress={handleTakePhoto}
                    disabled={isCapturing || isAnalyzing}
                    prominent
                  />
                  <ActionButton
                    icon="qr-code-scanner"
                    label="Gebruik barcode"
                    onPress={() => void handleManualBarcodeScan()}
                    disabled={isAnalyzing}
                  />
                </View>
              </View>
            </View>

            <View style={styles.scanWorkflowBlock}>
              <View style={styles.scanWorkflowHeader}>
                <View style={styles.scanWorkflowStepBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                    2
                  </ThemedText>
                </View>
                <View style={styles.scanWorkflowCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                    {scanDetail('scan.ria.proposal')} {scanDetail('scan.ria.title')}
                  </ThemedText>
                  <ThemedText style={styles.scanWorkflowBody}>
                    {scanDetail('scan.ria.description')}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.scanRuntimeProposalCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="auto-awesome" size={18} color="#0f766e" />
                  <ThemedText type="defaultSemiBold" style={styles.scanDebugTitle}>
                    {scanDetail('scan.ria.proposal')}
                  </ThemedText>
                </View>
                <ThemedText style={styles.scanRuntimeProposalText}>{liveScanState.riaAdvice}</ThemedText>
                {realAiAnswer ? (
                  <ThemedText style={styles.infoLabel}>
                    Ria antwoord: {realAiAnswer.answer}
                  </ThemedText>
                ) : null}
                {realAiError ? <ThemedText style={styles.confirmBlockerText}>{realAiError}</ThemedText> : null}
                <Pressable style={styles.scanAccessButton} onPress={() => askScanAi().catch(() => {})}>
                  <ThemedText type="defaultSemiBold" style={styles.scanAccessButtonText}>
                    Vraag Ria voorstel
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View
              style={styles.scanWorkflowBlock}
              onLayout={(event) => {
                locationActionOffsetRef.current = event.nativeEvent.layout.y;
              }}>
              <View style={styles.scanWorkflowHeader}>
                <View style={styles.scanWorkflowStepBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                    3
                  </ThemedText>
                </View>
                <View style={styles.scanWorkflowCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                    {scanDetail('scan.confirm.title')}
                  </ThemedText>
                  <ThemedText style={styles.scanWorkflowBody}>
                    {scanDetail('scan.confirm.description')}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.destinationCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="inventory-2" size={20} color="#0f766e" />
                  <ThemedText type="defaultSemiBold" style={styles.destinationTitle}>
                    {scanDetail('scan.confirm.chooseLocation')}
                  </ThemedText>
                </View>
                <View style={styles.locationPicker}>
                  {renderScanDestinationPicker('live-flow-location')}
                </View>
                {selectedDestinationLabel ? (
                  <ThemedText style={styles.infoLabel}>{scanDetail('scan.confirm.selectedLocation')} {selectedDestinationLabel}</ThemedText>
                ) : null}
              </View>
              <View style={styles.destinationCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="sync-alt" size={20} color="#0f766e" />
                  <ThemedText type="defaultSemiBold" style={styles.destinationTitle}>
                    {scanDetail('scan.confirm.chooseMovement')}
                  </ThemedText>
                </View>
                <View style={styles.locationPicker}>
                  {visibleScanMovementTypes.map((movement) => {
                    const active = movement.value === selectedMovementType;

                    return (
                      <Pressable
                        key={`live-flow-movement-${movement.value}`}
                        style={[styles.locationChip, active ? styles.locationChipActive : null]}
                        onPress={() => {
                          setActionTouched(true);
                          setSelectedMovementType(movement.value);
                          setConfirmedDestination(null);
                          setStaffConfirmed(false);
                          setStatusMessage(`Beweging gekozen: ${scanMovementLabel(movement.value)}. Nog niet opgeslagen.`);
                        }}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={active ? styles.locationChipTextActive : styles.locationChipText}>
                          {scanMovementLabel(movement.value)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                {selectedMovementLabel ? (
                  <ThemedText style={styles.infoLabel}>{scanDetail('scan.confirm.selectedMovement')} {selectedMovementLabel}</ThemedText>
                ) : null}
              </View>
              <View style={styles.destinationCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="check-circle" size={20} color="#0f766e" />
                  <ThemedText type="defaultSemiBold" style={styles.destinationTitle}>
                    {scanDetail('scan.confirm.applyLogic')}
                  </ThemedText>
                </View>
                <TouchableOpacity
                  activeOpacity={0.82}
                  style={[
                    styles.productConfirmButton,
                    !canConfirmInventoryDestination || isAnalyzing || isSavingInventory
                      ? styles.productConfirmButtonDisabled
                      : styles.productConfirmButtonReady,
                  ]}
                  disabled={!canConfirmInventoryDestination || isAnalyzing || isSavingInventory}
                  onPress={() => {
                    if (scanAccessSummary.isLocked) {
                      router.push('/payments');
                      return;
                    }
                    if (!selectedDestination || !selectedMovementType) {
                      setStatusMessage(scanDetail('scan.detail.alert.locationMovementMissing.body'));
                      return;
                    }
                    confirmDestination(selectedDestination, selectedMovementType).catch(() => {});
                  }}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={[
                      styles.productConfirmButtonText,
                      !canConfirmInventoryDestination || isAnalyzing || isSavingInventory
                        ? styles.productConfirmButtonTextDisabled
                        : null,
                    ]}>
                    {inventoryConfirmLabel}
                  </ThemedText>
                </TouchableOpacity>
                {inventoryConfirmDetail ? (
                  <ThemedText style={styles.productConfirmDetail}>{inventoryConfirmDetail}</ThemedText>
                ) : null}
                {!liveScanState.confirmReady ? (
                  <ThemedText style={styles.confirmBlockerText}>{confirmBlockedReason}</ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.scanWorkflowBlock}>
              <View style={styles.scanWorkflowHeader}>
                <View style={styles.scanWorkflowStepBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                    4
                  </ThemedText>
                </View>
                <View style={styles.scanWorkflowCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                    {scanDetail('scan.audit.title')}
                  </ThemedText>
                  <ThemedText style={styles.scanWorkflowBody}>
                    Na confirm schrijft TAZE voorraad, waste/loss/verbruik en trace via de bestaande live helpers.
                  </ThemedText>
                </View>
              </View>
              {visibleMutationSummary ? (
                <View style={styles.resultCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="fact-check" size={20} color="#0f766e" />
                    <ThemedText type="defaultSemiBold">Live scan resultaat</ThemedText>
                  </View>
                  <View style={styles.resultHeaderRow}>
                    <View style={styles.resultField}>
                      <ThemedText style={styles.infoLabel}>Product</ThemedText>
                      <ThemedText type="defaultSemiBold">{visibleMutationSummary.productName}</ThemedText>
                    </View>
                    <View style={styles.resultField}>
                      <ThemedText style={styles.infoLabel}>{scanDetail('scan.label.movement')}</ThemedText>
                      <ThemedText type="defaultSemiBold">{visibleMutationSummary.actionLabel ?? 'Bevestigd'}</ThemedText>
                    </View>
                    <View style={styles.resultField}>
                      <ThemedText style={styles.infoLabel}>{scanDetail('scan.label.location')}</ThemedText>
                      <ThemedText type="defaultSemiBold">{visibleMutationSummary.toLabel}</ThemedText>
                    </View>
                    <View style={styles.resultField}>
                      <ThemedText style={styles.infoLabel}>Aantal</ThemedText>
                      <ThemedText type="defaultSemiBold">{visibleMutationSummary.quantity}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.resultDeltaRow}>
                    {visibleMutationSummary.resultDeltas.map((delta) => (
                      <View key={`live-flow-${delta.label}-${delta.amount}-${visibleMutationSummary.recordedAt}`} style={styles.resultDeltaChip}>
                        <ThemedText type="defaultSemiBold" style={styles.resultDeltaLabel}>
                          {delta.label}
                        </ThemedText>
                        <ThemedText type="defaultSemiBold" style={styles.resultDeltaValue}>
                          {formatMutationAmount(delta.amount)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                  {visibleMutationSummary.expiryDate || visibleMutationSummary.expiryStatus || visibleMutationSummary.recommendedAction ? (
                    <ThemedText style={styles.expiryReasonText}>
                      Verval: {formatExpiryDateLabel(visibleMutationSummary.expiryDate ?? null)} |{' '}
                      {formatTranslatedExpiryStatusLabel(visibleMutationSummary.expiryStatus ?? 'Unknown', uiLanguage)} |{' '}
                      {translateOperationalLabel(visibleMutationSummary.recommendedAction ?? 'Mens kiest actie', uiLanguage)}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.pendingMeta}>Trace/audit bijgewerkt: {formatScanMoment(visibleMutationSummary.recordedAt)}</ThemedText>
                </View>
              ) : (
                <View style={styles.auditWaitingCard}>
                  <ThemedText type="defaultSemiBold">Nog geen bevestiging opgeslagen.</ThemedText>
                  <ThemedText style={styles.pendingMeta}>
                    Wacht op product, locatie en beweging. Daarna schrijft confirm naar inventory, waste/loss/verbruik en trace.
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={[styles.scanAccessCard, scanAccessSummary.isLocked ? styles.scanAccessCardLocked : null]}>
              <View
                style={[
                  styles.scanAccessLine,
                  scanAccessSummary.isLocked ? styles.scanAccessLineLocked : styles.scanAccessLineActive,
                ]}
              />
              <View style={styles.cardHeaderRow}>
                <MaterialIcons
                  name={scanAccessSummary.isLocked ? 'lock' : 'qr-code-scanner'}
                  size={20}
                  color={scanAccessSummary.isLocked ? '#b45309' : '#0f766e'}
                />
                <ThemedText type="defaultSemiBold">Scan toegang</ThemedText>
              </View>
              <ThemedText style={styles.scanAccessText}>{scanAccessStatusText}</ThemedText>
              <View style={styles.scanAccessMetaRow}>
                <View style={styles.scanAccessBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanAccessBadgeText}>
                    {scanAccessRemainingLabel}
                  </ThemedText>
                </View>
                <View style={styles.scanAccessBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanAccessBadgeText}>
                    {FREE_SCAN_LIMIT} gratis scans
                  </ThemedText>
                </View>
              </View>
              <View style={styles.scanAccessActions}>
                <Pressable style={styles.scanAccessButton} onPress={() => router.push('/payments')}>
                  <ThemedText type="defaultSemiBold" style={styles.scanAccessButtonText}>
                    {scanAccessSummary.isLocked ? 'Open betalingen' : 'Bekijk betaalopties'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.bottomHeader}>
              <View style={styles.bottomHeaderText}>
                <ThemedText type="subtitle">
                  {scanMode === 'Kassaticket' ? 'Ticketinvoer' : 'Scan'}
                </ThemedText>
                <ThemedText>
                  {scanMode === 'Kassaticket'
                    ? 'Scan een kassabon en werk de ticketlijnen af.'
                    : statusMessage}
                </ThemedText>
              </View>
              <View style={styles.aiBadge}>
                <MaterialIcons name="auto-awesome" size={20} color="#0f766e" />
              </View>
            </View>

            <View style={styles.modeRow}>
              {(['Product', 'Kassaticket'] as ScanMode[]).map((mode) => {
                const active = scanMode === mode;

                return (
                  <Pressable
                    key={mode}
                    style={[styles.modeChip, active ? styles.modeChipActive : null]}
                    onPress={() => {
                      setScanMode(mode);
                      setSaveMessage('');
                      setScanVerdict(null);
                      setTicketCostOverrides({});
                      setStatusMessage(
                        mode === 'Kassaticket'
                          ? 'Richt de camera op een kassabon of ticket.'
                          : 'Richt de camera op een code of neem een productfoto.'
                      );
                      setAiTalkback(getDefaultTalkback(mode));
                    }}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={active ? styles.modeChipTextActive : styles.modeChipText}>
                      {mode}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.controls}>
              <ActionButton
                icon="photo-camera"
                label={isCapturing ? 'Foto bezig...' : 'Neem foto'}
                onPress={handleTakePhoto}
                disabled={isCapturing || isAnalyzing}
                prominent
              />
              <ActionButton
                icon={facing === 'back' ? 'flip-camera-android' : 'camera-front'}
                label={facing === 'back' ? 'Frontcamera' : 'Achtercamera'}
                onPress={() => {
                  setFacing((current) => (current === 'back' ? 'front' : 'back'));
                  setTorchEnabled(false);
                }}
              />
              <ActionButton
                icon={torchEnabled ? 'flash-off' : 'flash-on'}
                label={torchEnabled ? 'Flits uit' : 'Flits aan'}
                disabled={facing === 'front'}
                onPress={() => setTorchEnabled((current) => !current)}
              />
              <ActionButton icon="restart-alt" label="Opnieuw scannen" onPress={resetFlow} />
            </View>

            {showLegacyCameraFlow && scanMode === 'Product' ? (
              <>
                <View style={styles.aiAdviceCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons
                      name={staffConfirmed && confirmedDestination ? 'verified-user' : 'auto-awesome'}
                      size={18}
                      color={staffConfirmed && confirmedDestination ? '#0f766e' : '#7c3aed'}
                    />
                    <ThemedText type="defaultSemiBold">
                      {staffConfirmed && confirmedDestination ? 'Mens bevestigd' : '1. RIA/AI voorstel'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.destinationBody}>
                    {staffConfirmed && confirmedDestination
                      ? `Opgeslagen in ${formatScanLocationLabel(confirmedDestination)}`
                      : liveScanState.pendingProposal
                        ? `${formatScanLocationLabel(liveScanState.pendingProposal.location)} - ${formatScanMovementTypeLabel(
                            liveScanState.pendingProposal.movement
                          )} - ${
                            liveScanState.pendingProposal.confidence !== null
                              ? `${Math.round(liveScanState.pendingProposal.confidence * 100)}%`
                              : 'handmatig'
                          }`
                        : liveScanState.riaAdvice}
                  </ThemedText>
                  <ThemedText style={styles.infoLabel}>
                    Talkback: {liveScanState.riaAdvice}
                  </ThemedText>
                  {!staffConfirmed || !confirmedDestination ? (
                    <ThemedText style={styles.infoLabel}>
                      RIA/AI doet alleen een voorstel. De mens kiest hieronder zelf locatie en beweging.
                    </ThemedText>
                  ) : null}
                  <RealAiCopilotPanel
                    title="Ria/AI live voorstel"
                    hint={
                      recognition
                        ? 'Ria gebruikt herkenning, locatie en live voorraad om de beste volgende stap te kiezen.'
                        : 'Na een scan of foto geeft Ria een concrete volgende stap.'
                    }
                    buttonLabel="Vraag Ria"
                    loading={realAiState === 'loading'}
                    onAsk={() => askScanAi().catch(() => {})}
                    result={realAiAnswer}
                    error={realAiError || null}
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
                            label: 'Transporthub geopend via scan-AI',
                          }).catch(() => {});
                        }
                        router.push(
                          buildTransportHubPath({
                            region: 'Europa',
                            useCase: 'Logistiek',
                            partnerId: scanTransportFocus.recommendedPartner?.id ?? null,
                            source: 'scan',
                            auditId: realAiAnswer?.auditId ?? null,
                          }) as Href
                        );
                        return;
                      }
                      router.push(route as Href);
                    }}
                    onApplyAction={applyScanAiAction}
                  />
                  <View style={styles.scanDebugCard}>
                    <View style={styles.cardHeaderRow}>
                      <MaterialIcons name="bug-report" size={18} color="#0f766e" />
                      <ThemedText type="defaultSemiBold" style={styles.scanDebugTitle}>
                        TEMP live scan debug
                      </ThemedText>
                    </View>
                    {scanPipelineDebugRows.map((row) => (
                      <View key={row.label} style={styles.scanDebugRow}>
                        <View
                          style={[
                            styles.scanDebugDot,
                            row.ok ? styles.scanDebugDotOk : styles.scanDebugDotPending,
                          ]}
                        />
                        <ThemedText style={styles.scanDebugLabel}>{row.label}</ThemedText>
                        <ThemedText style={styles.scanDebugValue}>{row.value}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                <View
                  style={styles.scanWorkflowBlock}
                  onLayout={(event) => {
                    locationActionOffsetRef.current = event.nativeEvent.layout.y;
                  }}>
                  <View style={styles.scanWorkflowHeader}>
                    <View style={styles.scanWorkflowStepBadge}>
                      <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                        2
                      </ThemedText>
                    </View>
                    <View style={styles.scanWorkflowCopy}>
                      <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                        Humaan bevestigen
                      </ThemedText>
                      <ThemedText style={styles.scanWorkflowBody}>
                        Kies zelf de locatie en beweging. Alleen deze menselijke keuze wordt opgeslagen.
                      </ThemedText>
                    </View>
                  </View>
                <View style={styles.destinationCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="inventory-2" size={20} color="#0f766e" />
                    <ThemedText type="defaultSemiBold" style={styles.destinationTitle}>
                      {scanDetail('scan.confirm.chooseLocation')}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.destinationBody}>Waar gebeurt deze beweging?</ThemedText>
                  <View style={styles.locationPicker}>
                    {renderScanDestinationPicker('manual-flow-location')}
                  </View>
                  {selectedDestinationLabel ? (
                    <ThemedText style={styles.infoLabel}>{scanDetail('scan.confirm.selectedLocation')} {selectedDestinationLabel}</ThemedText>
                  ) : null}
                </View>

                <View style={styles.destinationCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="sync-alt" size={20} color="#0f766e" />
                    <ThemedText type="defaultSemiBold" style={styles.destinationTitle}>
                      {scanDetail('scan.confirm.chooseMovement')}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.destinationBody}>Wat wil je registreren?</ThemedText>
                  <View style={styles.locationPicker}>
                  {visibleScanMovementTypes.map((movement) => {
                    const active = movement.value === selectedMovementType;

                    return (
                      <Pressable
                        key={movement.value}
                        style={[styles.locationChip, active ? styles.locationChipActive : null]}
                        onPress={() => {
                          setActionTouched(true);
                          setSelectedMovementType(movement.value);
                          setConfirmedDestination(null);
                          setStaffConfirmed(false);
                          setStatusMessage(`Beweging gekozen: ${scanMovementLabel(movement.value)}. Nog niet opgeslagen.`);
                        }}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={active ? styles.locationChipTextActive : styles.locationChipText}>
                          {scanMovementLabel(movement.value)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                  </View>
                  {selectedMovementLabel ? (
                    <ThemedText style={styles.infoLabel}>{scanDetail('scan.confirm.selectedMovement')} {selectedMovementLabel}</ThemedText>
                  ) : null}
                </View>

                <View style={styles.destinationCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="check-circle" size={20} color="#0f766e" />
                    <ThemedText type="defaultSemiBold" style={styles.destinationTitle}>
                      Bevestig
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    style={[
                      styles.productConfirmButton,
                      !canConfirmInventoryDestination || isAnalyzing || isSavingInventory
                        ? styles.productConfirmButtonDisabled
                        : styles.productConfirmButtonReady,
                    ]}
                    disabled={!canConfirmInventoryDestination || isAnalyzing || isSavingInventory}
                    onPress={() => {
                      if (scanAccessSummary.isLocked) {
                        router.push('/payments');
                        return;
                      }
                      if (!selectedDestination) {
                        setStatusMessage(scanDetail('scan.detail.alert.locationMovementMissing.body'));
                        return;
                      }
                      if (!selectedMovementType) {
                        setStatusMessage(scanDetail('scan.detail.alert.locationMovementMissing.body'));
                        return;
                      }
                      confirmDestination(selectedDestination, selectedMovementType).catch(() => {});
                    }}>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[
                        styles.productConfirmButtonText,
                        !canConfirmInventoryDestination || isAnalyzing || isSavingInventory
                          ? styles.productConfirmButtonTextDisabled
                          : null,
                      ]}>
                      {inventoryConfirmLabel}
                    </ThemedText>
                  </TouchableOpacity>
                  {inventoryConfirmDetail ? (
                    <ThemedText style={styles.productConfirmDetail}>{inventoryConfirmDetail}</ThemedText>
                  ) : null}
                  {!liveScanState.confirmReady ? (
                    <ThemedText style={styles.confirmBlockerText}>{confirmBlockedReason}</ThemedText>
                  ) : null}
                </View>
                </View>
              </>
            ) : null}

            <View style={styles.scanWorkflowBlock}>
              <View style={styles.scanWorkflowHeader}>
                <View style={styles.scanWorkflowStepBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                    3
                  </ThemedText>
                </View>
                <View style={styles.scanWorkflowCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                    Scanresultaat
                  </ThemedText>
                  <ThemedText style={styles.scanWorkflowBody}>
                    Herkenning, barcode en productcontrole blijven zichtbaar onder de menselijke keuze.
                  </ThemedText>
                </View>
              </View>

            <View style={styles.dataGrid}>
              <View style={styles.infoCard}>
                <View style={styles.cardHeaderRow}>
              <MaterialIcons name="qr-code-scanner" size={20} color="#0f766e" />
              <ThemedText type="defaultSemiBold">Scanresultaat</ThemedText>
                </View>
                <ThemedText style={styles.infoLabel}>Barcode</ThemedText>
                <ThemedText numberOfLines={2}>
                  {scanned?.data ?? 'Nog geen barcode gescand.'}
                </ThemedText>
                <ThemedText style={styles.infoLabel}>Type</ThemedText>
                <ThemedText>{scanned?.type ?? 'Onbekend'}</ThemedText>
                <ThemedText style={styles.infoLabel}>Scanstatus</ThemedText>
                <ThemedText>{scanStatusLabel}</ThemedText>
                <ThemedText style={styles.infoLabel}>Tijdstip</ThemedText>
                <ThemedText>{scanTimeLabel}</ThemedText>
                <ThemedText style={styles.infoLabel}>Volgende stap</ThemedText>
                <ThemedText>Controleer product</ThemedText>
                <ThemedText style={styles.scanSafetyNote}>Geen voorraadmutatie uitgevoerd. Menselijke bevestiging vereist.</ThemedText>
                <Pressable style={styles.cardLinkButton} onPress={() => router.push('/trace')}>
                  <ThemedText type="defaultSemiBold" style={styles.cardLinkText}>
                    Open track & trace
                  </ThemedText>
                </Pressable>
              </View>

              {product ? (
                <View style={styles.infoCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="inventory" size={20} color="#059669" />
                    <ThemedText type="defaultSemiBold">Productgegevens</ThemedText>
                  </View>
                  <ThemedText style={styles.infoLabel}>Productnaam</ThemedText>
                  <ThemedText>{product.name}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Categorie</ThemedText>
                  <ThemedText>{product.category}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Barcode</ThemedText>
                  <ThemedText>{product.barcode ?? 'Geen'}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Eenheid</ThemedText>
                  <ThemedText>{product.unit}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Prijs</ThemedText>
                  <ThemedText>{product.price} {product.currency}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Bestemming</ThemedText>
                  <ThemedText>{product.suggestedDestination}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Herk. methode</ThemedText>
                  <ThemedText>Barcode</ThemedText>
                  <ThemedText style={styles.infoLabel}>Zekerheid</ThemedText>
                  <ThemedText>{Math.round(product.confidence * 100)}%</ThemedText>
                  <ThemedText style={styles.infoLabel}>Tijdstip</ThemedText>
                  <ThemedText>{scanTimeLabel}</ThemedText>
                  <ThemedText style={styles.infoLabel}>Status</ThemedText>
                  <ThemedText>Gekoppeld aan catalogus</ThemedText>
                </View>
              ) : null}

              <View style={styles.infoCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="auto-awesome" size={20} color="#1d4ed8" />
                  <ThemedText type="defaultSemiBold">Productvoorstel</ThemedText>
                </View>
                {recognition ? (
                  <>
                    {editRecognition ? (
                      <>
                        <ThemedText style={styles.infoLabel}>Naam</ThemedText>
                        <TextInput
                          value={editedName}
                          onChangeText={setEditedName}
                          placeholder="Productnaam"
                          placeholderTextColor="#94a3b8"
                          style={styles.inlineInput}
                        />
                        <ThemedText style={styles.infoLabel}>Categorie</ThemedText>
                        <TextInput
                          value={editedCategory}
                          onChangeText={setEditedCategory}
                          placeholder="Categorie"
                          placeholderTextColor="#94a3b8"
                          style={styles.inlineInput}
                        />
                        <ThemedText style={styles.infoLabel}>Houdbaarheid (dagen)</ThemedText>
                        <TextInput
                          value={editedExpiryDays}
                          onChangeText={setEditedExpiryDays}
                          placeholder="bv. 3"
                          placeholderTextColor="#94a3b8"
                          keyboardType="number-pad"
                          style={styles.inlineInput}
                        />
                        <ThemedText style={styles.infoLabel}>Batch</ThemedText>
                        <TextInput
                          value={editedBatch}
                          onChangeText={setEditedBatch}
                          placeholder="batch-code"
                          placeholderTextColor="#94a3b8"
                          style={styles.inlineInput}
                        />
                        <ThemedText style={styles.infoLabel}>Lot</ThemedText>
                        <TextInput
                          value={editedLot}
                          onChangeText={setEditedLot}
                          placeholder="lot-nummer"
                          placeholderTextColor="#94a3b8"
                          style={styles.inlineInput}
                        />
                      </>
                    ) : (
                      <>
                        <ThemedText style={styles.recognitionName}>{recognition.name}</ThemedText>
                        <ThemedText style={styles.recognitionCategory}>{recognition.category}</ThemedText>
                        <View style={styles.recognitionMetaRow}>
                          <View
                            style={[
                              styles.confidenceBadge,
                              isTrustedRecognitionSource(recognition.source)
                                ? { backgroundColor: '#ecfdf5', borderColor: '#86efac' }
                                : { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
                            ]}>
                            <ThemedText
                              style={[
                                styles.confidenceBadgeText,
                                { color: isTrustedRecognitionSource(recognition.source) ? '#166534' : '#9a3412' },
                              ]}>
                              {getRecognitionSourceLabel(recognition)}
                            </ThemedText>
                          </View>
                          {(() => {
                            const tone = getConfidenceTone(recognition.confidence);
                            return (
                              <View
                                style={[
                                  styles.confidenceBadge,
                                  { backgroundColor: tone.background, borderColor: tone.border },
                                ]}>
                                <ThemedText style={[styles.confidenceBadgeText, { color: tone.text }]}>
                                  Zekerheid {Math.round(recognition.confidence * 100)}%
                                </ThemedText>
                              </View>
                            );
                          })()}
                          {recallFlag ? (
                            <View style={styles.recallChip}>
                              <ThemedText style={styles.recallChipText}>Recall</ThemedText>
                            </View>
                          ) : null}
                        </View>
                        {isUnconfirmedRecognitionSource(recognition.source) ? (
                          <ThemedText style={styles.recognitionNotes}>
                            Product niet automatisch herkend. Controleer of corrigeer naam, categorie en aantal voordat je bevestigt.
                          </ThemedText>
                        ) : null}
                        <ThemedText style={styles.recognitionNotes}>{recognition.notes}</ThemedText>
                        <View style={styles.batchLotRow}>
                          {(editedBatch.trim() || recognition.batchCode) && (
                            <View style={styles.batchChip}>
                              <ThemedText style={styles.batchChipText}>
                                Batch {editedBatch.trim() || recognition.batchCode}
                              </ThemedText>
                            </View>
                          )}
                          {(editedLot.trim() || recognition.lotNumber) && (
                            <View style={styles.lotChip}>
                              <ThemedText style={styles.lotChipText}>
                                Lot {editedLot.trim() || recognition.lotNumber}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </>
                    )}

                    <View style={styles.recognitionActions}>
                      {editRecognition ? (
                        <>
                          <Pressable style={styles.smallButton} onPress={applyRecognitionEdits}>
                            <ThemedText type="defaultSemiBold" style={styles.smallButtonText}>
                              Toepassen
                            </ThemedText>
                          </Pressable>
                          <Pressable style={styles.smallButtonSecondary} onPress={() => setEditRecognition(false)}>
                            <ThemedText type="defaultSemiBold" style={styles.smallButtonSecondaryText}>
                              Annuleer
                            </ThemedText>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable style={styles.smallButtonSecondary} onPress={() => setEditRecognition(true)}>
                          <ThemedText type="defaultSemiBold" style={styles.smallButtonSecondaryText}>
                            Corrigeer
                          </ThemedText>
                        </Pressable>
                      )}

                      <Pressable
                        style={styles.smallButtonLearn}
                        onPress={learnBarcodeOverride}
                        disabled={!Boolean((scanned?.data ?? recognition.barcode ?? '').trim())}>
                        <ThemedText type="defaultSemiBold" style={styles.smallButtonLearnText}>
                          Bewaar correctie voor volgende herkenning
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.smallButtonSecondary, recallFlag ? styles.smallButtonActive : null]}
                        onPress={() => setRecallFlag((v) => !v)}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={recallFlag ? styles.smallButtonActiveText : styles.smallButtonSecondaryText}>
                          {recallFlag ? 'Recall gemarkeerd' : 'Markeer recall'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <ThemedText style={styles.recognitionNotes}>
                      Geen automatische herkenning gekoppeld. Vul productnaam handmatig in; Ria maakt meteen een voorstel uit deze scan-state.
                    </ThemedText>
                    <ThemedText style={styles.infoLabel}>Naam</ThemedText>
                    <TextInput
                      value={editedName}
                      onChangeText={(value) => {
                        setEditedName(value);
                        setStaffConfirmed(false);
                        setConfirmedDestination(null);
                        setStatusMessage(
                          value.trim()
                            ? scanDetail('scan.detail.status.manualProductTyping', { productName: value.trim() })
                            : scanDetail('scan.detail.status.manualProductMissing')
                        );
                      }}
                      placeholder="Productnaam"
                      placeholderTextColor="#94a3b8"
                      style={styles.inlineInput}
                    />
                    <ThemedText style={styles.infoLabel}>Categorie</ThemedText>
                    <TextInput
                      value={editedCategory}
                      onChangeText={setEditedCategory}
                      placeholder="Categorie"
                      placeholderTextColor="#94a3b8"
                      style={styles.inlineInput}
                    />
                    <ThemedText style={styles.infoLabel}>Houdbaarheid (dagen)</ThemedText>
                    <TextInput
                      value={editedExpiryDays}
                      onChangeText={setEditedExpiryDays}
                      placeholder="bv. 3"
                      placeholderTextColor="#94a3b8"
                      keyboardType="number-pad"
                      style={styles.inlineInput}
                    />
                    {liveScanState.pendingProposal ? (
                      <ThemedText style={styles.recognitionNotes}>{liveScanState.riaAdvice}</ThemedText>
                    ) : null}
                  </>
                )}
              </View>
            </View>
            </View>

            <View style={styles.scanWorkflowBlock}>
              <View style={styles.scanWorkflowHeader}>
                <View style={styles.scanWorkflowStepBadge}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowStepText}>
                    4
                  </ThemedText>
                </View>
                <View style={styles.scanWorkflowCopy}>
                  <ThemedText type="defaultSemiBold" style={styles.scanWorkflowTitle}>
                    {scanDetail('scan.audit.title')}
                  </ThemedText>
                  <ThemedText style={styles.scanWorkflowBody}>
                    {scanDetail('scan.audit.body')}
                  </ThemedText>
                </View>
              </View>

            {visibleMutationSummary ? (
              <View style={styles.resultCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="fact-check" size={20} color="#0f766e" />
                  <ThemedText type="defaultSemiBold">
                    Scan resultaat
                  </ThemedText>
                </View>
                <View style={styles.resultHeaderRow}>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Product</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.productName}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Barcode</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.barcode ?? scanned?.data ?? 'Geen'}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Categorie</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.category ?? 'Onbekend'}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Actie</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.actionLabel ?? 'Verplaatsing'}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Van</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.fromLabel}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Naar</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.toLabel}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Aantal</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.quantity}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Bevestigen</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.confirmationLabel}</ThemedText>
                  </View>
                  <View style={styles.resultField}>
                    <ThemedText style={styles.infoLabel}>Gebruiker</ThemedText>
                    <ThemedText type="defaultSemiBold">{visibleMutationSummary.userLabel ?? auth.email ?? auth.userId ?? 'Onbekend'}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.infoLabel}>Resultaat</ThemedText>
                <View style={styles.resultDeltaRow}>
                  {visibleMutationSummary.resultDeltas.map((delta) => (
                    <View key={`${delta.label}-${delta.amount}-${visibleMutationSummary.recordedAt}`} style={styles.resultDeltaChip}>
                      <ThemedText type="defaultSemiBold" style={styles.resultDeltaLabel}>
                        {delta.label}
                      </ThemedText>
                      <ThemedText type="defaultSemiBold" style={styles.resultDeltaValue}>
                        {formatMutationAmount(delta.amount)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                {visibleMutationSummary.expiryDate || visibleMutationSummary.expiryStatus || visibleMutationSummary.recommendedAction ? (
                  <View style={styles.expiryCard}>
                    <View style={styles.cardHeaderRow}>
                      <MaterialIcons name="event-available" size={20} color="#0f766e" />
                      <ThemedText type="defaultSemiBold">Vervaldatum & actie</ThemedText>
                    </View>
                    <View style={styles.expiryMetaGrid}>
                      <View style={styles.expiryMetaField}>
                        <ThemedText style={styles.infoLabel}>Product</ThemedText>
                        <ThemedText type="defaultSemiBold">{visibleMutationSummary.productName}</ThemedText>
                      </View>
                      <View style={styles.expiryMetaField}>
                        <ThemedText style={styles.infoLabel}>Location</ThemedText>
                        <ThemedText type="defaultSemiBold">{visibleMutationSummary.fromLabel}</ThemedText>
                      </View>
                      <View style={styles.expiryMetaField}>
                        <ThemedText style={styles.infoLabel}>Quantity</ThemedText>
                        <ThemedText type="defaultSemiBold">{visibleMutationSummary.quantity}</ThemedText>
                      </View>
                      <View style={styles.expiryMetaField}>
                        <ThemedText style={styles.infoLabel}>Expiry date</ThemedText>
                        <ThemedText type="defaultSemiBold">
                          {formatExpiryDateLabel(visibleMutationSummary.expiryDate ?? null)}
                        </ThemedText>
                      </View>
                      <View style={styles.expiryMetaField}>
                        <ThemedText style={styles.infoLabel}>Status</ThemedText>
                        <ThemedText type="defaultSemiBold">
                          {formatTranslatedExpiryStatusLabel(visibleMutationSummary.expiryStatus ?? 'Unknown', uiLanguage)}
                        </ThemedText>
                      </View>
                      <View style={styles.expiryMetaField}>
                        <ThemedText style={styles.infoLabel}>Recommended action</ThemedText>
                        <ThemedText type="defaultSemiBold">
                          {translateOperationalLabel(visibleMutationSummary.recommendedAction ?? 'Mens kiest actie', uiLanguage)}
                        </ThemedText>
                      </View>
                    </View>
                    {visibleMutationSummary.recommendedReason ? (
                      <ThemedText style={styles.expiryReasonText}>{visibleMutationSummary.recommendedReason}</ThemedText>
                    ) : null}
                  </View>
                ) : null}
                {latestManualMovementText ? (
                  <>
                    <ThemedText style={styles.infoLabel}>Auditregel</ThemedText>
                    <ThemedText>{latestManualMovementText}</ThemedText>
                    {visibleMutationSummary.expiryStatus ? (
                      <ThemedText style={styles.expiryReasonText}>
                        Status: {formatTranslatedExpiryStatusLabel(visibleMutationSummary.expiryStatus, uiLanguage)}
                        {visibleMutationSummary.recommendedAction
                          ? ` | Actie: ${translateOperationalLabel(visibleMutationSummary.recommendedAction, uiLanguage)}`
                          : ''}
                      </ThemedText>
                    ) : null}
                  </>
                ) : null}
                <ThemedText style={styles.pendingMeta}>Bijgewerkt: {formatScanMoment(visibleMutationSummary.recordedAt)}</ThemedText>
              </View>
            ) : (
              <View style={styles.auditWaitingCard}>
                <ThemedText type="defaultSemiBold">{scanDetail('scan.audit.noConfirmation')}</ThemedText>
                <ThemedText style={styles.pendingMeta}>
                  {scanDetail('scan.audit.instruction')}
                </ThemedText>
                <View style={styles.resultDeltaRow}>
                  <View style={styles.resultDeltaChip}>
                    <ThemedText type="defaultSemiBold" style={styles.resultDeltaLabel}>{scanDetail('scan.label.location')}</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.resultDeltaValue}>
                      {selectedDestinationLabel ?? 'Nog niet gekozen'}
                    </ThemedText>
                  </View>
                  <View style={styles.resultDeltaChip}>
                    <ThemedText type="defaultSemiBold" style={styles.resultDeltaLabel}>{scanDetail('scan.label.movement')}</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.resultDeltaValue}>
                      {selectedMovementLabel ?? 'Nog niet gekozen'}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}
            </View>

            <View style={[styles.smartCard, { borderColor: scanCoach.tone, backgroundColor: scanCoach.surface }]}>
              <View style={styles.cardHeaderRow}>
                <MaterialIcons name="psychology" size={20} color={scanCoach.tone} />
                <ThemedText type="defaultSemiBold">Slimme scannersuggesties</ThemedText>
              </View>
              <ThemedText style={[styles.smartCardTitle, { color: scanCoach.tone }]}>
                {scanCoach.title}
              </ThemedText>
              <ThemedText>{scanCoach.detail}</ThemedText>
              <View style={styles.smartSuggestionList}>
                {smartSuggestions.map((suggestion) => (
                  <View key={suggestion} style={styles.smartSuggestionRow}>
                    <View style={[styles.smartSuggestionDot, { backgroundColor: scanCoach.tone }]} />
                    <ThemedText style={styles.smartSuggestionText}>{suggestion}</ThemedText>
                  </View>
                ))}
              </View>
              <Pressable style={styles.cardLinkButton} onPress={() => router.push('/explore')}>
                <ThemedText type="defaultSemiBold" style={styles.cardLinkText}>
                  Open inzichten
                </ThemedText>
              </Pressable>
            </View>

            {ticketSplit ? (
              <View style={styles.ticketPanel}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="receipt-long" size={20} color="#b45309" />
                  <ThemedText type="defaultSemiBold">Kassaticket opsplitsing</ThemedText>
                </View>

                <View style={styles.ticketGrid}>
                  <View style={styles.ticketCard}>
                    <ThemedText style={styles.infoLabel}>Food cost</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.ticketValue}>
                      {ticketSplit.bucket}
                    </ThemedText>
                    <ThemedText>{ticketSplit.bucketDetail}</ThemedText>
                  </View>

                  <View
                    style={[
                      styles.ticketCard,
                      {
                        borderColor: ticketSplit.shelfLife.tone,
                        backgroundColor: ticketSplit.shelfLife.surface,
                      },
                    ]}>
                    <ThemedText style={styles.infoLabel}>Houdbaarheid</ThemedText>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.ticketValue, { color: ticketSplit.shelfLife.tone }]}>
                      {ticketSplit.shelfLife.label}
                    </ThemedText>
                    <ThemedText>{ticketSplit.shelfLife.detail}</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            {scanMode === 'Kassaticket' ? (
              <View style={styles.ticketTextPanel}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="article" size={20} color="#0f172a" />
                  <ThemedText type="defaultSemiBold">Ticket uit tekst</ThemedText>
                </View>
                <ThemedText style={styles.infoLabel}>
                  Plak hier de tekst van het kassaticket. Regels worden automatisch opgesplitst naar hoeveelheid,
                  categorie en prijs. Als je dit leeg laat gebruiken we de automatische regels uit de scanner.
                </ThemedText>
                <TextInput
                value={ticketText}
                onChangeText={setTicketText}
                placeholder="Bijv: 2x Product 1,39\n1x Artikel 2,49\n1x Snack 0,89"
                placeholderTextColor="#94a3b8"
                style={styles.ticketTextArea}
                multiline
              />
              </View>
            ) : null}

            {scanMode === 'Kassaticket' && activeTicketLines.length > 0 ? (
              <View style={styles.ticketBatchPanel}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="playlist-add-check-circle" size={20} color="#1d4ed8" />
                  <ThemedText type="defaultSemiBold">Kassabonregels klaar om te boeken</ThemedText>
                </View>

                <View style={styles.ticketBatchSummary}>
                  <View style={styles.ticketBatchSummaryCard}>
                    <ThemedText style={styles.infoLabel}>Regels</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.ticketBatchSummaryValue}>
                      {activeTicketLines.length}
                    </ThemedText>
                  </View>
                  <View style={styles.ticketBatchSummaryCard}>
                    <ThemedText style={styles.infoLabel}>Ticket totaal</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.ticketBatchSummaryValue}>
                      EUR {ticketTotal.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.ticketBatchSummaryCard}>
                    <ThemedText style={styles.infoLabel}>Food cost</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.ticketBatchSummaryValue}>
                      EUR {totalFoodCost.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.ticketBatchSummaryCard}>
                    <ThemedText style={styles.infoLabel}>Bar cost</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.ticketBatchSummaryValue}>
                      EUR {totalBarCost.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.ticketBatchSummaryCard}>
                    <ThemedText style={styles.infoLabel}>Controle nodig</ThemedText>
                    <ThemedText type="defaultSemiBold" style={styles.ticketBatchSummaryValue}>
                      EUR {totalUnknownCost.toFixed(2)}
                    </ThemedText>
                  </View>
                </View>

                {hasUnknownTicketLines ? (
                  <ThemedText style={styles.pendingMeta}>
                    Onbekende regels worden niet automatisch geboekt. Kies per regel Food cost of Bar cost.
                  </ThemedText>
                ) : null}

                <View style={styles.ticketLineList}>
                  {effectiveTicketLines.map((line) => {
                    const costTone = getReceiptCostBucketTone(line.costBucket);

                    return (
                      <View key={line.id} style={styles.ticketLineRow}>
                        <View style={styles.ticketLineText}>
                          <ThemedText type="defaultSemiBold">{line.name}</ThemedText>
                          <ThemedText style={styles.ticketLineMeta}>
                            {line.category} - {line.location} - {line.bucket}
                          </ThemedText>
                          <View style={styles.ticketCostActionRow}>
                            {(['food_cost', 'bar_cost'] as ReceiptCostBucket[]).map((bucket) => {
                              const active = line.costBucket === bucket;

                              return (
                                <Pressable
                                  key={`${line.id}-${bucket}`}
                                  style={[styles.ticketCostAction, active ? styles.ticketCostActionActive : null]}
                                  onPress={() =>
                                    setTicketCostOverrides((current) => ({
                                      ...current,
                                      [line.id]: bucket,
                                    }))
                                  }>
                                  <ThemedText
                                    type="defaultSemiBold"
                                    style={active ? styles.ticketCostActionTextActive : styles.ticketCostActionText}>
                                    {formatReceiptCostBucket(bucket)}
                                  </ThemedText>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <View style={styles.ticketLineAmount}>
                          <View style={[styles.ticketLineBadge, costTone]}>
                            <ThemedText style={[styles.ticketLineBadgeText, { color: costTone.color }]}>
                              {formatReceiptCostBucket(line.costBucket)}
                            </ThemedText>
                          </View>
                          <ThemedText type="defaultSemiBold">
                            {line.quantity} x EUR {line.unitPrice.toFixed(2)}
                          </ThemedText>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <Pressable
                  style={[
                    styles.ticketBatchButton,
                    !recognition || !selectedDestination || isAnalyzing || hasUnknownTicketLines ? styles.saveButtonDisabled : null,
                  ]}
                  disabled={!recognition || !selectedDestination || isAnalyzing || hasUnknownTicketLines}
                  onPress={handleRegisterTicketBatch}>
                  <MaterialIcons
                    name="receipt-long"
                    size={18}
                    color={!recognition || !selectedDestination || isAnalyzing || hasUnknownTicketLines ? '#94a3b8' : '#ffffff'}
                  />
                  <ThemedText
                    type="defaultSemiBold"
                    style={[
                      styles.ticketBatchButtonText,
                      !recognition || !selectedDestination || isAnalyzing || hasUnknownTicketLines ? styles.saveButtonTextDisabled : null,
                    ]}>
                    {hasUnknownTicketLines
                      ? 'Bevestig onbekende regels eerst'
                      : selectedDestinationLabel
                        ? `Boek inkoop naar ${selectedDestinationLabel}`
                        : 'Kies eerst een locatie'}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            {capturedPhoto ? (
              <Pressable style={styles.previewCard} onPress={() => router.push('/trace')}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="image" size={20} color="#7c3aed" />
                  <ThemedText type="defaultSemiBold">Laatste productfoto</ThemedText>
                </View>
                <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} contentFit="cover" />
                <ThemedText type="defaultSemiBold" style={styles.previewCtaText}>
                  Open track & trace
                </ThemedText>
              </Pressable>
            ) : null}

            {scanMode === 'Product' && (capturedPhoto || scanned || recognition) ? (
              <View style={styles.stockSnapshotCard}>
                <View style={styles.cardHeaderRow}>
                  <MaterialIcons name="inventory-2" size={20} color="#0f172a" />
                  <ThemedText type="defaultSemiBold">Wat staat er in stock?</ThemedText>
                </View>
                <ThemedText style={styles.infoLabel}>
                  {selectedLocation}: {locationStockSnapshot.totalProducts} producten - {locationStockSnapshot.totalUnits} stuks -{' '}
                  {formatEuroAmount(locationStockSnapshot.totalValue)}
                  {locationStockSnapshot.priceMissingCount > 0 ? ' - prijs ontbreekt' : ''}
                </ThemedText>

                <View style={styles.locationCapitalCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="euro" size={18} color="#0f766e" />
                    <ThemedText type="defaultSemiBold">Kapitaal per locatie</ThemedText>
                  </View>
                  <View style={styles.locationCapitalGrid}>
                    {locationCapitalRows.map((row) => (
                      <View key={row.location} style={styles.locationCapitalRow}>
                        <ThemedText type="defaultSemiBold">{row.location}</ThemedText>
                        <ThemedText>{formatEuroAmount(row.stockValue)}</ThemedText>
                        {row.priceMissingCount > 0 ? (
                          <ThemedText style={styles.stockMeta}>prijs ontbreekt</ThemedText>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.locationCapitalCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="trending-down" size={18} color="#b45309" />
                    <ThemedText type="defaultSemiBold">Verbruik en afval</ThemedText>
                  </View>
                  <View style={styles.locationCapitalGrid}>
                    <View style={styles.locationCapitalRow}>
                      <ThemedText type="defaultSemiBold">Totaal Verbruik</ThemedText>
                      <ThemedText>{formatEuroAmount(movementValueBreakdown.totalConsumptionValue)}</ThemedText>
                    </View>
                    <View style={styles.locationCapitalRow}>
                      <ThemedText type="defaultSemiBold">Totaal Afval</ThemedText>
                      <ThemedText>{formatEuroAmount(movementValueBreakdown.totalWasteValue)}</ThemedText>
                    </View>
                    {movementValueBreakdown.byLocation.map((row) => (
                      <View key={`movement-${row.location}`} style={styles.locationCapitalRow}>
                        <ThemedText type="defaultSemiBold">{row.location}</ThemedText>
                        <ThemedText>
                          Verbruik {formatEuroAmount(row.consumptionValue)} - Afval {formatEuroAmount(row.wasteValue)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.lowStockAlertCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="priority-high" size={18} color="#b45309" />
                    <ThemedText type="defaultSemiBold">Aandacht voorraad</ThemedText>
                  </View>
                  {lowStockAlerts.length > 0 ? (
                    <View style={styles.lowStockAlertList}>
                      {lowStockAlerts.slice(0, 8).map((alert) => (
                        <View key={`${alert.itemId}-${alert.location}`} style={styles.lowStockAlertRow}>
                          <ThemedText type="defaultSemiBold">{alert.message}</ThemedText>
                          <ThemedText style={styles.stockMeta}>
                            {alert.productName} - {alert.quantity} {alert.unit} - {alert.location}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <ThemedText style={styles.stockMeta}>Geen lage voorraadmeldingen voor deze locaties.</ThemedText>
                  )}
                </View>

                {relatedInventoryItems.length > 0 ? (
                  <View style={styles.stockList}>
                    {relatedInventoryItems.slice(0, 6).map((item) => (
                      <View key={item.id} style={styles.stockRow}>
                        <ThemedText type="defaultSemiBold">
                          {item.name} - {item.quantity} st.
                        </ThemedText>
                        <ThemedText style={styles.stockMeta}>
                          {item.location} - {item.category} - {formatEuroAmount(item.stockValue)}
                          {item.priceMissing ? ' - prijs ontbreekt' : ''}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.stockList}>
                    {locationStockSnapshot.lowStock.length > 0 ? (
                      locationStockSnapshot.lowStock.map((item) => (
                        <View key={item.id} style={styles.stockRow}>
                          <ThemedText type="defaultSemiBold">
                            {item.name} - {item.quantity} st.
                          </ThemedText>
                          <ThemedText style={styles.stockMeta}>{item.category}</ThemedText>
                          <ThemedText style={styles.stockMeta}>
                            {formatEuroAmount(item.stockValue)}
                            {item.priceMissing ? ' - prijs ontbreekt' : ''}
                          </ThemedText>
                        </View>
                      ))
                    ) : (
                      <ThemedText>Geen stock gevonden in {selectedLocation}.</ThemedText>
                    )}
                  </View>
                )}

                <View style={styles.stockActionsRow}>
                  <Pressable style={styles.stockActionButton} onPress={() => router.push('/explore')}>
                    <ThemedText type="defaultSemiBold" style={styles.stockActionButtonText}>
                      Bekijk stock per locatie
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.stockActionButton} onPress={() => router.push('/alerts')}>
                    <ThemedText type="defaultSemiBold" style={styles.stockActionButtonText}>
                      Open alerts
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.stockActionButton} onPress={() => router.push('/trace')}>
                    <ThemedText type="defaultSemiBold" style={styles.stockActionButtonText}>
                      Track & trace
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.inventoryCard}>
              <View style={styles.cardHeaderRow}>
                <MaterialIcons name="inventory-2" size={20} color="#b45309" />
                <ThemedText type="defaultSemiBold">
                  {scanMode === 'Kassaticket' ? scanActionCopy.purchaseTitle : scanActionCopy.stockTitle}
                </ThemedText>
              </View>
              <ThemedText>
                {scanMode === 'Kassaticket' ? scanActionCopy.purchaseBody : scanActionCopy.stockBody}
                {recognition ? ` ${scanActionCopy.preferredLocation}: ${suggestedLocation}.` : ''}
              </ThemedText>
              {scanMode === 'Kassaticket' ? (
                <View style={styles.locationPicker}>
                  {scanLocationOptions.map((location) => {
                    const active = location === selectedLocation;

                    return (
                      <Pressable
                        key={location}
                        style={[styles.locationChip, active ? styles.locationChipActive : null]}
                        onPress={() => {
                          setLocationTouched(true);
                          setSelectedLocation(location);
                        }}>
                        <ThemedText
                          type="defaultSemiBold"
                          style={active ? styles.locationChipTextActive : styles.locationChipText}>
                          {formatScanLocationLabel(location)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              <View style={styles.locationPicker}>
                {UI_LANGUAGE_OPTIONS.map((option) => {
                  const active = option.code === uiLanguage;

                  return (
                    <Pressable
                      key={option.code}
                      style={[styles.locationChip, active ? styles.locationChipActive : null]}
                      onPress={() => setUiLanguage(option.code)}>
                      <ThemedText
                        type="defaultSemiBold"
                        style={active ? styles.locationChipTextActive : styles.locationChipText}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {false && scanMode === 'Product' ? (
                <View style={styles.manualMovementCard}>
                  <View style={styles.cardHeaderRow}>
                    <MaterialIcons name="swap-horiz" size={20} color="#0f766e" />
                    <ThemedText type="defaultSemiBold">Legacy-flow uitgeschakeld</ThemedText>
                  </View>
                  <ThemedText style={styles.manualMovementBody}>
                    Deze oude lokale verplaatsingsflow is uitgeschakeld in productie. Gebruik de bevestigingskaart met app_state en trace_events sync.
                  </ThemedText>
                  <View style={styles.manualMovementFields}>
                    <View>
                      <ThemedText style={styles.infoLabel}>Product</ThemedText>
                      <TextInput
                        value={manualMovementName}
                        onChangeText={setManualMovementName}
                        placeholder="Productnaam"
                        placeholderTextColor="#94a3b8"
                        style={styles.inlineInput}
                      />
                    </View>
                    <View>
                      <ThemedText style={styles.infoLabel}>Categorie</ThemedText>
                      <TextInput
                        value={manualMovementCategory}
                        onChangeText={setManualMovementCategory}
                        placeholder="Drank"
                        placeholderTextColor="#94a3b8"
                        style={styles.inlineInput}
                      />
                    </View>
                    <View>
                      <ThemedText style={styles.infoLabel}>Van</ThemedText>
                      <TextInput
                        value={manualMovementFrom}
                        onChangeText={setManualMovementFrom}
                        placeholder="Stock"
                        placeholderTextColor="#94a3b8"
                        style={styles.inlineInput}
                      />
                    </View>
                    <View>
                      <ThemedText style={styles.infoLabel}>Naar</ThemedText>
                      <TextInput
                        value={manualMovementTo}
                        onChangeText={setManualMovementTo}
                        placeholder="Bar"
                        placeholderTextColor="#94a3b8"
                        style={styles.inlineInput}
                      />
                    </View>
                    <View>
                      <ThemedText style={styles.infoLabel}>Aantal</ThemedText>
                      <TextInput
                        value={manualMovementQuantity}
                        onChangeText={setManualMovementQuantity}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#94a3b8"
                        style={styles.inlineInput}
                      />
                    </View>
                  </View>
                  <View style={styles.liveStockCard}>
                    <View style={styles.cardHeaderRow}>
                      <MaterialIcons name="bar-chart" size={20} color="#0f766e" />
                      <ThemedText type="defaultSemiBold">Live voorraad</ThemedText>
                    </View>
                    <ThemedText style={styles.manualMovementBody}>
                      {liveMovementStock.productLabel} - {liveMovementStock.categoryLabel}
                    </ThemedText>
                    <View style={styles.liveStockList}>
                      {liveMovementStock.rows.map((row) => (
                        <View key={row.location} style={styles.liveStockRow}>
                          <ThemedText type="defaultSemiBold" style={styles.liveStockLocation}>
                            {row.location}
                          </ThemedText>
                          <ThemedText type="defaultSemiBold" style={styles.liveStockQuantity}>
                            {row.quantity}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                    {!manualMovementName.trim() && !manualMovementCategory.trim() ? (
                      <ThemedText style={styles.liveStockHint}>
                        Vul product en categorie in om live aantallen te tonen. Ontbrekende voorraad verschijnt als 0.
                      </ThemedText>
                    ) : null}
                    {latestManualMovementText ? (
                      <ThemedText style={styles.liveStockMovementText}>{latestManualMovementText}</ThemedText>
                    ) : null}
                  </View>
                  {manualExpiryItem ? (
                    <View style={styles.expiryCard}>
                      <View style={styles.cardHeaderRow}>
                        <MaterialIcons name="event-available" size={20} color="#0f766e" />
                        <ThemedText type="defaultSemiBold">Vervaldatum & actie</ThemedText>
                      </View>
                      <View style={styles.expiryMetaGrid}>
                        <View style={styles.expiryMetaField}>
                          <ThemedText style={styles.infoLabel}>Product</ThemedText>
                          <ThemedText type="defaultSemiBold">{manualExpiryItem.name}</ThemedText>
                        </View>
                        <View style={styles.expiryMetaField}>
                          <ThemedText style={styles.infoLabel}>Location</ThemedText>
                          <ThemedText type="defaultSemiBold">{manualExpiryItem.location}</ThemedText>
                        </View>
                        <View style={styles.expiryMetaField}>
                          <ThemedText style={styles.infoLabel}>Quantity</ThemedText>
                          <ThemedText type="defaultSemiBold">{manualExpiryItem.quantity}</ThemedText>
                        </View>
                        <View style={styles.expiryMetaField}>
                          <ThemedText style={styles.infoLabel}>Expiry date</ThemedText>
                          <ThemedText type="defaultSemiBold">{formatExpiryDateLabel(manualExpiryItem.expiryDate)}</ThemedText>
                        </View>
                        <View style={styles.expiryMetaField}>
                          <ThemedText style={styles.infoLabel}>Status</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {formatTranslatedExpiryStatusLabel(manualExpiryItem.expiryStatus, uiLanguage)}
                          </ThemedText>
                        </View>
                        <View style={styles.expiryMetaField}>
                          <ThemedText style={styles.infoLabel}>Recommended action</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {translateOperationalLabel(manualExpiryItem.recommendedAction, uiLanguage)}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.expiryReasonText}>{manualExpiryItem.recommendedReason}</ThemedText>
                    </View>
                  ) : null}
                  {activeDispatch ? (
                    <View style={styles.dispatchCard}>
                      <View style={styles.cardHeaderRow}>
                        <MaterialIcons name="local-shipping" size={20} color="#1d4ed8" />
                        <ThemedText type="defaultSemiBold">Vertrekcontrole</ThemedText>
                      </View>
                      <ThemedText style={styles.manualMovementBody}>
                        Persisterende controle voor goederen die uit stock vertrekken. De stappen blijven zichtbaar na refresh.
                      </ThemedText>

                      <View style={styles.dispatchMetaGrid}>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Dispatch ID</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.dispatchId}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Product</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.product}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Categorie</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.category}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Aantal</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.quantity}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Van</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.fromLocation}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Bestemming</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.destination}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Huidige status</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {formatDispatchStatusLabel(activeDispatch.status, uiLanguage)}
                          </ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Chauffeur</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.driverName}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Manager</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.managerName}</ThemedText>
                        </View>
                      </View>

                      <View style={styles.dispatchProofCard}>
                        <View style={styles.cardHeaderRow}>
                          <MaterialIcons name="photo-library" size={18} color="#0f766e" />
                          <ThemedText type="defaultSemiBold">Foto bewijs</ThemedText>
                        </View>
                        {activeDispatch.photoUri ? (
                          <Image source={{ uri: activeDispatch.photoUri }} style={styles.dispatchPhotoPreview} contentFit="cover" />
                        ) : (
                          <View style={styles.dispatchPhotoPlaceholder}>
                            <ThemedText type="defaultSemiBold" style={styles.dispatchPhotoPlaceholderText}>
                              {translateOperationalLabel(activeDispatch.photoPlaceholder ?? 'Foto bewijs toegevoegd', uiLanguage)}
                            </ThemedText>
                            <ThemedText style={styles.dispatchProofNote}>
                              Placeholder actief. De flow blokkeert niet op echte image upload.
                            </ThemedText>
                          </View>
                        )}
                      </View>

                      <View style={styles.dispatchActionStack}>
                        <Pressable
                          style={[styles.dispatchActionButton, !canConfirmDispatchWorkfloor ? styles.dispatchActionButtonDisabled : null]}
                          disabled={!canConfirmDispatchWorkfloor}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = confirmDispatchWorkfloor(activeDispatch.dispatchId);
                            if (result.ok) {
                              setStatusMessage('Werkvloer bevestigd. Klaar voor vertrek.');
                            }
                          }}>
                          <MaterialIcons name="verified" size={18} color="#ffffff" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonText}>
                            Werkvloer bevestigt klaar voor vertrek
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButtonSecondary,
                            !canAddDispatchPhotoProof ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canAddDispatchPhotoProof}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = addDispatchPhotoProof(activeDispatch.dispatchId, {
                              photoUri: capturedPhoto?.uri ?? null,
                              photoPlaceholder: capturedPhoto?.uri ? null : 'Foto bewijs toegevoegd',
                            });
                            if (result.ok) {
                              setStatusMessage(
                                capturedPhoto?.uri
                                  ? 'Foto bewijs toegevoegd uit de huidige scan.'
                                  : 'Foto bewijs toegevoegd als placeholder.'
                              );
                            }
                          }}>
                          <MaterialIcons name="photo-camera" size={18} color="#0f172a" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonSecondaryText}>
                            Foto goederen toevoegen
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButtonSecondary,
                            !canConfirmDispatchDriver ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canConfirmDispatchDriver}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = confirmDispatchDriver(activeDispatch.dispatchId, {
                              driverName: activeDispatch.driverName,
                            });
                            if (result.ok) {
                              setStatusMessage('Chauffeur bevestigd.');
                            }
                          }}>
                          <MaterialIcons name="badge" size={18} color="#0f172a" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonSecondaryText}>
                            Chauffeur bevestigt ontvangst
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButtonSecondary,
                            !canConfirmDispatchManager ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canConfirmDispatchManager}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = confirmDispatchManager(activeDispatch.dispatchId, {
                              managerName: activeDispatch.managerName,
                            });
                            if (result.ok) {
                              setStatusMessage('Manager bevestigd.');
                            }
                          }}>
                          <MaterialIcons name="fact-check" size={18} color="#0f172a" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonSecondaryText}>
                            Manager bevestigt goederen
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButton,
                            !canConfirmDispatchDeparture ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canConfirmDispatchDeparture}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = confirmDispatchDeparture(activeDispatch.dispatchId);
                            if (result.ok) {
                              setStatusMessage('Vertrek bevestigd.');
                            }
                          }}>
                          <MaterialIcons name="local-shipping" size={18} color="#ffffff" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonText}>
                            Chauffeur bevestigt vertrek
                          </ThemedText>
                        </Pressable>
                      </View>

                      <View style={styles.dispatchAuditCard}>
                        <View style={styles.cardHeaderRow}>
                          <MaterialIcons name="history" size={18} color="#0f766e" />
                          <ThemedText type="defaultSemiBold">Audit stappen</ThemedText>
                        </View>
                        <View style={styles.dispatchAuditList}>
                          {activeDispatch.auditEvents.map((event) => (
                            <View key={event.id} style={styles.dispatchAuditRow}>
                              <View style={styles.dispatchAuditText}>
                                <ThemedText type="defaultSemiBold">{event.label}</ThemedText>
                                {translateOperationalLabel(event.label, uiLanguage) !== event.label ? (
                                  <ThemedText style={styles.dispatchAuditDetail}>
                                    {translateOperationalLabel(event.label, uiLanguage)}
                                  </ThemedText>
                                ) : null}
                                <ThemedText style={styles.dispatchAuditDetail}>{event.detail}</ThemedText>
                              </View>
                              <ThemedText style={styles.dispatchAuditTime}>{formatScanMoment(event.createdAt)}</ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : null}
                  {activeDispatch?.departureConfirmedAt ? (
                    <View style={styles.receiptCard}>
                      <View style={styles.cardHeaderRow}>
                        <MaterialIcons name="receipt-long" size={20} color="#7c3aed" />
                        <ThemedText type="defaultSemiBold">Ontvangst & facturatie</ThemedText>
                      </View>
                      <ThemedText style={styles.manualMovementBody}>
                        De klantontvangst, facturatie en administratieve afsluiting blijven zichtbaar na refresh.
                      </ThemedText>

                      <View style={styles.dispatchMetaGrid}>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Klant</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.customerName}</ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Ontvangst status</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {formatDispatchReceiptStatusLabel(activeDispatch.customerReceiptStatus, uiLanguage)}
                          </ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Factuurstatus</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {formatDispatchInvoiceStatusLabel(activeDispatch.invoiceStatus, uiLanguage)}
                          </ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Afboekstatus</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {activeDispatch.goodsClosedAt
                              ? `Afgeboekt op ${formatScanMoment(activeDispatch.goodsClosedAt)}`
                              : 'Nog niet afgeboekt'}
                          </ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Final audit</ThemedText>
                          <ThemedText type="defaultSemiBold">
                            {formatDispatchFinalAuditStatusLabel(activeDispatch.finalAuditStatus, uiLanguage)}
                          </ThemedText>
                        </View>
                        <View style={styles.dispatchMetaField}>
                          <ThemedText style={styles.infoLabel}>Factuurreferentie</ThemedText>
                          <ThemedText type="defaultSemiBold">{activeDispatch.invoiceReference ?? 'Nog niet klaar'}</ThemedText>
                        </View>
                      </View>

                      <View style={styles.dispatchActionStack}>
                        <Pressable
                          style={[
                            styles.dispatchActionButton,
                            !canConfirmDispatchCustomerReceipt ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canConfirmDispatchCustomerReceipt}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = confirmDispatchCustomerReceipt(activeDispatch.dispatchId, {
                              customerName: activeDispatch.customerName,
                            });
                            if (result.ok) {
                              setStatusMessage('Klant bevestigt ontvangst.');
                            }
                          }}>
                          <MaterialIcons name="how-to-reg" size={18} color="#ffffff" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonText}>
                            Klant bevestigt goederen ontvangen
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButtonSecondary,
                            !canReleaseDispatchInvoice ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canReleaseDispatchInvoice}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = releaseDispatchInvoice(activeDispatch.dispatchId);
                            if (result.ok) {
                              setStatusMessage('Facturatie vrijgegeven.');
                            }
                          }}>
                          <MaterialIcons name="publish" size={18} color="#0f172a" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonSecondaryText}>
                            Facturatie vrijgeven
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButtonSecondary,
                            !canPrepareDispatchInvoice ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canPrepareDispatchInvoice}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = prepareDispatchInvoice(activeDispatch.dispatchId);
                            if (result.ok) {
                              setStatusMessage('Factuur klaargezet.');
                            }
                          }}>
                          <MaterialIcons name="description" size={18} color="#0f172a" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonSecondaryText}>
                            Factuur klaarzetten
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButtonSecondary,
                            !canOffbookDispatchGoods ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canOffbookDispatchGoods}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = offbookDispatchGoods(activeDispatch.dispatchId);
                            if (result.ok) {
                              setStatusMessage('Goederen administratief afgeboekt.');
                            }
                          }}>
                          <MaterialIcons name="archive" size={18} color="#0f172a" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonSecondaryText}>
                            Goederen afboeken
                          </ThemedText>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.dispatchActionButton,
                            !canCloseDispatchDossier ? styles.dispatchActionButtonDisabled : null,
                          ]}
                          disabled={!canCloseDispatchDossier}
                          onPress={() => {
                            if (!activeDispatch) return;
                            const result = closeDispatchDossier(activeDispatch.dispatchId);
                            if (result.ok) {
                              setStatusMessage('Dossier afgesloten.');
                            }
                          }}>
                          <MaterialIcons name="task-alt" size={18} color="#ffffff" />
                          <ThemedText type="defaultSemiBold" style={styles.dispatchActionButtonText}>
                            Dossier afsluiten
                          </ThemedText>
                        </Pressable>
                      </View>

                      <View style={styles.dispatchAuditCard}>
                        <View style={styles.cardHeaderRow}>
                          <MaterialIcons name="history" size={18} color="#7c3aed" />
                          <ThemedText type="defaultSemiBold">Ontvangst audit</ThemedText>
                        </View>
                        <View style={styles.dispatchAuditList}>
                          {activeDispatch.receiptAuditEvents.map((event) => (
                            <View key={event.id} style={styles.dispatchAuditRow}>
                              <View style={styles.dispatchAuditText}>
                                <ThemedText type="defaultSemiBold">{event.label}</ThemedText>
                                <ThemedText style={styles.dispatchAuditDetail}>{event.detail}</ThemedText>
                              </View>
                              <ThemedText style={styles.dispatchAuditTime}>{formatScanMoment(event.createdAt)}</ThemedText>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {scanMode === 'Kassaticket' ? (
                <View style={styles.saleForm}>
                  <View style={styles.saleInputGrid}>
                    <View style={styles.saleInputCard}>
                      <ThemedText style={styles.infoLabel}>Aantal ingekocht</ThemedText>
                      <TextInput
                        value={saleQuantityInput}
                        onChangeText={setSaleQuantityInput}
                        keyboardType="numeric"
                        placeholder="1"
                        placeholderTextColor="#94a3b8"
                        style={styles.saleInput}
                      />
                    </View>
                    <View style={styles.saleInputCard}>
                      <ThemedText style={styles.infoLabel}>Inkoopprijs per stuk</ThemedText>
                      <TextInput
                        value={saleUnitPriceInput}
                        onChangeText={setSaleUnitPriceInput}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        placeholderTextColor="#94a3b8"
                        style={styles.saleInput}
                      />
                    </View>
                  </View>

                  <View style={styles.saleInfoBox}>
                    <ThemedText style={styles.infoLabel}>Live inkoopkoppeling</ThemedText>
                    <ThemedText>
                      {matchedSaleItem
                        ? `Match met bestaande stock: ${matchedSaleItem.name} in ${matchedSaleItem.location}.`
                        : 'Geen directe stockmatch gevonden. Inkoop wordt toegevoegd aan de gekozen locatie.'}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {scanMode === 'Kassaticket' ? (
                <Pressable
                  style={[
                    styles.saveButton,
                    !recognition || !selectedDestination || isAnalyzing ? styles.saveButtonDisabled : null,
                  ]}
                  disabled={!recognition || !selectedDestination || isAnalyzing}
                  onPress={() => {
                    if (scanAccessSummary.isLocked) {
                      router.push('/payments');
                      return;
                    }
                    if (!selectedDestination) {
                      setStatusMessage(`${SCAN_DESTINATION_PROMPT} voordat je de inkoop opslaat.`);
                      return;
                    }
                    handleRegisterReceiptPurchase().catch(() => {});
                  }}>
                  <MaterialIcons
                    name="point-of-sale"
                    size={18}
                    color={!recognition || !selectedDestination || isAnalyzing ? '#94a3b8' : '#ffffff'}
                  />
                  <ThemedText
                    type="defaultSemiBold"
                    style={[
                      styles.saveButtonText,
                      !recognition || !selectedDestination || isAnalyzing ? styles.saveButtonTextDisabled : null,
                    ]}>
                    {isAnalyzing
                      ? 'Analyseren...'
                      : scanAccessSummary.isLocked
                        ? 'Open betalingen'
                        : selectedDestinationLabel
                          ? `Bevestig Inkoop naar ${selectedDestinationLabel}`
                          : 'Kies eerst een locatie'}
                  </ThemedText>
                </Pressable>
              ) : null}
              {saveMessage ? <ThemedText style={styles.saveMessage}>{saveMessage}</ThemedText> : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </ThemedView>
  );
}

function CenteredPanel({
  icon,
  title,
  body,
  cta,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  body: string;
  cta?: string;
  onPress?: () => void;
}) {
  return (
    <ThemedView style={styles.centeredScreen}>
      <View style={styles.centeredCard}>
        <View style={styles.centeredIconWrap}>
          <MaterialIcons name={icon} size={40} color="#0f766e" />
        </View>
        <ThemedText type="title" style={styles.centeredTitle}>
          {title}
        </ThemedText>
        <ThemedText style={styles.centeredBody}>{body}</ThemedText>
        {cta && onPress ? (
          <Pressable style={styles.primaryAction} onPress={onPress}>
            <ThemedText type="defaultSemiBold" style={styles.primaryActionText}>
              {cta}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  prominent,
}: {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  prominent?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        prominent ? styles.actionButtonProminent : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
      disabled={disabled}
      onPress={onPress}>
      <MaterialIcons
        name={icon}
        size={22}
        color={
          disabled ? '#94a3b8' : prominent ? '#ffffff' : '#0f766e'
        }
      />
      <ThemedText
        type="defaultSemiBold"
        style={[
          styles.actionLabel,
          prominent ? styles.actionLabelProminent : null,
          disabled ? styles.actionLabelDisabled : null,
        ]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Brand.dark,
  },
  screenReaderOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    opacity: 0,
  },
  webPreviewScreen: {
    flex: 1,
    backgroundColor: Brand.dark,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webPreviewCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    padding: 24,
    gap: 14,
    alignItems: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.28,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
    boxShadow: '0px 20px 50px rgba(5, 8, 22, 0.28)',
  },
  webPreviewLogoShell: {
    width: 92,
    height: 92,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#050816',
  },
  webPreviewLogo: {
    width: '100%',
    height: '100%',
  },
  webPreviewTitle: {
    color: '#f8fafc',
    textAlign: 'center',
  },
  webPreviewBody: {
    color: '#cbd5e1',
    textAlign: 'center',
  },
  webPreviewBullets: {
    width: '100%',
    gap: 8,
  },
  webPreviewBulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  webPreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2dd4bf',
    marginTop: 7,
  },
  webPreviewBulletText: {
    flex: 1,
    color: '#e2e8f0',
  },
  webPreviewActions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  webPreviewActionPrimary: {
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 18,
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  webPreviewActionPrimaryText: {
    color: '#ffffff',
  },
  webPreviewActionSecondary: {
    flexGrow: 1,
    minWidth: 150,
    borderRadius: 18,
    backgroundColor: 'rgba(148,163,184,0.14)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  webPreviewActionSecondaryText: {
    color: '#e2e8f0',
  },
  cameraShell: {
    flex: 1,
    backgroundColor: Brand.dark,
  },
  camera: {
    flex: 1,
  },
  hiddenScanDetails: {
    display: 'none',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 118, 110, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  statusBadgeText: {
    color: '#fff',
  },
  brandScanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5, 8, 22, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  brandScanLogo: {
    width: 24,
    height: 24,
    borderRadius: 999,
  },
  brandScanText: {
    color: '#f8fafc',
    fontSize: 12,
  },
  statusPill: {
    maxWidth: '100%',
    backgroundColor: 'rgba(5, 8, 22, 0.72)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusPillText: {
    color: '#e2e8f0',
  },
  scanArea: {
    alignItems: 'center',
    gap: 18,
    marginTop: 14,
  },
  compactScanPanel: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginTop: 10,
    gap: 12,
    shadowColor: Brand.dark,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  compactScanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactScanCopy: {
    flex: 1,
    gap: 2,
  },
  compactScanTitle: {
    color: '#0f172a',
  },
  compactScanBody: {
    color: Brand.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  compactScanActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  compactScanButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginRight: 8,
  },
  compactScanButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  compactScanButtonSecondary: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginLeft: 8,
  },
  compactProposalCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.22)',
    gap: 8,
    shadowColor: Brand.dark,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  compactProposalLabel: {
    color: '#0f766e',
  },
  compactProposalName: {
    color: '#0f172a',
    lineHeight: 26,
  },
  compactProposalMeta: {
    color: Brand.inkMuted,
    fontSize: 13,
  },
  compactSuggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  compactHumanNote: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 17,
  },
  compactProposalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  compactConfirmButton: {
    flexGrow: 1,
    flexBasis: 130,
    borderRadius: 12,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  compactConfirmButtonText: {
    color: '#ffffff',
  },
  compactEditButton: {
    flexGrow: 1,
    flexBasis: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  compactEditButtonText: {
    color: '#0f172a',
  },
  scanFrame: {
    width: '82%',
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(15, 23, 42, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  scanCenterIcon: {
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 118, 110, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: '#2dd4bf',
  },
  cornerTopLeft: {
    top: 14,
    left: 14,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 14,
    right: 14,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanQuickActions: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
  },
  scanQuickButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scanQuickButtonSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scanQuickButtonConfirm: {
    flex: 1.25,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  scanQuickButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  bottomSheet: {
    borderRadius: 32,
    backgroundColor: 'rgba(248, 250, 252, 0.98)',
    paddingTop: 20,
    paddingBottom: 150,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: Brand.dark,
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 4,
    boxShadow: '0px -10px 28px rgba(15, 23, 42, 0.10)',
  },
  scanAccessCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(187, 247, 208, 0.9)',
    backgroundColor: 'rgba(236, 253, 245, 0.96)',
    padding: 14,
    gap: 10,
  },
  scanAccessLine: {
    height: 4,
    width: 76,
    borderRadius: 999,
    marginBottom: 2,
  },
  scanAccessLineActive: {
    backgroundColor: '#0f766e',
  },
  scanAccessLineLocked: {
    backgroundColor: '#f59e0b',
  },
  scanAccessCardLocked: {
    borderColor: '#fdba74',
    backgroundColor: 'rgba(255, 247, 237, 0.96)',
  },
  scanAccessText: {
    color: '#0f172a',
    lineHeight: 21,
  },
  scanAccessMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scanAccessBadge: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scanAccessBadgeText: {
    color: '#334155',
    fontSize: 12,
    textAlign: 'center',
    flexShrink: 1,
  },
  scanAccessActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  scanAccessButton: {
    borderRadius: 12,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  scanAccessButtonText: {
    color: '#ffffff',
  },
  bottomHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  bottomHeaderText: {
    flex: 1,
    gap: 3,
  },
  talkbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(186, 230, 253, 0.8)',
    backgroundColor: 'rgba(240, 249, 255, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  talkbackText: {
    color: '#0f172a',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeChip: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 130,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  modeChipText: {
    color: '#334155',
  },
  modeChipTextActive: {
    color: '#ffffff',
  },
  aiBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 106,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: 'rgba(236, 253, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(153, 246, 228, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 12,
    shadowColor: Brand.dark,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  actionButtonProminent: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  actionButtonDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  actionLabel: {
    color: '#0f172a',
    textAlign: 'center',
  },
  actionLabelProminent: {
    color: '#fff',
  },
  actionLabelDisabled: {
    color: '#94a3b8',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    flexGrow: 1,
    flexBasis: 230,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    gap: 4,
    shadowColor: Brand.dark,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  cardLinkButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.85)',
    backgroundColor: 'rgba(219, 234, 254, 0.96)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  cardLinkText: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    color: '#0f172a',
    outlineStyle: 'none' as any,
  },
  recognitionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  smallButton: {
    borderRadius: 12,
    backgroundColor: '#0f766e',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    flexShrink: 1,
  },
  smallButtonSecondary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallButtonSecondaryText: {
    color: '#0f172a',
    textAlign: 'center',
    flexShrink: 1,
  },
  smallButtonActive: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b91c1c',
    backgroundColor: 'rgba(254, 242, 242, 0.96)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallButtonActiveText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  smallButtonLearn: {
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  smallButtonLearnText: {
    color: '#ffffff',
    textAlign: 'center',
    flexShrink: 1,
  },
  recognitionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  confidenceBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  confidenceBadgeText: {
    fontWeight: '700',
  },
  batchLotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  batchChip: {
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  batchChipText: {
    color: '#4338ca',
    fontWeight: '600',
  },
  lotChip: {
    borderRadius: 999,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  lotChipText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  recallChip: {
    borderRadius: 999,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  recallChipText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  smartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  smartCardTitle: {
    fontSize: 17,
  },
  smartSuggestionList: {
    gap: 8,
  },
  smartSuggestionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  smartSuggestionDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 7,
  },
  smartSuggestionText: {
    flex: 1,
    color: '#334155',
  },
  ticketPanel: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#fed7aa',
    gap: 10,
  },
  ticketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  ticketCard: {
    flexGrow: 1,
    flexBasis: 220,
    minWidth: 180,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 4,
  },
  ticketValue: {
    color: '#b45309',
    fontSize: 18,
  },
  ticketTextPanel: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 8,
  },
  ticketTextArea: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 110,
    textAlignVertical: 'top',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  ticketBatchPanel: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 12,
  },
  ticketBatchSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  ticketBatchSummaryCard: {
    flexGrow: 1,
    flexBasis: 180,
    minWidth: 160,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    gap: 4,
  },
  ticketBatchSummaryValue: {
    color: '#1d4ed8',
    fontSize: 18,
  },
  ticketLineList: {
    gap: 10,
  },
  ticketLineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  ticketLineText: {
    flex: 1,
    minWidth: 180,
    gap: 3,
  },
  ticketLineMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  ticketLineAmount: {
    alignItems: 'flex-start',
    minWidth: 140,
    gap: 6,
  },
  ticketLineBadge: {
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ticketLineBadgeText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketCostActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  ticketCostAction: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.55)',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ticketCostActionActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  ticketCostActionText: {
    color: '#334155',
    fontSize: 12,
  },
  ticketCostActionTextActive: {
    color: '#ffffff',
    fontSize: 12,
  },
  ticketBatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  ticketBatchButtonText: {
    color: '#ffffff',
  },
  multiPhotoCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 10,
  },
  multiPhotoList: {
    gap: 6,
  },
  multiPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiPhotoDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#0f172a',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 13,
  },
  scanSafetyNote: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  recognitionName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 28,
    flexShrink: 1,
  },
  recognitionCategory: {
    color: '#334155',
    lineHeight: 20,
    flexShrink: 1,
  },
  recognitionNotes: {
    color: '#475569',
    lineHeight: 20,
    flexShrink: 1,
  },
  destinationCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(236, 253, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
    gap: 12,
  },
  destinationTitle: {
    color: '#0f766e',
    fontSize: 18,
  },
  destinationBody: {
    color: Brand.inkMuted,
  },
  scanWorkflowBlock: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    gap: 12,
  },
  scanWorkflowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  scanWorkflowStepBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  scanWorkflowStepText: {
    color: '#ffffff',
  },
  scanWorkflowCopy: {
    flex: 1,
    gap: 3,
  },
  scanWorkflowTitle: {
    color: '#0f172a',
    fontSize: 17,
    lineHeight: 22,
  },
  scanWorkflowBody: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  destinationStepTitle: {
    color: '#0f172a',
    marginTop: 2,
  },
  aiAdviceCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(250, 245, 255, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
    gap: 10,
  },
  scanDebugCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(236, 253, 245, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
    gap: 6,
  },
  scanDebugTitle: {
    color: '#0f766e',
  },
  scanBuildLabel: {
    color: '#0f172a',
    fontSize: 12,
  },
  scanDebugRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  scanDebugDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  scanDebugDotOk: {
    backgroundColor: '#0f766e',
  },
  scanDebugDotPending: {
    backgroundColor: '#f59e0b',
  },
  scanDebugLabel: {
    minWidth: 132,
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  scanDebugValue: {
    flex: 1,
    minWidth: 140,
    color: '#475569',
    fontSize: 12,
  },
  scanRuntimeProposalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.22)',
    gap: 6,
  },
  scanRuntimeProposalText: {
    color: '#0f172a',
    lineHeight: 18,
  },
  destinationInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  destinationInputCard: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 160,
    gap: 6,
  },
  destinationInputCardCompact: {
    flexGrow: 1,
    flexBasis: 110,
    minWidth: 100,
    gap: 6,
  },
  locationPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'flex-end',
  },
  coldLocationControl: {
    alignItems: 'center',
    gap: 6,
  },
  temperatureAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  temperatureStepButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.22)',
    backgroundColor: 'rgba(240, 253, 250, 0.96)',
  },
  temperatureCircle: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(15, 118, 110, 0.32)',
    backgroundColor: '#ffffff',
  },
  temperatureCircleActive: {
    borderColor: '#0f766e',
    backgroundColor: '#ccfbf1',
  },
  temperatureText: {
    color: '#0f766e',
    fontSize: 15,
  },
  temperatureTextActive: {
    color: '#0f172a',
    fontSize: 15,
  },
  locationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coldLocationChip: {
    minWidth: 92,
    alignItems: 'center',
  },
  locationChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#0f766e',
  },
  locationChipText: {
    color: '#334155',
  },
  locationChipTextActive: {
    color: '#ffffff',
  },
  previewCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(221, 214, 254, 0.8)',
    gap: 10,
  },
  previewCtaText: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  stockSnapshotCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    gap: 10,
  },
  stockList: {
    gap: 8,
  },
  locationCapitalCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: 'rgba(236, 253, 245, 0.78)',
    gap: 8,
  },
  locationCapitalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationCapitalRow: {
    minWidth: 132,
    flexGrow: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.1)',
    gap: 2,
  },
  lowStockAlertCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.22)',
    backgroundColor: 'rgba(255, 251, 235, 0.88)',
    gap: 8,
  },
  lowStockAlertList: {
    gap: 8,
  },
  lowStockAlertRow: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.16)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    gap: 2,
  },
  stockRow: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    gap: 2,
  },
  stockMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  stockActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stockActionButton: {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockActionButtonText: {
    color: '#ffffff',
  },
  inventoryCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(255, 251, 235, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.8)',
    gap: 10,
  },
  manualMovementCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 14,
  },
  manualMovementBody: {
    color: Brand.inkMuted,
  },
  manualMovementFields: {
    gap: 8,
  },
  liveStockCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: 'rgba(236, 253, 255, 0.72)',
    padding: 14,
  },
  liveStockList: {
    gap: 8,
  },
  liveStockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveStockLocation: {
    color: '#0f172a',
  },
  liveStockQuantity: {
    color: '#0f766e',
  },
  liveStockHint: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  liveStockMovementText: {
    color: '#0f766e',
    fontWeight: '600',
  },
  expiryCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(240, 253, 250, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    gap: 10,
  },
  expiryMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  expiryMetaField: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    gap: 4,
  },
  expiryReasonText: {
    color: '#0f766e',
    fontSize: 13,
    lineHeight: 18,
  },
  dispatchCard: {
    gap: 10,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(239, 246, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(29, 78, 216, 0.16)',
  },
  receiptCard: {
    gap: 10,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(250, 245, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
  },
  dispatchMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dispatchMetaField: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 140,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(29, 78, 216, 0.08)',
    gap: 4,
  },
  dispatchProofCard: {
    gap: 8,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.16)',
  },
  dispatchProofNote: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  dispatchPhotoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
  },
  dispatchPhotoPlaceholder: {
    gap: 6,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(240, 253, 250, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.12)',
  },
  dispatchPhotoPlaceholderText: {
    color: '#0f766e',
  },
  dispatchActionStack: {
    gap: 8,
  },
  dispatchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0f766e',
  },
  dispatchActionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  dispatchActionButtonDisabled: {
    opacity: 0.45,
  },
  dispatchActionButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    flexShrink: 1,
  },
  dispatchActionButtonSecondaryText: {
    color: '#0f172a',
    textAlign: 'center',
    flexShrink: 1,
  },
  dispatchAuditCard: {
    gap: 10,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  dispatchAuditList: {
    gap: 8,
  },
  dispatchAuditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  dispatchAuditText: {
    flex: 1,
    gap: 2,
  },
  dispatchAuditDetail: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  dispatchAuditTime: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'right',
  },
  saleForm: {
    gap: 10,
  },
  saleInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'stretch',
  },
  saleInputCard: {
    flexGrow: 1,
    flexBasis: 190,
    minWidth: 150,
    gap: 6,
  },
  saleInput: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    color: '#0f172a',
  },
  saleInfoBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.8)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 12,
    gap: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  productConfirmButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  productConfirmButtonReady: {
    backgroundColor: '#0f766e',
  },
  productConfirmButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  productConfirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  productConfirmButtonTextDisabled: {
    color: '#64748b',
  },
  productConfirmDetail: {
    color: '#0f766e',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmBlockerText: {
    color: '#b45309',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  saveButtonText: {
    color: '#ffffff',
  },
  saveButtonTextDisabled: {
    color: '#94a3b8',
  },
  saveMessage: {
    color: '#0f766e',
    fontWeight: '600',
  },
  resultCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: 'rgba(240, 253, 250, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.28)',
    gap: 12,
  },
  auditWaitingCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    gap: 10,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resultField: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 120,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    gap: 4,
  },
  resultDeltaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultDeltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  resultDeltaLabel: {
    color: '#0f172a',
  },
  resultDeltaValue: {
    color: '#0f766e',
  },
  pendingMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  centeredScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Brand.canvas,
  },
  centeredCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    boxShadow: '0px 18px 40px rgba(15, 23, 42, 0.08)',
  },
  centeredIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 253, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredTitle: {
    fontSize: 28,
    lineHeight: 30,
    textAlign: 'center',
  },
  centeredBody: {
    textAlign: 'center',
    color: Brand.inkMuted,
  },
  manualScanPanel: {
    width: '100%',
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.14)',
    backgroundColor: 'rgba(236, 253, 255, 0.75)',
    padding: 16,
    marginTop: 4,
  },
  manualScanTitle: {
    color: '#0f766e',
  },
  manualScanBody: {
    color: Brand.inkMuted,
  },
  manualScanInput: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 118, 110, 0.18)',
    backgroundColor: '#ffffff',
    color: Brand.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  manualScanButton: {
    borderRadius: 16,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manualScanButtonText: {
    color: '#ffffff',
  },
  primaryAction: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: '#0f766e',
    paddingHorizontal: 18,
    paddingVertical: 12,
    shadowColor: Brand.dark,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  primaryActionText: {
    color: '#ffffff',
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  correctButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  correctButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
  auditList: {
    gap: 4,
  },
});

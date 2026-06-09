import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeType } from 'expo-camera';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { addLiveAlertEvent, addOrMergeInventoryItem, registerInventoryIntakeFollowUps } from 'hooks/use-inventory';
import { recognizeProduct, type RecognitionResult } from 'lib/recognition';
import { appendTraceEvent } from 'lib/trace-event-log';
import { ThemedText } from 'components/themed-text';
import { ThemedView } from 'components/themed-view';

type Props = {
  locations: string[];
  defaultLocation: string | null;
};

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

const WEB_BARCODE_TYPES: BarcodeType[] = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_e', 'upc_a', 'pdf417', 'aztec', 'datamatrix'];

export function StockhubCamera({ locations, defaultLocation }: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [expanded, setExpanded] = useState(false);
  const [scanLocation, setScanLocation] = useState<string>('');
  const [locationTouched, setLocationTouched] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [status, setStatus] = useState('Open camera om een product te herkennen.');
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<{ uri: string; base64: string | null } | null>(null);
  const [recognition, setRecognition] = useState<RecognitionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const canUseCamera = Platform.OS === 'web' || Platform.OS === 'android' || Platform.OS === 'ios';
  const barcodeTypes: BarcodeType[] = Platform.OS === 'web' ? WEB_BARCODE_TYPES : NATIVE_BARCODE_TYPES;

  const resolvedDefaultLocation = useMemo(() => {
    if (defaultLocation && locations.includes(defaultLocation)) return defaultLocation;
    return locations[0] ?? 'Hoofdvestiging';
  }, [defaultLocation, locations]);

  useEffect(() => {
    if (locationTouched) return;
    setScanLocation(resolvedDefaultLocation);
  }, [locationTouched, resolvedDefaultLocation]);

  async function analyze(input: { barcode?: string | null; imageBase64?: string | null; imageUri?: string | null }) {
    setBusy(true);
    setStatus('AI analyseert...');
    try {
      const result = await recognizeProduct(input);
      setRecognition(result);
      setStatus(`Herkenning klaar: ${result.name} (${Math.round(result.confidence * 100)}%).`);

      const location = scanLocation?.trim() || resolvedDefaultLocation;
      if (result.expiryDays !== null && result.expiryDays <= 2) {
        addLiveAlertEvent({
          event: 'expiry',
          title: 'Camera: verval / waste alert',
          detail: `${result.name} · ${result.expiryDays <= 0 ? 'vandaag opvolgen' : `nog ${result.expiryDays} dagen`} · ${location}`,
          href: '/alerts',
          location,
        });
      } else if (result.confidence < 0.75) {
        addLiveAlertEvent({
          event: 'recognition',
          title: 'Camera: AI controle nodig',
          detail: `${result.name} · zekerheid ${Math.round(result.confidence * 100)}% · ${location}`,
          href: '/alerts',
          location,
        });
      } else {
        const barcode = (input.barcode ?? result.barcode ?? '').trim();
        addLiveAlertEvent({
          event: 'trace',
          title: 'Camera: live geregistreerd',
          detail: `${result.name} · ${location}${barcode ? ` · barcode ${barcode}` : ''}`,
          href: '/trace',
          location,
        });
      }
    } catch {
      setStatus('Herkenning faalde. Probeer opnieuw met een betere foto of barcode.');
    } finally {
      setBusy(false);
    }
  }

  const handleBarcodeScanned = (event: any) => {
    if (!expanded) return;
    if (busy) return;
    const barcode = typeof event?.data === 'string' ? event.data.trim() : '';
    if (!barcode) return;
    if (barcode === scannedBarcode) return;
    setScannedBarcode(barcode);
    setCapturedPhoto(null);
    setRecognition(null);
    analyze({ barcode, imageBase64: null, imageUri: null });
  };

  async function handleCapturePhoto() {
    if (!expanded) return;
    if (busy) return;
    if (!cameraRef.current) return;

    setBusy(true);
    setStatus('Foto nemen...');
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6, exif: false });
      const base64 = typeof photo?.base64 === 'string' ? photo.base64 : null;
      const uri = typeof photo?.uri === 'string' ? photo.uri : '';

      setCapturedPhoto({ uri, base64 });
      setRecognition(null);
      await analyze({ barcode: scannedBarcode, imageBase64: base64, imageUri: uri || null });
    } catch {
      setStatus('Foto nemen mislukte. Probeer opnieuw.');
      setBusy(false);
    }
  }

  function handleReset() {
    setScannedBarcode(null);
    setCapturedPhoto(null);
    setRecognition(null);
    setStatus('Open camera om een product te herkennen.');
  }

  function handleSave() {
    if (!recognition) return;
    const location = scanLocation?.trim() || resolvedDefaultLocation;

    const result = addOrMergeInventoryItem({
      name: recognition.name,
      category: recognition.category,
      quantity: Math.max(1, Math.round(recognition.quantity ?? 1)),
      expiryDays: recognition.expiryDays ?? null,
      confidence: recognition.confidence ?? null,
      notes: recognition.notes ?? '',
      barcode: recognition.barcode ?? scannedBarcode ?? null,
      photoUri: capturedPhoto?.uri ?? null,
      source: recognition.source ?? 'scan',
      batchCode: recognition.batchCode ?? null,
      lotNumber: recognition.lotNumber ?? null,
      recallFlag: recognition.recallFlag ?? false,
      location,
    });

    registerInventoryIntakeFollowUps({
      itemId: result.itemId,
      itemName: recognition.name,
      location,
      expiryDays: recognition.expiryDays ?? null,
      confidence: recognition.confidence ?? null,
      recallFlag: recognition.recallFlag ?? false,
      mode: result.mode,
      matchedBy: result.matchedBy,
    });
    appendTraceEvent({
      eventKind: 'scan_saved',
      itemId: result.itemId,
      itemName: recognition.name,
      location,
      fromLocation: null,
      toLocation: location,
      quantity: Math.max(1, Math.round(recognition.quantity ?? 1)),
      source: recognition.source ?? 'camera',
      barcode: recognition.barcode ?? scannedBarcode ?? null,
      batchCode: recognition.batchCode ?? null,
      lotNumber: recognition.lotNumber ?? null,
      confidence: recognition.confidence ?? null,
      expiryDays: recognition.expiryDays ?? null,
      note: result.mode === 'merged' ? 'Cameraherkenning samengevoegd met bestaande stock' : 'Cameraherkenning opgeslagen',
    }).catch(() => {});

    setStatus(
      result.mode === 'merged'
        ? `Samengevoegd in ${location}. Nieuwe voorraad: ${result.nextQuantity}.`
        : `Opgeslagen in ${location}. Live stock is bijgewerkt.`
    );
    handleReset();
  }

  if (!canUseCamera) {
    return null;
  }

  return (
    <ThemedView style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <ThemedText type="defaultSemiBold">Live camera</ThemedText>
          <ThemedText style={styles.headerMeta}>
            Scan barcode of neem een foto. Opslag gaat direct naar je live vestigingen.
          </ThemedText>
        </View>
        <Pressable style={styles.headerButton} onPress={() => setExpanded((v) => !v)}>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={20} color="#0f172a" />
          <ThemedText type="defaultSemiBold">{expanded ? 'Sluit' : 'Open'}</ThemedText>
        </Pressable>
      </View>

      <View style={styles.locationRow}>
        {locations.map((location) => {
          const active = (scanLocation || resolvedDefaultLocation) === location;
          return (
            <Pressable
              key={location}
              style={[styles.locationChip, active ? styles.locationChipActive : null]}
              onPress={() => {
                setLocationTouched(true);
                setScanLocation(location);
              }}>
              <ThemedText type="defaultSemiBold" style={active ? styles.locationChipTextActive : styles.locationChipText}>
                {location}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {expanded ? (
        <>
          {!permission ? (
            <View style={styles.notice}>
              <ThemedText>Camera wordt voorbereid...</ThemedText>
            </View>
          ) : !permission.granted ? (
            <Pressable style={styles.permissionButton} onPress={() => requestPermission()}>
              <MaterialIcons name="camera-alt" size={18} color="#0f766e" />
              <ThemedText type="defaultSemiBold" style={styles.permissionText}>
                Geef cameratoegang
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.cameraShell}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
                enableTorch={torchEnabled}
                ratio="16:9"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes,
                }}
              />
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={styles.smallButton}
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
              <MaterialIcons name="flip-camera-ios" size={18} color="#0f172a" />
              <ThemedText type="defaultSemiBold">Flip</ThemedText>
            </Pressable>
            <Pressable
              style={styles.smallButton}
              onPress={() => setTorchEnabled((v) => !v)}>
              <MaterialIcons name={torchEnabled ? 'flash-on' : 'flash-off'} size={18} color="#0f172a" />
              <ThemedText type="defaultSemiBold">Torch</ThemedText>
            </Pressable>
            <Pressable style={styles.primaryButton} disabled={!permission?.granted || busy} onPress={handleCapturePhoto}>
              <MaterialIcons name="photo-camera" size={18} color="#ffffff" />
              <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                Foto + herkenning
              </ThemedText>
            </Pressable>
            <Pressable style={styles.smallButton} onPress={handleReset}>
              <MaterialIcons name="restart-alt" size={18} color="#0f172a" />
              <ThemedText type="defaultSemiBold">Reset</ThemedText>
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.statusBox}>
        <ThemedText style={styles.statusLabel}>Status</ThemedText>
        <ThemedText>{status}</ThemedText>
        {recognition ? (
          <View style={styles.recognitionBox}>
            <ThemedText type="defaultSemiBold">
              {recognition.name} · {recognition.category}
            </ThemedText>
            <ThemedText style={styles.recognitionMeta}>
              Zekerheid {Math.round((recognition.confidence ?? 0) * 100)}% · Houdbaar {recognition.expiryDays ?? 'n.v.t.'} dagen · Qty{' '}
              {recognition.quantity}
            </ThemedText>
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <MaterialIcons name="save" size={18} color="#ffffff" />
              <ThemedText type="defaultSemiBold" style={styles.saveButtonText}>
                Opslaan naar {scanLocation || resolvedDefaultLocation}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe4ee',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    minWidth: 260,
    gap: 2,
  },
  headerMeta: {
    color: '#475569',
    fontSize: 12,
  },
  headerButton: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  locationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
  },
  locationChipActive: {
    borderColor: '#0f766e',
    backgroundColor: '#dcfce7',
  },
  locationChipText: {
    color: '#0f172a',
  },
  locationChipTextActive: {
    color: '#0f766e',
  },
  cameraShell: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#0f172a',
    height: 220,
  },
  camera: {
    flex: 1,
  },
  notice: {
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  permissionButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0f766e',
    backgroundColor: '#ecfeff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  permissionText: {
    color: '#0f766e',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  smallButton: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  primaryButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f766e',
  },
  primaryButtonText: {
    color: '#ffffff',
  },
  statusBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 14,
    gap: 6,
  },
  statusLabel: {
    color: '#475569',
    fontSize: 12,
  },
  recognitionBox: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe4ee',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 6,
  },
  recognitionMeta: {
    color: '#64748b',
    fontSize: 12,
  },
  saveButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1d4ed8',
  },
  saveButtonText: {
    color: '#ffffff',
  },
});


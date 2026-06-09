import { getRealAiUnavailableMessage } from 'lib/ai-availability';
import { lookupBarcode, type BarcodeLookupResult } from 'lib/barcode';
import { getBarcodeOverride } from 'lib/barcode-overrides';
import { t, type AppLanguage, type TranslationKey } from 'lib/i18n';
import { getServerBaseUrl } from 'lib/server-url';
import { supabase } from 'lib/supabase';

export type RecognitionInput = {
  barcode?: string | null;
  imageBase64?: string | null;
  imageUri?: string | null;
  ocrText?: string | null;
  catalogSeed?: BarcodeLookupResult | null;
};

export type RecognitionApiCandidate = {
  productId: string;
  productName: string;
  confidence: number;
  reason: string;
};

export type RecognitionApiResponse = {
  ok: boolean;
  method: 'vision' | 'barcode' | 'ocr' | 'fallback';
  label: string;
  productId: string | null;
  productName: string | null;
  confidence: number;
  candidates: RecognitionApiCandidate[];
  reason: string;
  result?: Partial<RecognitionResult> & { barcode?: string | null };
};

export type RecognitionResult = {
  name: string;
  category: string;
  quantity: number;
  expiryDays: number | null;
  confidence: number;
  notes: string;
  source: string;
  barcode: string | null;
  batchCode?: string | null;
  lotNumber?: string | null;
  recallFlag?: boolean;
  candidates?: RecognitionApiCandidate[];
};

type CacheEntry = { result: RecognitionResult; expiresAt: number };
const BARCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const BARCODE_CACHE_MAX = 200;
const barcodeCache = new Map<string, CacheEntry>();
const DEMO_MODE_ENABLED = false; // Geforceerd uit voor live test.

function formatRecognitionTranslation(
  template: string,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
}

function recognitionT(key: TranslationKey, language: AppLanguage, replacements?: Record<string, string | number | null | undefined>) {
  return formatRecognitionTranslation(t(key, language), replacements);
}

function getCachedBarcodeResult(barcode: string): RecognitionResult | null {
  const now = Date.now();
  const entry = barcodeCache.get(barcode);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    barcodeCache.delete(barcode);
    return null;
  }
  return entry.result;
}

function setCachedBarcodeResult(barcode: string, result: RecognitionResult) {
  const expiresAt = Date.now() + BARCODE_CACHE_TTL_MS;
  barcodeCache.set(barcode, { result, expiresAt });
  if (barcodeCache.size > BARCODE_CACHE_MAX) {
    const oldest = barcodeCache.keys().next().value as string | undefined;
    if (oldest) barcodeCache.delete(oldest);
  }
}

function inferFromBarcodePattern(barcode: string): Omit<RecognitionResult, 'barcode'> | null {
  if (!barcode) {
    return null;
  }

  if (barcode.startsWith('20') || barcode.startsWith('21')) {
    return {
      name: 'Vers toonbankproduct',
      category: 'Vers',
      quantity: 1,
      expiryDays: 1,
      confidence: 0.72,
      notes: 'Barcodepatroon wijst op een vers of intern geprijsd winkelproduct.',
      source: 'barcode-pattern',
    };
  }

  if (barcode.startsWith('87')) {
    return {
      name: 'Verpakt supermarktproduct',
      category: 'Algemeen',
      quantity: 1,
      expiryDays: 5,
      confidence: 0.67,
      notes: 'Barcodepatroon lijkt op een standaard retailproduct uit een supermarktflow.',
      source: 'barcode-pattern',
    };
  }

  if (barcode.startsWith('54')) {
    return {
      name: 'Belgisch winkelproduct',
      category: 'Algemeen',
      quantity: 1,
      expiryDays: 4,
      confidence: 0.65,
      notes: 'Barcodepatroon wijst op een Belgisch retailproduct. Controleer naam en categorie.',
      source: 'barcode-pattern',
    };
  }

  return null;
}

function getRecognitionUrl() {
  return `${getServerBaseUrl()}/recognize`;
}

function inferFromImage(imageBase64: string | null | undefined, language: AppLanguage): Omit<RecognitionResult, 'barcode'> {
  return {
    name: recognitionT('recognition.error.unknownProduct', language),
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.35,
    notes: recognitionT('recognition.error.liveFallbackNotes', language),
    source: 'live-fallback',
  };
}

function buildLiveUnknownRecognition(input: RecognitionInput, reason: string, language: AppLanguage): RecognitionResult {
  const barcode = input.barcode?.trim() || null;

  return {
    name: barcode ? recognitionT('recognition.error.unknownBarcode', language, { barcode }) : recognitionT('recognition.error.unknownProduct', language),
    category: 'Controle nodig',
    quantity: 1,
    expiryDays: null,
    confidence: 0.2,
    notes: reason,
    source: barcode ? 'barcode-unknown' : 'live-unavailable',
    barcode,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

function inferRecognition(input: RecognitionInput, language: AppLanguage): RecognitionResult {
  if (!DEMO_MODE_ENABLED) {
    return buildLiveUnknownRecognition(
      input,
      recognitionT('recognition.error.liveUnavailableConfig', language),
      language
    );
  }

  const barcode = input.barcode?.trim() || null;
  const barcodePatternMatch = barcode ? inferFromBarcodePattern(barcode) : null;

  const visualMatch = inferFromImage(input.imageBase64, language);

  if (barcode) {
    const mergedBase = barcodePatternMatch ?? visualMatch;
    const combinedConfidence = input.imageBase64
      ? Math.min(0.9, Math.max(mergedBase.confidence, visualMatch.confidence) + 0.08)
      : mergedBase.confidence;

    return {
      ...mergedBase,
      barcode,
      source: input.imageBase64 ? 'foto + barcode' : mergedBase.source,
      confidence: combinedConfidence,
      notes: input.imageBase64
        ? `${recognitionT('recognition.error.unknownBarcode', language, { barcode })}. Barcode en foto samen geven deze inschatting. ${mergedBase.notes}`
        : `${recognitionT('recognition.error.unknownBarcode', language, { barcode })}. ${mergedBase.notes}`,
      batchCode: null,
      lotNumber: null,
      recallFlag: false,
    };
  }

  return {
    ...visualMatch,
    barcode: null,
    batchCode: null,
    lotNumber: null,
    recallFlag: false,
  };
}

function normalizeRecognition(data: Partial<RecognitionResult> & { expiry?: number }, input: RecognitionInput, language: AppLanguage): RecognitionResult {
  const fallback = inferRecognition(input, language);

  return {
    name: data.name ?? fallback.name,
    category: data.category ?? fallback.category,
    quantity: Math.max(1, Number(data.quantity ?? fallback.quantity ?? 1)),
    expiryDays:
      data.expiryDays ?? data.expiry ?? fallback.expiryDays ?? null,
    confidence: Math.min(0.99, Math.max(0.25, Number(data.confidence ?? fallback.confidence ?? 0.6))),
    notes: data.notes ?? fallback.notes,
    source: data.source ?? fallback.source,
    barcode: data.barcode ?? input.barcode ?? fallback.barcode,
    batchCode: data.batchCode ?? fallback.batchCode ?? null,
    lotNumber: data.lotNumber ?? fallback.lotNumber ?? null,
    recallFlag: data.recallFlag ?? fallback.recallFlag ?? false,
  };
}

export async function recognizeProduct(input: RecognitionInput, language: AppLanguage = 'nl'): Promise<RecognitionResult> {
  const maybeBarcode = input.barcode?.trim();
  let catalogSeed: BarcodeLookupResult | null = input.catalogSeed ?? null;
  const loginRequiredMessage = recognitionT('recognition.error.loginRequired', language);

  if (maybeBarcode) {
    try {
      const override = await getBarcodeOverride(maybeBarcode);
      if (override) {
        return normalizeRecognition(
          {
            name: override.name,
            category: override.category,
            expiryDays: override.expiryDays,
            confidence: 0.99,
            notes: recognitionT('recognition.error.localCorrectionApplied', language, { barcode: maybeBarcode }),
            source: 'user-override',
            barcode: maybeBarcode,
          },
          input,
          language
        );
      }
    } catch {
      // ignore and continue to server/fallback
    }
  }

  if (maybeBarcode) {
    const cached = getCachedBarcodeResult(maybeBarcode);
    if (cached) {
      if (!input.imageBase64 && !input.imageUri) {
        return cached;
      }
      catalogSeed = cached;
    }
  }

  // Try local/GS1 lookup
  if (maybeBarcode) {
    try {
      const external = await lookupBarcode(maybeBarcode);
      if (external) {
        catalogSeed = external;
        if (!input.imageBase64 && !input.imageUri) {
          return normalizeRecognition(
            {
              name: external.name,
              category: external.category,
              expiryDays: external.expiryDays,
              confidence: external.confidence ?? 0.9,
              notes: external.notes ?? 'Barcode match',
              source: external.source ?? 'barcode-lookup',
              barcode: maybeBarcode,
            },
            input,
            language
          );
        }
      }
    } catch {
      // ignore
    }
  }

  try {
    const sessionResponse = supabase ? await supabase.auth.getSession() : null;
    const accessToken = sessionResponse?.data.session?.access_token?.trim() ?? '';
    if (!accessToken) {
      throw new Error(loginRequiredMessage);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    const response = await fetch(getRecognitionUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, catalogSeed }),
    });

    const payload = (await response.json()) as RecognitionApiResponse | (Partial<RecognitionResult> & { expiry?: number }) | null;

    if (!response.ok) {
      const errorPayload = payload as any;
      const errorCode = errorPayload && typeof errorPayload?.error === 'string' ? errorPayload.error.trim() : '';
      if (errorCode === 'missing_auth_token' || errorCode === 'invalid_auth_token' || errorCode === 'auth_not_configured') {
        throw new Error(loginRequiredMessage);
      }
      if (errorCode) {
        throw new Error(getRealAiUnavailableMessage(errorCode, language));
      }

      const message =
        errorPayload && typeof errorPayload?.message === 'string' && errorPayload.message.trim()
          ? errorPayload.message.trim()
          : recognitionT('recognition.error.requestFailedStatus', language, { status: response.status });
      throw new Error(message);
    }

    const data = (payload && 'ok' in payload ? payload.result ?? payload : payload) as Partial<RecognitionResult> & { expiry?: number };
    if (payload && 'ok' in payload && payload.ok === false && payload.result == null) {
      const message = payload.reason?.trim() || getRealAiUnavailableMessage((payload as any).error ?? '', language) || recognitionT('recognition.error.liveUnavailableConfig', language);
      throw new Error(message);
    }

    const normalized = normalizeRecognition(
      {
        ...(data ?? {}),
        name: data?.name ?? (payload && 'ok' in payload ? payload.label : undefined) ?? undefined,
        barcode: data?.barcode ?? maybeBarcode ?? null,
      },
      input,
      language
    );
    if (payload && 'ok' in payload && Array.isArray(payload.candidates)) {
      normalized.candidates = payload.candidates;
    }
    if (maybeBarcode && !input.imageBase64 && !input.imageUri) {
      setCachedBarcodeResult(maybeBarcode, normalized);
    }
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message.trim() === loginRequiredMessage) {
      throw error;
    }

    if (DEMO_MODE_ENABLED) {
      const fallback = inferRecognition(input, language);
      if (maybeBarcode && !input.imageBase64 && !input.imageUri) {
        setCachedBarcodeResult(maybeBarcode, fallback);
      }
      return fallback;
    }

    if (error instanceof Error && error.message.trim()) {
      throw error;
    }

    throw new Error(recognitionT('recognition.error.liveUnavailableConfig', language));
  }
}

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { BarcodeType } from 'expo-camera';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TazeBadge } from 'components/taze-badge';
import { TazeButton } from 'components/taze-button';
import { TazeCard } from 'components/taze-card';
import { TazeInput } from 'components/taze-input';
import { ThemedText } from 'components/themed-text';
import { Brand } from 'constants/theme';
import { useResponsiveLayout } from 'hooks/use-responsive-layout';
import { useAuth } from 'lib/auth-context';
import { getFunctionAreaLabel, getRoleLabel, normalizeAppRole } from 'lib/auth-model';
import { DomainConfig } from 'lib/domain-config';
import { resolveAppLanguage, t, type AppLanguage, type TranslationKey } from 'lib/i18n';
import {
    applyInventoryMutation,
    buildInventoryMutationTraceEvent,
    canMutateInventory,
    getInventoryMutationMovementType,
    getInventoryMutationSource,
} from 'lib/inventory-mutation';
import {
    buildInventoryPolicyDecision,
    getInventoryActionRiskLevel,
    type InventoryActionType,
    type InventoryPolicyDecision,
} from 'lib/inventory-policy';
import { recognizeProduct } from 'lib/recognition';
import {
    buildPendingScanAction,
    buildScanObservation,
    buildScanRecognitionResult,
    buildScanShellAvailability,
    canCreateScanObservation,
    getPendingScanActionStatusLabel,
    getRecognitionProviderLabel,
    getScanActionDescription,
    getScanActionLabel,
    type PendingScanAction,
    type PendingScanActionStatus,
    type PendingScanActionType,
    type ScanObservation,
    type ScanObservationSource,
    type ScanRecognitionResult,
} from 'lib/scan-flow';
import {
    createPendingScanAction,
    createStockMovement,
    getPendingActionsForBranch,
    createScanObservation as persistScanObservation,
    saveRecognitionResult,
    updatePendingScanActionStatus,
    updateScanObservationStatus,
} from 'lib/taze-persistence';

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

function formatScanShellTranslation(
  template: string,
  replacements: Record<string, string | number | null | undefined> = {}
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
}

function translateScanShell(key: TranslationKey, language: AppLanguage, replacements?: Record<string, string | number | null | undefined>) {
  return formatScanShellTranslation(t(key, language), replacements);
}

const ACTION_ORDER: PendingScanActionType[] = [
  'count_stock',
  'stock_correction',
  'report_damage',
  'report_expiry',
  'receive_delivery',
  'manual_product_entry',
];

type ScanLocation = 'bar' | 'keuken' | 'stock';

const SCAN_LOCATIONS: { value: ScanLocation; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'keuken', label: 'Keuken' },
  { value: 'stock', label: 'Stock' },
];

function getScanLocationLabel(location: ScanLocation) {
  switch (location) {
    case 'bar':
      return 'Bar';
    case 'keuken':
      return 'Keuken';
    case 'stock':
    default:
      return 'Stock';
  }
}

async function openAccountShell() {
  const target = `${DomainConfig.appOrigin}/account`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(target);
    return;
  }

  await Linking.openURL(target);
}

function getActionTone(actionType: PendingScanActionType) {
  switch (actionType) {
    case 'report_damage':
    case 'report_expiry':
    case 'stock_correction':
    case 'transfer_inventory':
    case 'remove_inventory':
      return 'danger' as const;
    case 'receive_delivery':
      return 'accent' as const;
    case 'manual_product_entry':
      return 'neutral' as const;
    case 'count_stock':
    default:
      return 'primary' as const;
  }
}

function getObservationSourceLabel(source: ScanObservationSource) {
  switch (source) {
    case 'barcode':
      return 'Barcode';
    case 'camera':
      return 'Camera';
    case 'manual':
    default:
      return 'Handmatig';
  }
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

function getStatusTone(status: PendingScanActionStatus) {
  switch (status) {
    case 'pending_approval':
      return 'warning' as const;
    case 'approved':
    case 'applied':
      return 'success' as const;
    case 'rejected':
      return 'danger' as const;
    case 'pending_confirmation':
    default:
      return 'info' as const;
  }
}

function getActionStatusHint(action: PendingScanAction) {
  if (action.status === 'pending_approval') {
    return 'Wacht op manager goedkeuring voordat voorraad kan veranderen.';
  }

  if (action.status === 'context_requested') {
    return 'Meer context gevraagd. De actie blijft wachten op menselijke beslissing.';
  }

  if (action.status === 'pending_confirmation') {
    return 'Wacht op menselijke bevestiging. Daarna kan de actie verder.';
  }

  if (action.status === 'approved') {
    return 'Goedgekeurd. Klaar voor de voorraadmutatieworkflow.';
  }

  if (action.status === 'applied') {
    return 'Toegepast en vastgelegd in auditlog.';
  }

  return 'Afgewezen en alleen als auditcontext bewaard.';
}

function getDutchPendingStatusLabel(status: PendingScanActionStatus) {
  switch (status) {
    case 'pending_approval':
      return 'Wacht op manager';
    case 'pending_confirmation':
      return 'Wacht op bevestiging';
    case 'context_requested':
      return 'Context gevraagd';
    case 'approved':
      return 'Goedgekeurd';
    case 'applied':
      return 'Toegepast';
    case 'rejected':
      return 'Afgewezen';
    default:
      return getPendingScanActionStatusLabel(status);
  }
}

function getMutationGateLabel(action: PendingScanAction, canApplyMutation: boolean) {
  if (action.status === 'applied') {
    return 'Mutatie toegepast';
  }

  if (action.status === 'rejected') {
    return 'Mutatie geblokkeerd';
  }

  if (action.status === 'context_requested') {
    return 'Wacht op context';
  }

  if (canApplyMutation) {
    return 'Klaar om toe te passen';
  }

  if (action.requiresApproval && action.status !== 'approved') {
    return 'Wacht op manager';
  }

  return 'Wacht op bevestiging';
}

function getRiskLabel(riskLevel: 'low' | 'medium' | 'high') {
  switch (riskLevel) {
    case 'low':
      return 'Laag risico';
    case 'medium':
      return 'Middel risico';
    case 'high':
    default:
      return 'Hoog risico';
  }
}

function getRiskTone(riskLevel: 'low' | 'medium' | 'high') {
  switch (riskLevel) {
    case 'low':
      return 'neutral' as const;
    case 'medium':
      return 'warning' as const;
    case 'high':
    default:
      return 'danger' as const;
  }
}

function buildActorPolicyContext(auth: ReturnType<typeof useAuth>) {
  return {
    companyId: auth.companyId,
    branchId: auth.branchId,
    membershipId: auth.activeMembership?.id ?? null,
    membershipStatus: auth.activeMembership?.status ?? null,
    role: auth.role,
    permissions: auth.permissions,
    functions: auth.functions,
  } as const;
}

function buildPersistenceContext(auth: ReturnType<typeof useAuth>) {
  return {
    companyId: auth.companyId,
    branchId: auth.branchId,
    userId: auth.userId ?? null,
    membershipId: auth.activeMembership?.id ?? null,
    membershipStatus: auth.activeMembership?.status ?? null,
    role: normalizeAppRole(auth.role),
    permissions: auth.permissions,
    functionAreas: auth.functions,
    supportMode: false,
    actorKind: 'user' as const,
  };
}

function buildMutationContext(auth: ReturnType<typeof useAuth>, action: PendingScanAction) {
  return {
    actor: {
      ...buildActorPolicyContext(auth),
      userId: auth.userId ?? null,
    },
    target: {
      companyId: action.companyId ?? auth.companyId,
      branchId: action.branchId ?? auth.branchId,
    },
  };
}

function getApprovalPolicyForAction(auth: ReturnType<typeof useAuth>, action: PendingScanAction): InventoryPolicyDecision {
  const actionType = action.actionType as InventoryActionType;
  return buildInventoryPolicyDecision({
    actor: {
      ...buildActorPolicyContext(auth),
    },
    target: {
      companyId: action.companyId ?? auth.companyId,
      branchId: action.branchId ?? auth.branchId,
    },
    actionType,
    riskLevel: action.riskLevel ?? getInventoryActionRiskLevel(actionType),
    observationConfirmed: action.observationStatus === 'confirmed',
    traceEventRecorded: true,
  });
}

type ScanShellPageProps = {
  uiLanguage?: AppLanguage;
};

export function ScanShellPage({ uiLanguage = 'nl' }: ScanShellPageProps = {}) {
  const auth = useAuth();
  const { isCompact } = useResponsiveLayout();
  const scrollRef = useRef<ScrollView | null>(null);
  const manualBarcodeRef = useRef<TextInput | null>(null);
  const manualNameRef = useRef<TextInput | null>(null);
  const scanShellT = useCallback(
    (key: TranslationKey, replacements?: Record<string, string | number | null | undefined>) =>
      translateScanShell(key, uiLanguage, replacements),
    [uiLanguage]
  );
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [manualBarcodeInput, setManualBarcodeInput] = useState('');
  const [manualNameInput, setManualNameInput] = useState('');
  const [reviewBarcodeInput, setReviewBarcodeInput] = useState('');
  const [reviewNameInput, setReviewNameInput] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<PendingScanActionType>('count_stock');
  const [selectedScanLocation, setSelectedScanLocation] = useState<ScanLocation>('bar');
  const [currentObservation, setCurrentObservation] = useState<ScanObservation | null>(null);
  const [currentRecognition, setCurrentRecognition] = useState<ScanRecognitionResult | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingScanAction[]>([]);
  const [mutationBusyActionId, setMutationBusyActionId] = useState<string | null>(null);
  const [aiAvailabilityMessage, setAiAvailabilityMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(() => scanShellT('scan.shell.status.initial'));
  const [busy, setBusy] = useState(false);

  const resetDraft = useCallback(() => {
    setCurrentObservation(null);
    setCurrentRecognition(null);
    setAiAvailabilityMessage(null);
    setReviewBarcodeInput('');
    setReviewNameInput('');
    setSelectedScanLocation('bar');
    setBusy(false);
  }, []);

  const appLanguage = useMemo(() => resolveAppLanguage(), []);
  const roleLabel = useMemo(() => getRoleLabel(auth.role, appLanguage), [auth.role, appLanguage]);
  const functionSummary = useMemo(
    () =>
      auth.functions.length
        ? auth.functions.map((entry) => getFunctionAreaLabel(entry, appLanguage)).join(' / ')
        : 'Nog geen functiegebied gekozen',
    [auth.functions, appLanguage]
  );
  const availability = useMemo(
    () =>
      buildScanShellAvailability({
        cameraAvailable,
        cameraPermissionGranted: cameraPermission?.granted ?? null,
        aiAvailable: !aiAvailabilityMessage,
      }),
    [aiAvailabilityMessage, cameraAvailable, cameraPermission?.granted]
  );
  const hasScanContext = canCreateScanObservation({
    companyId: auth.companyId,
    branchId: auth.branchId,
    hasScanAccess: Boolean(auth.company?.name && auth.branch?.name),
  });
  const draftPolicy = useMemo(
    () =>
      buildInventoryPolicyDecision({
        actor: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          membershipId: auth.activeMembership?.id ?? null,
          membershipStatus: auth.activeMembership?.status ?? null,
          role: auth.role,
          permissions: auth.permissions,
          functions: auth.functions,
        },
        target: {
          companyId: auth.companyId,
          branchId: auth.branchId,
        },
        actionType: selectedActionType,
        observationConfirmed: false,
        traceEventRecorded: false,
      }),
    [auth.activeMembership?.status, auth.activeMembership?.id, auth.branchId, auth.companyId, auth.functions, auth.permissions, auth.role, selectedActionType]
  );

  useEffect(() => {
    let cancelled = false;

    void CameraView.isAvailableAsync()
      .then((available) => {
        if (!cancelled) {
          setCameraAvailable(Boolean(available));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    resetDraft();
    setPendingActions([]);

    if (!auth.companyId || !auth.branchId || !auth.userId || !auth.activeMembership?.id) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const result = await getPendingActionsForBranch(buildPersistenceContext(auth));
      if (cancelled) return;

      if (result.ok === true) {
        setPendingActions(result.value);
      } else {
        setStatusMessage(result.safeMessage);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, resetDraft]);

  const openPendingActions = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  const reviewedRecognition = useMemo<ScanRecognitionResult | null>(() => {
    if (!currentObservation || !currentRecognition) {
      return null;
    }

    return {
      ...currentRecognition,
      suggestedName: reviewNameInput.trim() || currentRecognition.suggestedName || currentObservation.rawValue,
      suggestedProductId: reviewBarcodeInput.trim() || currentRecognition.suggestedProductId,
    };
  }, [currentObservation, currentRecognition, reviewBarcodeInput, reviewNameInput]);

  const scanSummary = useMemo(() => {
    if (!currentObservation) {
      return null;
    }

    return {
      barcode: currentObservation.rawValue,
      statusLabel:
        currentObservation.status === 'rejected'
          ? 'Scan afgewezen'
          : currentObservation.status === 'confirmed'
            ? 'Barcode herkend'
            : 'Barcode herkend',
      timestampLabel: formatScanMoment(currentObservation.createdAt),
      nextStepLabel: 'Controleer product',
    };
  }, [currentObservation]);

  const createObservationFlow = useCallback(
    async (params: {
      source: ScanObservationSource;
      rawValue: string;
      barcode?: string | null;
      imageRef?: string | null;
      allowRecognition?: boolean;
      manualName?: string | null;
    }) => {
      if (!auth.companyId || !auth.branchId || !auth.userId || !auth.activeMembership?.id) {
        setStatusMessage(scanShellT('scan.shell.status.selectContext'));
        return;
      }

      const normalizedRawValue = params.rawValue.trim();
      if (!normalizedRawValue) {
        setStatusMessage(scanShellT('scan.shell.status.valueRequired'));
        return;
      }

      setBusy(true);
      const draftObservation = buildScanObservation({
        companyId: auth.companyId,
        branchId: auth.branchId,
        userId: auth.userId,
        membershipId: auth.activeMembership.id,
        source: params.source,
        rawValue: normalizedRawValue,
        imageRef: params.imageRef ?? null,
      });

      const observationResult = await persistScanObservation(buildPersistenceContext(auth), draftObservation);
      if (observationResult.ok === false) {
        setStatusMessage(observationResult.safeMessage);
        setBusy(false);
        return;
      }

      const observation = observationResult.value;
      setCurrentObservation(observation);
      setAiAvailabilityMessage(null);
      setStatusMessage(scanShellT('scan.shell.status.observationCreated'));

      if (params.allowRecognition !== false && (params.barcode?.trim() || params.source !== 'manual')) {
        try {
          const recognized = await recognizeProduct({
            barcode: params.barcode?.trim() || null,
            imageBase64: null,
            imageUri: params.imageRef ?? null,
          });

          const nextRecognition = buildScanRecognitionResult({
            observation,
            recognition: recognized,
            manualName: params.manualName ?? null,
          });

          const recognitionResult = await saveRecognitionResult(buildPersistenceContext(auth), nextRecognition);
          if (recognitionResult.ok === false) {
            setStatusMessage(recognitionResult.safeMessage);
            setBusy(false);
            return;
          }

          setCurrentRecognition(recognitionResult.value);
          setReviewNameInput(recognitionResult.value.suggestedName ?? normalizedRawValue);
          setReviewBarcodeInput(recognitionResult.value.suggestedProductId ?? params.barcode?.trim() ?? '');
          setStatusMessage(scanShellT('scan.shell.status.recognitionReady', { sourceLabel: recognitionResult.value.sourceLabel }));
        } catch (error) {
          const message = error instanceof Error && error.message.trim() ? error.message.trim() : scanShellT('scan.shell.status.productProposalUnavailable');
          const nextRecognition = buildScanRecognitionResult({
            observation,
            recognition: null,
            manualName: params.manualName ?? params.barcode ?? normalizedRawValue,
            aiUnavailableMessage: message,
          });

          const recognitionResult = await saveRecognitionResult(buildPersistenceContext(auth), nextRecognition);
          if (recognitionResult.ok === false) {
            setStatusMessage(recognitionResult.safeMessage);
            setBusy(false);
            return;
          }

          setCurrentRecognition(recognitionResult.value);
          setAiAvailabilityMessage(message);
          setReviewNameInput(recognitionResult.value.suggestedName ?? normalizedRawValue);
          setReviewBarcodeInput(params.barcode?.trim() ?? '');
          setStatusMessage(scanShellT('scan.shell.status.aiUnavailable'));
        }
      } else {
        const nextRecognition = buildScanRecognitionResult({
          observation,
          recognition: null,
          manualName: params.manualName ?? normalizedRawValue,
          aiUnavailableMessage: null,
        });

        const recognitionResult = await saveRecognitionResult(buildPersistenceContext(auth), nextRecognition);
        if (recognitionResult.ok === false) {
          setStatusMessage(recognitionResult.safeMessage);
          setBusy(false);
          return;
        }

        setCurrentRecognition(recognitionResult.value);
        setReviewNameInput(recognitionResult.value.suggestedName ?? normalizedRawValue);
        setReviewBarcodeInput(params.barcode?.trim() ?? '');
        setStatusMessage(scanShellT('scan.shell.status.manualObservationReady'));
      }

      setBusy(false);
    },
    [auth, scanShellT]
  );

  const handleStartScan = useCallback(async () => {
    if (!hasScanContext) {
      setStatusMessage(scanShellT('scan.shell.status.noActiveContext'));
      return;
    }

    if (cameraAvailable === false) {
      setCameraOpen(false);
      setStatusMessage(scanShellT('scan.shell.status.cameraUnavailable'));
      manualBarcodeRef.current?.focus?.();
      return;
    }

    setCameraOpen(true);
    setStatusMessage(scanShellT('scan.shell.status.cameraOpened'));

    if (cameraPermission && !cameraPermission.granted) {
      await requestCameraPermission();
    }
  }, [cameraAvailable, cameraPermission, hasScanContext, requestCameraPermission, scanShellT]);

  const handleManualEntry = useCallback(async () => {
    setSelectedActionType('manual_product_entry');
    setCameraOpen(false);
    manualBarcodeRef.current?.focus?.();

    const barcode = manualBarcodeInput.trim();
    const name = manualNameInput.trim();
    const rawValue = barcode || name;

    if (!rawValue) {
      setStatusMessage(scanShellT('scan.shell.status.manualValueRequired'));
      return;
    }

    await createObservationFlow({
      source: barcode ? 'barcode' : 'manual',
      rawValue,
      barcode: barcode || null,
      allowRecognition: Boolean(barcode),
      manualName: name || null,
    });
  }, [createObservationFlow, manualBarcodeInput, manualNameInput, scanShellT]);

  const handleStartDamageFlow = useCallback(async () => {
    setSelectedActionType('report_damage');
    setCameraOpen(false);
    manualBarcodeRef.current?.focus?.();

    const barcode = manualBarcodeInput.trim();
    const name = manualNameInput.trim();
    const rawValue = barcode || name || 'Schade of verval melding';

    await createObservationFlow({
      source: barcode ? 'barcode' : 'manual',
      rawValue,
      barcode: barcode || null,
      allowRecognition: Boolean(barcode),
      manualName: name || null,
    });
  }, [createObservationFlow, manualBarcodeInput, manualNameInput]);

  const handleBarcodeScanned = useCallback(
    (event: { data?: string | null }) => {
      if (!cameraOpen || busy) return;
      const barcode = typeof event?.data === 'string' ? event.data.trim() : '';
      if (!barcode) return;

      setManualBarcodeInput(barcode);
      setCameraOpen(false);
      void createObservationFlow({
        source: 'barcode',
        rawValue: barcode,
        barcode,
        allowRecognition: true,
        manualName: manualNameInput.trim() || null,
      });
    },
    [busy, cameraOpen, createObservationFlow, manualNameInput]
  );

  const handleConfirmObservation = useCallback(async () => {
    if (!currentObservation || !currentRecognition) {
      setStatusMessage(scanShellT('scan.shell.status.noObservationToConfirm'));
      return;
    }

    if (!reviewedRecognition) {
      setStatusMessage(scanShellT('scan.shell.status.noRecognitionToConfirm'));
      return;
    }

    const observationResult = await updateScanObservationStatus(buildPersistenceContext(auth), currentObservation.id, 'confirmed');
    if (observationResult.ok === false) {
      setStatusMessage(observationResult.safeMessage);
      return;
    }

    const confirmedObservation = observationResult.value;
    setCurrentObservation(confirmedObservation);
    const locationLabel = getScanLocationLabel(selectedScanLocation);

    const pendingActionDraft = buildPendingScanAction({
      observation: confirmedObservation,
      actionType: selectedActionType,
      role: auth.role,
      permissions: auth.permissions,
      companyId: confirmedObservation.companyId,
      branchId: confirmedObservation.branchId,
      membershipId: confirmedObservation.membershipId,
      functions: auth.functions,
      sourceObservationLabel: `${getObservationSourceLabel(confirmedObservation.source)} · ${confirmedObservation.rawValue}`,
      recognitionLabel: reviewedRecognition.sourceLabel,
      observationStatus: confirmedObservation.status,
    });

    const pendingActionWithLocation = {
      ...pendingActionDraft,
      recognitionLabel: `${pendingActionDraft.recognitionLabel ?? reviewedRecognition.sourceLabel} · Locatie: ${locationLabel}`,
      policyReason: `${pendingActionDraft.policyReason ?? 'Pending actie aangemaakt.'} Locatie: ${locationLabel}.`,
    };

    const pendingActionResult = await createPendingScanAction(buildPersistenceContext(auth), pendingActionWithLocation);
    if (pendingActionResult.ok === false) {
      setStatusMessage(pendingActionResult.safeMessage);
      return;
    }

    setPendingActions((current) => [pendingActionResult.value, ...current.filter((entry) => entry.id !== pendingActionResult.value.id)].slice(0, 8));

    setStatusMessage(
      pendingActionResult.value.requiresApproval
        ? scanShellT('scan.shell.status.confirmedNeedsManager', { location: locationLabel })
        : scanShellT('scan.shell.status.confirmedNeedsHuman', { location: locationLabel })
    );

    setCurrentRecognition(reviewedRecognition);
  }, [auth, currentObservation, currentRecognition, reviewedRecognition, scanShellT, selectedActionType, selectedScanLocation]);

  const handleApprovePendingAction = useCallback(
    async (action: PendingScanAction) => {
      const policy = getApprovalPolicyForAction(auth, action);

      if (!policy.canApprove) {
        Alert.alert(scanShellT('scan.shell.alert.noRights.title'), policy.reason || scanShellT('scan.shell.alert.noApprove.body'));
        return;
      }

      const result = await updatePendingScanActionStatus(buildPersistenceContext(auth), action.id, 'approved', `Goedgekeurd door ${roleLabel}. ${policy.reason}`);
      if (result.ok === false) {
        Alert.alert(scanShellT('scan.shell.alert.noRights.title'), result.safeMessage);
        setStatusMessage(result.safeMessage);
        return;
      }

      setPendingActions((current) => current.map((entry) => (entry.id === action.id ? result.value : entry)));
      setStatusMessage(scanShellT('scan.shell.status.actionApproved'));
    },
    [auth, roleLabel, scanShellT]
  );

  const handleRejectPendingAction = useCallback(
    async (action: PendingScanAction) => {
      const policy = getApprovalPolicyForAction(auth, action);
      if (!policy.canReject) {
        Alert.alert(scanShellT('scan.shell.alert.noRights.title'), policy.reason || scanShellT('scan.shell.alert.noReject.body'));
        return;
      }

      const result = await updatePendingScanActionStatus(buildPersistenceContext(auth), action.id, 'rejected', `Actie afgewezen door ${roleLabel}. ${policy.reason}`);
      if (result.ok === false) {
        Alert.alert(scanShellT('scan.shell.alert.noRights.title'), result.safeMessage);
        setStatusMessage(result.safeMessage);
        return;
      }

      setPendingActions((current) => current.map((entry) => (entry.id === action.id ? result.value : entry)));
      setStatusMessage(scanShellT('scan.shell.status.actionRejected'));
    },
    [auth, roleLabel, scanShellT]
  );

  const handleRequestContext = useCallback(
    async (action: PendingScanAction) => {
      const policy = getApprovalPolicyForAction(auth, action);
      if (!policy.canRequestMoreContext) {
        Alert.alert(scanShellT('scan.shell.alert.noRights.title'), policy.reason || scanShellT('scan.shell.alert.noContextRequest.body'));
        return;
      }

      const result = await updatePendingScanActionStatus(
        buildPersistenceContext(auth),
        action.id,
        'context_requested',
        `Meer context gevraagd door ${roleLabel}. ${policy.reason}`
      );
      if (result.ok === false) {
        Alert.alert(scanShellT('scan.shell.alert.noRights.title'), result.safeMessage);
        setStatusMessage(result.safeMessage);
        return;
      }

      setPendingActions((current) => current.map((entry) => (entry.id === action.id ? result.value : entry)));
      setStatusMessage(scanShellT('scan.shell.status.contextRequested'));
    },
    [auth, roleLabel, scanShellT]
  );

  const handleApplyPendingAction = useCallback(
    async (action: PendingScanAction) => {
      if (mutationBusyActionId === action.id) {
        return;
      }

      const mutationContext = buildMutationContext(auth, action);
      const source = getInventoryMutationSource(auth.role, action.actionType);
      const traceEvent = buildInventoryMutationTraceEvent(
        mutationContext,
        action,
        getInventoryMutationMovementType(action.actionType),
        action.status,
        'applied',
        source
      );

      setMutationBusyActionId(action.id);

      try {
        const result = await applyInventoryMutation(mutationContext, action, traceEvent);
        if (result.ok === false) {
          Alert.alert(scanShellT('scan.shell.alert.mutationNotApplied.title'), result.safeMessage);
          setStatusMessage(result.safeMessage);
          return;
        }

        const persistResult = await createStockMovement(buildPersistenceContext(auth), {
          movement: result.movement,
          traceEvent: {
            id: result.traceEvent.id,
            createdAt: result.traceEvent.createdAt,
            eventType: 'inventory_mutation',
            companyId: result.traceEvent.companyId,
            branchId: result.traceEvent.branchId,
            userId: result.traceEvent.userId,
            membershipId: result.traceEvent.membershipId,
            observationId: result.traceEvent.observationId,
            pendingActionId: result.traceEvent.pendingActionId,
            previousStatus: result.traceEvent.previousStatus,
            newStatus: result.traceEvent.newStatus,
            movementType: result.traceEvent.movementType,
            productId: null,
            itemName: action.recognitionLabel ?? action.sourceObservationLabel ?? action.actionType,
            rawValue: action.recognitionLabel ?? action.sourceObservationLabel ?? action.actionType,
            sourceLabel: result.traceEvent.source,
            confidence: null,
            note: result.traceEvent.note,
          },
        });
        if (persistResult.ok === false) {
          Alert.alert(scanShellT('scan.shell.alert.mutationNotApplied.title'), persistResult.safeMessage);
          setStatusMessage(persistResult.safeMessage);
          return;
        }

        setPendingActions((current) => current.map((entry) => (entry.id === action.id ? persistResult.value.appliedAction : entry)));
        setStatusMessage(scanShellT('scan.shell.status.mutationApplied', { movementType: result.movement.movementType }));
      } finally {
        setMutationBusyActionId((current) => (current === action.id ? null : current));
      }
    },
    [auth, mutationBusyActionId, scanShellT]
  );

  const handleDiscardDraft = useCallback(() => {
    resetDraft();
    setStatusMessage(scanShellT('scan.shell.status.observationDiscarded'));
  }, [resetDraft, scanShellT]);

  const cameraSection = (() => {
    if (!cameraOpen) {
      return (
        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label={scanShellT('scan.shell.camera.supportBadge')} tone="neutral" icon="photo-camera" />
              <TazeBadge label={availability.cameraLabel} tone={cameraAvailable === false ? 'warning' : 'info'} />
            </View>
            <ThemedText type="defaultSemiBold">{scanShellT('scan.shell.camera.closed.title')}</ThemedText>
          </View>
          <ThemedText style={styles.body}>{scanShellT('scan.shell.camera.closed.body')}</ThemedText>
          <View style={styles.sectionActions}>
            <TazeButton
              label={currentObservation ? scanShellT('scan.shell.camera.rescanAction') : scanShellT('scan.shell.camera.openAction')}
              icon="qr-code-scanner"
              variant="primary"
              onPress={() => void handleStartScan()}
            />
            <TazeButton
              label={scanShellT('scan.shell.camera.manualAction')}
              icon="edit"
              variant="secondary"
              onPress={() => {
                setSelectedActionType('manual_product_entry');
                manualBarcodeRef.current?.focus?.();
              }}
            />
          </View>
        </TazeCard>
      );
    }

    if (cameraAvailable === false) {
      return (
        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label={scanShellT('scan.shell.camera.badge')} tone="warning" icon="warning" />
              <TazeBadge label={scanShellT('scan.shell.camera.manualFlowBadge')} tone="neutral" />
            </View>
            <ThemedText type="defaultSemiBold">{scanShellT('scan.shell.camera.unavailable.title')}</ThemedText>
          </View>
          <ThemedText style={styles.body}>{scanShellT('scan.shell.camera.unavailable.body')}</ThemedText>
          <View style={styles.sectionActions}>
            <TazeButton label={scanShellT('scan.shell.camera.manualAction')} icon="edit" variant="primary" onPress={() => void handleManualEntry()} />
            <TazeButton label={scanShellT('scan.shell.camera.closeAction')} icon="close" variant="ghost" onPress={() => setCameraOpen(false)} />
          </View>
        </TazeCard>
      );
    }

    if (!cameraPermission) {
      return (
        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label={scanShellT('scan.shell.camera.badge')} tone="neutral" icon="photo-camera" />
              <TazeBadge label={scanShellT('scan.shell.camera.checkingBadge')} tone="info" />
            </View>
            <ThemedText type="defaultSemiBold">{scanShellT('scan.shell.camera.preparing.title')}</ThemedText>
          </View>
          <ThemedText style={styles.body}>{scanShellT('scan.shell.camera.preparing.body')}</ThemedText>
          <TazeButton
            label={scanShellT('scan.shell.camera.permissionAction')}
            icon="camera-alt"
            variant="secondary"
            onPress={() => void requestCameraPermission()}
          />
        </TazeCard>
      );
    }

    if (!cameraPermission.granted) {
      return (
        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label={scanShellT('scan.shell.camera.badge')} tone="warning" icon="photo-camera" />
              <TazeBadge label={scanShellT('scan.shell.camera.accessRequiredBadge')} tone="warning" />
            </View>
            <ThemedText type="defaultSemiBold">{scanShellT('scan.shell.camera.permissionRequired.title')}</ThemedText>
          </View>
          <ThemedText style={styles.body}>{scanShellT('scan.shell.camera.permissionRequired.body')}</ThemedText>
          <View style={styles.sectionActions}>
            <TazeButton
              label={scanShellT('scan.shell.camera.permissionAction')}
              icon="camera-alt"
              variant="primary"
              onPress={() => void requestCameraPermission()}
            />
            <TazeButton label={scanShellT('scan.shell.camera.manualAction')} icon="edit" variant="secondary" onPress={() => void handleManualEntry()} />
          </View>
        </TazeCard>
      );
    }

    return (
      <TazeCard variant="panel" style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.heroBadgeRow}>
            <TazeBadge label={scanShellT('scan.shell.camera.liveScannerBadge')} tone="primary" icon="qr-code-scanner" />
            <TazeBadge label={availability.cameraLabel} tone="success" />
          </View>
          <ThemedText type="defaultSemiBold">{scanShellT('scan.shell.camera.opened.title')}</ThemedText>
        </View>
        <ThemedText style={styles.body}>{scanShellT('scan.shell.camera.opened.body')}</ThemedText>
        <View style={styles.cameraFrame}>
          <CameraView
            style={styles.camera}
            facing="back"
            ratio="16:9"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: Platform.OS === 'web' ? WEB_BARCODE_TYPES : NATIVE_BARCODE_TYPES,
            }}
          />
        </View>
        {scanSummary ? (
          <TazeCard variant="muted" style={styles.reviewItem}>
            <ThemedText type="defaultSemiBold">Barcode</ThemedText>
            <ThemedText style={styles.body}>{scanSummary.barcode}</ThemedText>
            <ThemedText style={styles.pendingMeta}>Scanstatus: {scanSummary.statusLabel}</ThemedText>
            <ThemedText style={styles.pendingMeta}>Tijdstip: {scanSummary.timestampLabel}</ThemedText>
            <ThemedText style={styles.pendingMeta}>Volgende stap: {scanSummary.nextStepLabel}</ThemedText>
            <ThemedText style={styles.pendingMeta}>Geen voorraadmutatie uitgevoerd. Menselijke bevestiging vereist.</ThemedText>
          </TazeCard>
        ) : null}
        <View style={styles.sectionActions}>
          <TazeButton label="Sluit scanner" icon="close" variant="ghost" onPress={() => setCameraOpen(false)} />
          <TazeButton
            label="Handmatige invoer"
            icon="edit"
            variant="secondary"
            onPress={() => {
              setCameraOpen(false);
              setSelectedActionType('manual_product_entry');
              manualBarcodeRef.current?.focus?.();
            }}
          />
        </View>
      </TazeCard>
    );
  })();

  if (!hasScanContext) {
    return (
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.shell, isCompact && styles.shellCompact]} showsVerticalScrollIndicator={false}>
        <TazeCard variant="accent" style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="qr-code-scanner" size={28} color={Brand.primary} />
            </View>
            <View style={styles.heroCopy}>
              <View style={styles.heroBadgeRow}>
                <TazeBadge label="Scan-shell" tone="primary" />
                <TazeBadge label="Beveiligd" tone="neutral" />
              </View>
              <ThemedText type="title">Taze Scan</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.subtitle}>
                Scans zijn observaties. Inventariswijzigingen volgen pas na bevestiging of goedkeuring.
              </ThemedText>
            </View>
          </View>

          <TazeCard variant="panel" style={styles.emptyStateCard}>
            <ThemedText type="defaultSemiBold">Nog geen bedrijf of vestiging geselecteerd</ThemedText>
            <ThemedText style={styles.body}>
              De scanruimte opent pas wanneer je een actieve company en vestiging hebt gekozen. Zo blijft de context veilig
              en weet Taze altijd waar de observatie hoort.
            </ThemedText>
            <View style={styles.emptyStateActions}>
              <TazeButton
                label="Open account en kies bedrijf"
                icon="manage-accounts"
                variant="primary"
                onPress={() => void openAccountShell().catch(() => {})}
              />
              <TazeButton
                label="Terug naar taze.to"
                icon="home"
                variant="secondary"
                onPress={() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.location.assign(DomainConfig.publicOrigin);
                    return;
                  }

                  void Linking.openURL(DomainConfig.publicOrigin).catch(() => {});
                }}
              />
            </View>
          </TazeCard>
        </TazeCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.shell, isCompact && styles.shellCompact]} showsVerticalScrollIndicator={false}>
      <TazeCard variant="accent" style={[styles.heroCard, isCompact && styles.heroCardCompact]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="qr-code-scanner" size={28} color={Brand.primary} />
          </View>
          <View style={styles.heroCopy}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label="Taze Scan" tone="primary" />
              <TazeBadge label="Observatie" tone="neutral" />
              <TazeBadge label={availability.aiLabel} tone={aiAvailabilityMessage ? 'warning' : 'info'} />
              <TazeBadge label={getRiskLabel(draftPolicy.riskLevel)} tone={getRiskTone(draftPolicy.riskLevel)} />
            </View>
            <ThemedText type="title">Taze Scan</ThemedText>
            <ThemedText type="defaultSemiBold" style={styles.subtitle}>
              Gerichte scanwerkruimte voor {auth.company?.name ?? 'jouw bedrijf'}.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.contextGrid, isCompact && styles.contextGridCompact]}>
          <TazeCard variant="panel" style={styles.contextCard}>
            <ThemedText style={styles.contextLabel}>Bedrijf</ThemedText>
            <ThemedText type="defaultSemiBold">{auth.company?.name ?? 'Onbekend bedrijf'}</ThemedText>
            <ThemedText style={styles.contextValue}>{auth.company?.slug ?? 'Geen slug beschikbaar'}</ThemedText>
          </TazeCard>
          <TazeCard variant="panel" style={styles.contextCard}>
            <ThemedText style={styles.contextLabel}>Vestiging</ThemedText>
            <ThemedText type="defaultSemiBold">{auth.branch?.name ?? 'Geen vestiging gekozen'}</ThemedText>
            <ThemedText style={styles.contextValue}>{auth.branch?.code ?? 'Nog geen vestigingscode'}</ThemedText>
          </TazeCard>
          <TazeCard variant="panel" style={styles.contextCard}>
            <ThemedText style={styles.contextLabel}>Rol</ThemedText>
            <ThemedText type="defaultSemiBold">{roleLabel}</ThemedText>
            <ThemedText style={styles.contextValue}>{functionSummary}</ThemedText>
          </TazeCard>
        </View>

        <TazeCard variant="panel" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <TazeBadge label={availability.cameraLabel} tone={cameraAvailable === false ? 'warning' : 'info'} />
            <TazeBadge label={availability.manualEntryAvailable ? 'Handmatige invoer actief' : 'Handmatige invoer uit'} tone="neutral" />
            <TazeBadge label={hasScanContext ? 'Context ok' : 'Context ontbreekt'} tone={hasScanContext ? 'success' : 'warning'} />
          </View>
          <ThemedText style={styles.body}>{statusMessage}</ThemedText>
        </TazeCard>

        <View style={[styles.actionRow, isCompact && styles.actionRowCompact]}>
          <TazeButton
            label={currentObservation ? 'Opnieuw scannen' : 'Camera openen'}
            icon="qr-code-scanner"
            variant="primary"
            onPress={() => void handleStartScan()}
            style={styles.actionButton}
          />
          <TazeButton
            label="Handmatige invoer"
            icon="edit"
            variant="secondary"
            onPress={() => void handleManualEntry()}
            style={styles.actionButton}
          />
          <TazeButton
            label="Meld schade/verval"
            icon="report"
            variant="secondary"
            onPress={() => void handleStartDamageFlow()}
            style={styles.actionButton}
          />
          <TazeButton
            label="Bekijk pending acties"
            icon="schedule"
            variant="ghost"
            onPress={openPendingActions}
            style={styles.actionButton}
          />
        </View>

        {cameraSection}

        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label="Manuele flow" tone="neutral" icon="edit" />
              <TazeBadge label="Observatie" tone="primary" />
            </View>
            <ThemedText type="defaultSemiBold">Handmatige productinvoer</ThemedText>
          </View>
          <ThemedText style={styles.body}>
            Gebruik deze flow als camera of barcode niet beschikbaar is. De observatie blijft bruikbaar en veilig.
          </ThemedText>
          <View style={styles.manualInputStack}>
            <TazeInput
              ref={manualBarcodeRef}
              label="Barcode"
              placeholder="Plak of typ barcode"
              value={manualBarcodeInput}
              onChangeText={setManualBarcodeInput}
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="next"
              onSubmitEditing={() => manualNameRef.current?.focus?.()}
            />
            <TazeInput
              ref={manualNameRef}
              label="Productnaam"
              placeholder="Optioneel product of beschrijving"
              value={manualNameInput}
              onChangeText={setManualNameInput}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => void handleManualEntry()}
            />
          </View>
          <View style={styles.sectionActions}>
            <TazeButton label="Maak observatie" icon="fact-check" variant="primary" onPress={() => void handleManualEntry()} />
            <TazeButton label="Gebruik camera" icon="photo-camera" variant="secondary" onPress={() => void handleStartScan()} />
          </View>
        </TazeCard>

        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label="Observatie" tone="primary" />
              <TazeBadge
                label={currentRecognition ? getRecognitionProviderLabel(currentRecognition.provider) : 'Voorstel nog leeg'}
                tone={aiAvailabilityMessage ? 'warning' : 'accent'}
              />
              <TazeBadge
                label={draftPolicy.requiresManagerApproval ? 'Managergoedkeuring nodig' : 'Menselijke bevestiging nodig'}
                tone={draftPolicy.requiresManagerApproval ? 'warning' : 'info'}
              />
              <TazeBadge label={getRiskLabel(draftPolicy.riskLevel)} tone={getRiskTone(draftPolicy.riskLevel)} />
            </View>
            <ThemedText type="defaultSemiBold">Observatie en herkenning</ThemedText>
          </View>

          {currentObservation ? (
            <View style={styles.reviewStack}>
              <View style={styles.controlStrip}>
                <View style={styles.controlStep}>
                  <TazeBadge label="1" tone="accent" />
                  <ThemedText type="defaultSemiBold" style={styles.controlStepTitle}>Voorstel</ThemedText>
                  <ThemedText style={styles.controlStepText}>AI/barcode geeft alleen advies.</ThemedText>
                </View>
                <View style={styles.controlStep}>
                  <TazeBadge label="2" tone="info" />
                  <ThemedText type="defaultSemiBold" style={styles.controlStepTitle}>Mens bevestigt</ThemedText>
                  <ThemedText style={styles.controlStepText}>Locatie en actie worden hier gekozen.</ThemedText>
                </View>
                <View style={styles.controlStep}>
                  <TazeBadge label="3" tone="success" />
                  <ThemedText type="defaultSemiBold" style={styles.controlStepTitle}>Audit klaar</ThemedText>
                  <ThemedText style={styles.controlStepText}>Pas daarna ontstaat een pending actie.</ThemedText>
                </View>
              </View>

              <TazeCard variant="muted" style={styles.reviewItem}>
                <ThemedText type="defaultSemiBold">Barcode</ThemedText>
                <ThemedText style={styles.body}>{currentObservation.rawValue}</ThemedText>
                <ThemedText style={styles.pendingMeta}>Scanstatus: {scanSummary?.statusLabel ?? 'Barcode herkend'}</ThemedText>
                <ThemedText style={styles.pendingMeta}>Tijdstip: {scanSummary?.timestampLabel ?? 'Nog geen scan'}</ThemedText>
                <ThemedText style={styles.pendingMeta}>Volgende stap: Controleer product</ThemedText>
                <ThemedText style={styles.pendingMeta}>Geen voorraadmutatie uitgevoerd. Menselijke bevestiging vereist.</ThemedText>
              </TazeCard>

              <TazeCard variant="muted" style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <ThemedText type="defaultSemiBold">Productvoorstel</ThemedText>
                  <TazeBadge
                    label={currentRecognition ? currentRecognition.sourceLabel : 'Productvoorstel nog niet gekoppeld'}
                    tone={currentRecognition?.error ? 'warning' : 'accent'}
                  />
                </View>
                <ThemedText style={styles.body}>
                  {reviewedRecognition?.suggestedName ?? 'Nog geen voorstel'}{reviewedRecognition?.confidence !== null && reviewedRecognition?.confidence !== undefined ? ` · ${Math.round(reviewedRecognition.confidence * 100)}%` : ''}
                </ThemedText>
                <ThemedText style={styles.pendingMeta}>
                  {reviewedRecognition?.error ?? 'Productvoorstel blijft een suggestie en geen feit.'}
                </ThemedText>
              </TazeCard>

              <View style={styles.reviewInputs}>
                <TazeInput
                  label="Corrigeer productnaam"
                  placeholder="Gebruik suggestie of typ een correctie"
                  value={reviewNameInput}
                  onChangeText={setReviewNameInput}
                  autoCapitalize="words"
                />
                <TazeInput
                  label="Corrigeer barcode"
                  placeholder="Laat leeg als niet nodig"
                  value={reviewBarcodeInput}
                  onChangeText={setReviewBarcodeInput}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.sectionHeader}>
                <View style={styles.heroBadgeRow}>
                  <TazeBadge label="Locatie" tone="primary" />
                  <TazeBadge label={getScanLocationLabel(selectedScanLocation)} tone="info" />
                </View>
                <ThemedText type="defaultSemiBold">Kies bar, keuken of stock</ThemedText>
              </View>

              <View style={styles.actionChipRow}>
                {SCAN_LOCATIONS.map((location) => {
                  const selected = selectedScanLocation === location.value;

                  return (
                    <Pressable
                      key={location.value}
                      accessibilityRole="button"
                      onPress={() => setSelectedScanLocation(location.value)}
                      style={[
                        styles.actionChip,
                        selected ? styles.actionChipSelected : null,
                        { borderColor: selected ? Brand.primary : 'rgba(15, 23, 42, 0.08)' },
                      ]}>
                      <TazeBadge label="Locatie" tone={selected ? 'primary' : 'neutral'} />
                      <ThemedText type="defaultSemiBold" style={[styles.actionChipText, selected ? styles.actionChipTextSelected : null]}>
                        {location.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.actionChipRow}>
                {ACTION_ORDER.map((actionType) => {
                  const selected = selectedActionType === actionType;
                  return (
                      <Pressable
                      key={actionType}
                      accessibilityRole="button"
                      onPress={() => setSelectedActionType(actionType)}
                      style={[styles.actionChip, selected ? styles.actionChipSelected : null, { borderColor: selected ? Brand.primary : 'rgba(15, 23, 42, 0.08)' }]}>
                      <TazeBadge label={getScanActionLabel(actionType)} tone={selected ? getActionTone(actionType) : 'neutral'} />
                      <ThemedText type="defaultSemiBold" style={[styles.actionChipText, selected ? styles.actionChipTextSelected : null]}>
                        {getScanActionDescription(actionType)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.sectionActions}>
                <TazeButton label="Bevestig observatie, geen voorraadmutatie" icon="verified" variant="primary" onPress={() => void handleConfirmObservation()} />
                <TazeButton label="Verwerp observatie" icon="close" variant="ghost" onPress={handleDiscardDraft} />
              </View>
            </View>
          ) : (
            <TazeCard variant="muted" style={styles.emptyPendingCard}>
              <ThemedText type="defaultSemiBold">Nog geen observatie</ThemedText>
              <ThemedText style={styles.body}>
                Start een scan of maak een manuele observatie. Daarna zie je hier de AI-suggestie en de bevestiging.
              </ThemedText>
            </TazeCard>
          )}
        </TazeCard>

        <TazeCard variant="panel" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.heroBadgeRow}>
              <TazeBadge label="Pending" tone="warning" />
              <TazeBadge label="Mutatiepoort" tone="neutral" />
            </View>
            <ThemedText type="defaultSemiBold">Pending scan acties</ThemedText>
          </View>

          {pendingActions.length ? (
            <View style={styles.pendingList}>
              {pendingActions.map((action) => (
                (() => {
                  const actionPolicy = getApprovalPolicyForAction(auth, action);
                  const mutationContext = buildMutationContext(auth, action);
                  const canApplyMutation = canMutateInventory(mutationContext, action);
                  const sourceLabel = action.sourceObservationLabel ?? `${action.observationStatus ?? 'draft'} observatie`;
                  const recognitionLabel = action.recognitionLabel ?? 'AI/barcode suggestie';
                  const mutationGateLabel = getMutationGateLabel(action, canApplyMutation);
                  return (
                    <TazeCard key={action.id} variant="muted" style={styles.pendingItem}>
                      <View style={styles.pendingItemHeader}>
                        <View style={styles.heroBadgeRow}>
                          <TazeBadge label={getDutchPendingStatusLabel(action.status)} tone={getStatusTone(action.status)} />
                          <TazeBadge label={getRiskLabel(actionPolicy.riskLevel)} tone={getRiskTone(actionPolicy.riskLevel)} />
                          <TazeBadge
                            label={action.requiresApproval ? 'Managergoedkeuring nodig' : 'Menselijke bevestiging nodig'}
                            tone={action.requiresApproval ? 'warning' : 'info'}
                          />
                          <TazeBadge label={mutationGateLabel} tone={canApplyMutation ? 'success' : action.status === 'rejected' ? 'danger' : 'warning'} />
                        </View>
                        <ThemedText type="defaultSemiBold">{getScanActionLabel(action.actionType)}</ThemedText>
                      </View>
                      <ThemedText style={styles.body}>{getScanActionDescription(action.actionType)}</ThemedText>
                      <View style={styles.mutationGateStrip}>
                        <View style={styles.mutationGateStep}>
                          <TazeBadge label="Observatie" tone={action.observationStatus === 'confirmed' ? 'success' : 'warning'} />
                          <ThemedText style={styles.mutationGateText}>
                            {action.observationStatus === 'confirmed' ? 'Bevestigd' : 'Nog niet bevestigd'}
                          </ThemedText>
                        </View>
                        <View style={styles.mutationGateStep}>
                          <TazeBadge label="Goedkeuring" tone={action.status === 'approved' || canApplyMutation ? 'success' : 'warning'} />
                          <ThemedText style={styles.mutationGateText}>
                            {action.status === 'approved' ? 'Goedgekeurd' : action.requiresApproval ? 'Manager nodig' : 'Mens nodig'}
                          </ThemedText>
                        </View>
                        <View style={styles.mutationGateStep}>
                          <TazeBadge label="Mutatie" tone={canApplyMutation ? 'success' : 'neutral'} />
                          <ThemedText style={styles.mutationGateText}>{mutationGateLabel}</ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.pendingMeta}>{getActionStatusHint(action)}</ThemedText>
                      <ThemedText style={styles.pendingMeta}>Bron observatie: {sourceLabel}</ThemedText>
                      <ThemedText style={styles.pendingMeta}>Voorstel: {recognitionLabel}</ThemedText>
                      <ThemedText style={styles.pendingMeta}>Beleidsreden: {action.policyReason ?? actionPolicy.reason}</ThemedText>
                      <ThemedText style={styles.pendingMeta}>Voor audit: {new Date(action.createdAt).toLocaleString('nl-BE')}</ThemedText>
                      <View style={styles.pendingActions}>
                        {canApplyMutation && action.status !== 'rejected' && action.status !== 'applied' ? (
                          <TazeButton
                            label="Voorraadmutatie toepassen"
                            icon="done"
                            variant="primary"
                            disabled={mutationBusyActionId === action.id}
                            onPress={() => void handleApplyPendingAction(action)}
                          />
                        ) : null}
                        {actionPolicy.canApprove && action.status !== 'rejected' && action.status !== 'approved' && action.status !== 'applied' ? (
                          <>
                            <TazeButton label="Goedkeuren" icon="verified" variant="primary" onPress={() => void handleApprovePendingAction(action)} />
                            <TazeButton label="Afwijzen" icon="close" variant="secondary" onPress={() => void handleRejectPendingAction(action)} />
                            <TazeButton
                              label="Meer context vragen"
                              icon="help-outline"
                              variant="ghost"
                              onPress={() => void handleRequestContext(action)}
                            />
                          </>
                        ) : action.requiresApproval && action.status !== 'approved' && action.status !== 'applied' ? (
                          <TazeButton label="Wacht op managergoedkeuring" icon="schedule" variant="secondary" onPress={openPendingActions} />
                        ) : null}
                      </View>
                    </TazeCard>
                  );
                })()
              ))}
            </View>
          ) : (
            <TazeCard variant="muted" style={styles.emptyPendingCard}>
              <ThemedText type="defaultSemiBold">Nog geen pending acties</ThemedText>
              <ThemedText style={styles.body}>
                Start een scan, voeg een product handmatig toe of meld schade/verval om hier een veilige observatie klaar te zetten.
              </ThemedText>
            </TazeCard>
          )}
        </TazeCard>

        <TazeCard variant="muted" style={styles.noteCard}>
          <TazeBadge label="Veiligheidsnota" tone="warning" icon="shield" />
          <ThemedText style={styles.noteText}>
            Scans create observations. Inventory changes require confirmation or approval.
          </ThemedText>
        </TazeCard>
      </TazeCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexGrow: 1,
    padding: 24,
    gap: 16,
  },
  shellCompact: {
    padding: 16,
  },
  heroCard: {
    gap: 16,
    padding: 22,
  },
  heroCardCompact: {
    padding: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subtitle: {
    color: Brand.ink,
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contextGridCompact: {
    flexDirection: 'column',
  },
  contextCard: {
    flex: 1,
    minWidth: 180,
    gap: 6,
  },
  contextLabel: {
    color: Brand.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  contextValue: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  statusCard: {
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  body: {
    color: Brand.inkMuted,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionRowCompact: {
    flexDirection: 'column',
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  sectionCard: {
    gap: 12,
  },
  sectionHeader: {
    gap: 8,
  },
  sectionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cameraFrame: {
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#0f172a',
    minHeight: 230,
  },
  camera: {
    width: '100%',
    height: 230,
  },
  manualInputStack: {
    gap: 12,
  },
  reviewStack: {
    gap: 12,
  },
  controlStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  controlStep: {
    flex: 1,
    minWidth: 170,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    gap: 6,
  },
  controlStepTitle: {
    color: Brand.ink,
  },
  controlStepText: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewItem: {
    gap: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reviewInputs: {
    gap: 12,
  },
  actionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionChip: {
    flexGrow: 1,
    minWidth: 160,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  actionChipSelected: {
    backgroundColor: '#f0fdfa',
    shadowColor: Brand.dark,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  actionChipText: {
    color: Brand.inkMuted,
    lineHeight: 18,
    fontSize: 12,
  },
  actionChipTextSelected: {
    color: Brand.ink,
  },
  pendingList: {
    gap: 10,
  },
  pendingItem: {
    gap: 8,
  },
  pendingItemHeader: {
    gap: 8,
  },
  mutationGateStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  mutationGateStep: {
    flex: 1,
    minWidth: 150,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    gap: 6,
  },
  mutationGateText: {
    color: Brand.inkMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  pendingActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pendingMeta: {
    color: Brand.inkMuted,
    fontSize: 12,
  },
  noteCard: {
    gap: 10,
  },
  noteText: {
    color: Brand.ink,
    lineHeight: 20,
  },
  emptyStateCard: {
    gap: 10,
  },
  emptyStateActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emptyPendingCard: {
    gap: 8,
  },
});

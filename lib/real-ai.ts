import { logAiAuditResponse, type AiAuditScreen } from 'lib/ai-audit';
import { getRealAiUnavailableMessage } from 'lib/ai-availability';
import { buildTenantAwareAiContext } from 'lib/ai-tenant-context';
import { getServerBaseUrl } from 'lib/server-url';
import { getCachedTenantContext } from 'lib/tenant-auth';
import { buildTransportAiContext } from 'lib/transport-ai';

export type RealAiRoute =
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

export type RealAiAvailableAction = {
  kind: string;
  label: string;
  description?: string;
};

export type RealAiAction = {
  kind: string;
  label: string;
};

export type RealAiResponse = {
  auditId: string;
  title: string;
  answer: string;
  recommendedRoute: RealAiRoute;
  recommendedLabel: string;
  model: string;
  action: RealAiAction | null;
  transportMeta: {
    partnerLabel: string;
    isDefault: boolean;
    favoriteCount: number;
    syncState: 'local' | 'queued' | 'synced' | null;
    syncSummary: string | null;
    statusSummary: string | null;
  } | null;
};

type RealAiRequest = {
  screen: AiAuditScreen;
  question: string;
  language?: string;
  context?: unknown;
  availableActions?: RealAiAvailableAction[];
  serverBaseUrl?: string;
};

export async function requestRealAi({
  screen,
  question,
  language = 'Nederlands',
  context = {},
  availableActions = [],
  serverBaseUrl,
}: RealAiRequest): Promise<RealAiResponse> {
  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length < 3) {
    throw new Error('Je vraag is nog te kort voor een echte AI-respons.');
  }

  const mergedContext = buildTenantAwareAiContext({
    context,
    tenantContext: getCachedTenantContext(),
    transportGlobal: buildTransportAiContext(),
  });

  const response = await fetch(`${serverBaseUrl ?? getServerBaseUrl()}/api/ai/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: trimmedQuestion,
      language,
      context: mergedContext,
      availableActions,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const errorCode = String(payload?.error ?? '');
    if (errorCode === 'openai_auth_error') {
      throw new Error('AI is momenteel niet beschikbaar. De serverconfiguratie moet worden gecontroleerd.');
    }

    throw new Error(getRealAiUnavailableMessage(errorCode));
  }

  const route = String(payload.recommendedRoute ?? '').trim();
  const normalizedRoute: RealAiRoute =
    route === '/scan' ||
    route === '/explore' ||
    route === '/alerts' ||
    route === '/trace' ||
    route === '/payments' ||
    route === '/partners' ||
    route === '/account' ||
    route === '/security' ||
    route === '/privacy' ||
    route === '/support' ||
    route === '/contact' ||
    route === '/translate' ||
    route === '/transport'
      ? route
      : '/explore';
  const transportGlobal =
    mergedContext && typeof mergedContext === 'object' && 'transportGlobal' in mergedContext
      ? (mergedContext as { transportGlobal?: { transport?: Record<string, unknown> } }).transportGlobal?.transport
      : null;
  const recommendedPartner =
    transportGlobal && typeof transportGlobal === 'object' && 'recommendedPartner' in transportGlobal
      ? (transportGlobal.recommendedPartner as Record<string, unknown> | null)
      : null;
  const preferenceSync =
    transportGlobal && typeof transportGlobal === 'object' && 'preferenceSync' in transportGlobal
      ? (transportGlobal.preferenceSync as Record<string, unknown> | null)
      : null;
  const preferenceStatus =
    recommendedPartner && typeof recommendedPartner === 'object' && 'preferenceStatus' in recommendedPartner
      ? (recommendedPartner.preferenceStatus as Record<string, unknown> | null)
      : null;
  const transportMeta: RealAiResponse['transportMeta'] =
    recommendedPartner && typeof recommendedPartner.label === 'string'
      ? {
          partnerLabel: recommendedPartner.label,
          isDefault: preferenceStatus?.isDefault === true,
          favoriteCount:
            typeof preferenceStatus?.favoriteCount === 'number' && Number.isFinite(preferenceStatus.favoriteCount)
              ? preferenceStatus.favoriteCount
              : 0,
          syncState: (() => {
            const value = preferenceStatus?.syncState;
            return value === 'local' || value === 'queued' || value === 'synced' ? value : null;
          })(),
          syncSummary: typeof preferenceSync?.syncSummary === 'string' ? preferenceSync.syncSummary : null,
          statusSummary: typeof preferenceStatus?.statusSummary === 'string' ? preferenceStatus.statusSummary : null,
        }
      : null;

  const audit = await logAiAuditResponse({
    screen,
    question: trimmedQuestion,
    title: String(payload.title ?? 'AI copilot').trim() || 'AI copilot',
    answer: String(payload.answer ?? '').trim(),
    recommendedRoute: normalizedRoute,
    recommendedLabel: String(payload.recommendedLabel ?? 'Open aanbevolen scherm').trim() || 'Open aanbevolen scherm',
    model: String(payload.model ?? 'OpenAI').trim() || 'OpenAI',
    actionKind: null,
    actionLabel: null,
  });

  return {
    auditId: audit.id,
    title: String(payload.title ?? 'AI copilot').trim() || 'AI copilot',
    answer: String(payload.answer ?? '').trim(),
    recommendedRoute: normalizedRoute,
    recommendedLabel: String(payload.recommendedLabel ?? 'Open aanbevolen scherm').trim() || 'Open aanbevolen scherm',
    model: String(payload.model ?? 'OpenAI').trim() || 'OpenAI',
    action: null,
    transportMeta,
  };
}

import { getItem, setItem } from 'lib/app-storage';

export type AiAuditScreen =
  | 'helpdesk'
  | 'scan'
  | 'explore'
  | 'payments'
  | 'alerts'
  | 'trace'
  | 'partners'
  | 'privacy'
  | 'support'
  | 'contact';

export type AiAuditInteractionKind = 'none' | 'route_opened' | 'action_applied';
export type AiAuditOutcomeKind = 'pending' | 'success' | 'failed';

export type AiAuditEntry = {
  id: string;
  screen: AiAuditScreen;
  question: string;
  title: string;
  answer: string;
  model: string;
  recommendedRoute: string;
  recommendedLabel: string;
  actionKind: string | null;
  actionLabel: string | null;
  createdAt: string;
  interactionKind: AiAuditInteractionKind;
  interactionAt: string | null;
  interactionLabel: string | null;
  outcomeKind: AiAuditOutcomeKind;
  outcomeAt: string | null;
  outcomeLabel: string | null;
};

type LogAiAuditResponseInput = {
  screen: AiAuditScreen;
  question: string;
  title: string;
  answer: string;
  model: string;
  recommendedRoute: string;
  recommendedLabel: string;
  actionKind?: string | null;
  actionLabel?: string | null;
};

const STORAGE_KEY = 'ai-audit-log-v1';
const MAX_ENTRIES = 40;

let cache: AiAuditEntry[] = [];
let hydrated = false;
let hydratePromise: Promise<AiAuditEntry[]> | null = null;
const listeners = new Set<(entries: AiAuditEntry[]) => void>();

function emit(next: AiAuditEntry[]) {
  listeners.forEach((listener) => listener(next));
}

function normalizeEntries(value: unknown): AiAuditEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const candidate = entry as Partial<AiAuditEntry>;
      const interactionKind: AiAuditInteractionKind =
        candidate.interactionKind === 'route_opened' || candidate.interactionKind === 'action_applied'
          ? candidate.interactionKind
          : 'none';
      const outcomeKind: AiAuditOutcomeKind =
        candidate.outcomeKind === 'success' || candidate.outcomeKind === 'failed' ? candidate.outcomeKind : 'pending';

      return {
        id: String(candidate.id ?? `ai-audit-${Date.now()}`),
        screen:
          candidate.screen === 'helpdesk' ||
          candidate.screen === 'scan' ||
          candidate.screen === 'explore' ||
          candidate.screen === 'payments' ||
          candidate.screen === 'alerts' ||
          candidate.screen === 'trace' ||
          candidate.screen === 'partners' ||
          candidate.screen === 'privacy' ||
          candidate.screen === 'support' ||
          candidate.screen === 'contact'
            ? candidate.screen
            : 'helpdesk',
        question: String(candidate.question ?? '').trim().slice(0, 280),
        title: String(candidate.title ?? '').trim().slice(0, 120),
        answer: String(candidate.answer ?? '').trim().slice(0, 1200),
        model: String(candidate.model ?? 'OpenAI').trim().slice(0, 80) || 'OpenAI',
        recommendedRoute: String(candidate.recommendedRoute ?? '/explore').trim().slice(0, 80),
        recommendedLabel: String(candidate.recommendedLabel ?? 'Open aanbevolen scherm')
          .trim()
          .slice(0, 120),
        actionKind: candidate.actionKind ? String(candidate.actionKind).trim().slice(0, 80) : null,
        actionLabel: candidate.actionLabel ? String(candidate.actionLabel).trim().slice(0, 120) : null,
        createdAt: String(candidate.createdAt ?? new Date().toISOString()),
        interactionKind,
        interactionAt: candidate.interactionAt ? String(candidate.interactionAt) : null,
        interactionLabel: candidate.interactionLabel ? String(candidate.interactionLabel).trim().slice(0, 120) : null,
        outcomeKind,
        outcomeAt: candidate.outcomeAt ? String(candidate.outcomeAt) : null,
        outcomeLabel: candidate.outcomeLabel ? String(candidate.outcomeLabel).trim().slice(0, 120) : null,
      };
    })
    .slice(0, MAX_ENTRIES);
}

async function persist(next: AiAuditEntry[]) {
  cache = next.slice(0, MAX_ENTRIES);
  hydrated = true;
  await setItem(STORAGE_KEY, JSON.stringify(cache));
  emit(cache);
}

export async function loadAiAuditEntries(): Promise<AiAuditEntry[]> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await getItem(STORAGE_KEY);
      if (!raw) {
        cache = [];
        hydrated = true;
        return cache;
      }

      cache = normalizeEntries(JSON.parse(raw));
      hydrated = true;
      emit(cache);
      return cache;
    } catch {
      hydrated = true;
      return cache;
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

export function getCachedAiAuditEntries() {
  return hydrated ? cache : [];
}

export function subscribeAiAudit(listener: (entries: AiAuditEntry[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function logAiAuditResponse(input: LogAiAuditResponseInput) {
  const createdAt = new Date().toISOString();
  const entry: AiAuditEntry = {
    id: `ai-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    screen: input.screen,
    question: input.question.trim().slice(0, 280),
    title: input.title.trim().slice(0, 120),
    answer: input.answer.trim().slice(0, 1200),
    model: input.model.trim().slice(0, 80) || 'OpenAI',
    recommendedRoute: input.recommendedRoute.trim().slice(0, 80),
    recommendedLabel: input.recommendedLabel.trim().slice(0, 120),
    actionKind: input.actionKind ? input.actionKind.trim().slice(0, 80) : null,
    actionLabel: input.actionLabel ? input.actionLabel.trim().slice(0, 120) : null,
    createdAt,
    interactionKind: 'none',
    interactionAt: null,
    interactionLabel: null,
    outcomeKind: 'pending',
    outcomeAt: null,
    outcomeLabel: null,
  };

  const current = (await loadAiAuditEntries()).slice(0, MAX_ENTRIES - 1);
  await persist([entry, ...current]);
  return entry;
}

export async function markAiAuditInteraction(
  entryId: string,
  interaction: { kind: Exclude<AiAuditInteractionKind, 'none'>; label: string }
) {
  const current = await loadAiAuditEntries();
  const priority = (kind: AiAuditInteractionKind) =>
    kind === 'action_applied' ? 2 : kind === 'route_opened' ? 1 : 0;

  const next = current.map((entry) =>
    entry.id === entryId
      ? priority(interaction.kind) >= priority(entry.interactionKind)
        ? {
            ...entry,
            interactionKind: interaction.kind,
            interactionAt: new Date().toISOString(),
            interactionLabel: interaction.label.trim().slice(0, 120),
          }
        : entry
      : entry
  );

  await persist(next);
}

export async function markAiAuditOutcome(
  entryId: string,
  outcome: { kind: Exclude<AiAuditOutcomeKind, 'pending'>; label: string }
) {
  const current = await loadAiAuditEntries();
  const priority = (kind: AiAuditOutcomeKind) => (kind === 'success' ? 2 : kind === 'failed' ? 1 : 0);

  const next = current.map((entry) =>
    entry.id === entryId
      ? priority(outcome.kind) >= priority(entry.outcomeKind)
        ? {
            ...entry,
            outcomeKind: outcome.kind,
            outcomeAt: new Date().toISOString(),
            outcomeLabel: outcome.label.trim().slice(0, 120),
          }
        : entry
      : entry
  );

  await persist(next);
}

export async function clearAiAuditEntries() {
  await persist([]);
}
